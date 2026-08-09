-- Course content: weekly Sunday live sessions, study material, recorded lectures.
--
-- Three additions, all keyed to a course and all readable only by the
-- instructor and students with an approved enrollment:
--   course_schedules  the teacher's recurring Sunday slot; sessions are
--                     generated from it by the sunday-sessions-ensure function
--   study_materials   uploaded PDFs/slides/notes (Storage: course-materials)
--   course_videos     uploaded recorded lectures (Storage: course-videos)

-- ---------------------------------------------------------------- enums

-- Class = the scheduled Sunday lecture. Doubt = the Q&A slot. Both are live
-- sessions with a Meet link; only the label and the schedule row differ.
create type session_kind as enum ('class', 'doubt');

-- notification_type gained 'material_published' / 'lecture_published' in 0006.

-- ---------------------------------------------------------------- membership helpers

-- RLS on these tables has to ask "is this user in that course?". Doing that as
-- a bare EXISTS against enrollments works, but repeating it in eight policies
-- is where drift creeps in. SECURITY DEFINER + a stable search_path keeps the
-- check in one place and skips a recursive policy evaluation on enrollments.
create or replace function teaches_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from courses c
     where c.id = p_course_id
       and c.instructor_id = auth.uid()
  );
$$;

create or replace function is_enrolled_in(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from enrollments e
     where e.course_id = p_course_id
       and e.student_id = auth.uid()
       and e.status in ('approved', 'completed')
  );
$$;

comment on function is_enrolled_in(uuid) is
  'True only for approved/completed enrollments — a pending request grants no access to material.';

-- ---------------------------------------------------------------- schedules

-- One recurring weekly slot per (course, kind). Sunday-only is enforced by the
-- weekday check rather than by the UI alone, so a hand-written insert cannot
-- create a Wednesday class.
create table course_schedules (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references courses (id) on delete cascade,
  instructor_id    uuid not null references profiles (id) on delete cascade,
  kind             session_kind not null default 'class',
  title            text not null default '',
  -- ISO weekday, 0 = Sunday. Stored explicitly so the constraint is readable
  -- and a future "also allow Saturdays" change is a one-line edit.
  weekday          integer not null default 0 check (weekday = 0),
  start_time       time not null,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 480),
  -- IANA zone. 10:00 must mean 10:00 where the teacher lives, not UTC.
  timezone         text not null default 'Asia/Kolkata',
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (course_id, kind)
);

create index course_schedules_course_idx on course_schedules (course_id) where active;

create trigger course_schedules_touch before update on course_schedules
  for each row execute function touch_updated_at();

-- Sessions generated from a schedule point back at it, so re-running the
-- generator can tell "already created" from "teacher added this by hand".
alter table live_sessions
  add column kind        session_kind not null default 'class',
  add column schedule_id uuid references course_schedules (id) on delete set null;

-- The generator is idempotent: one session per schedule per calendar day.
-- The date is pinned to UTC because a bare `starts_at::date` depends on the
-- session TimeZone, making it STABLE rather than IMMUTABLE — which Postgres
-- rejects in an index. sunday-sessions-ensure compares the same UTC date.
create unique index live_sessions_schedule_day_idx
  on live_sessions (schedule_id, ((starts_at at time zone 'UTC')::date))
  where schedule_id is not null;

-- ---------------------------------------------------------------- study material

create table study_materials (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses (id) on delete cascade,
  instructor_id uuid not null references profiles (id) on delete cascade,
  title         text not null,
  description   text not null default '',
  -- Object key inside the private course-materials bucket: <course_id>/<uuid>-<name>
  storage_path  text not null unique,
  file_name     text not null,
  mime_type     text not null default 'application/octet-stream',
  size_bytes    bigint not null default 0 check (size_bytes >= 0),
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

create index study_materials_course_idx on study_materials (course_id, position);

-- ---------------------------------------------------------------- recorded lectures

create table course_videos (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references courses (id) on delete cascade,
  instructor_id    uuid not null references profiles (id) on delete cascade,
  title            text not null,
  description      text not null default '',
  storage_path     text not null unique,
  file_name        text not null,
  mime_type        text not null default 'video/mp4',
  size_bytes       bigint not null default 0 check (size_bytes >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  position         integer not null default 0,
  published        boolean not null default true,
  created_at       timestamptz not null default now()
);

create index course_videos_course_idx on course_videos (course_id, position);

-- ---------------------------------------------------------------- RLS

alter table course_schedules enable row level security;
alter table study_materials  enable row level security;
alter table course_videos    enable row level security;

create policy "course members read the schedule"
  on course_schedules for select
  to authenticated
  using (teaches_course(course_id) or is_enrolled_in(course_id));

create policy "instructors manage their schedule"
  on course_schedules for all
  to authenticated
  using (teaches_course(course_id))
  with check (teaches_course(course_id) and instructor_id = auth.uid());

-- 0003 gave live_sessions a SELECT policy only, because the Edge Function
-- writes them with the service role. Cancelling is a plain client action
-- though, so instructors get DELETE on their own course's sessions.
create policy "instructors delete their sessions"
  on live_sessions for delete
  to authenticated
  using (teaches_course(course_id));

create policy "enrolled students read study material"
  on study_materials for select
  to authenticated
  using (teaches_course(course_id) or is_enrolled_in(course_id));

create policy "instructors manage their study material"
  on study_materials for all
  to authenticated
  using (teaches_course(course_id))
  with check (teaches_course(course_id) and instructor_id = auth.uid());

-- Unpublished lectures stay invisible to students until the teacher flips the
-- flag, which is what makes "upload now, release later" safe.
create policy "enrolled students read published lectures"
  on course_videos for select
  to authenticated
  using (teaches_course(course_id) or (published and is_enrolled_in(course_id)));

create policy "instructors manage their lectures"
  on course_videos for all
  to authenticated
  using (teaches_course(course_id))
  with check (teaches_course(course_id) and instructor_id = auth.uid());

-- ---------------------------------------------------------------- storage

-- Private buckets. Nothing is served by public URL; the client asks for a
-- short-lived signed URL and RLS below decides whether it gets one.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('course-materials', 'course-materials', false, 52428800,   -- 50 MB
   -- octet-stream is listed because browsers report an empty File.type for
   -- some .doc/.zip files; without it those uploads would be rejected here
   -- rather than by any deliberate policy.
   array['application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'application/zip',
         'application/octet-stream',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation']),
  ('course-videos', 'course-videos', false, 2147483648,       -- 2 GB
   array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

-- Both buckets use <course_id>/<file> keys, so the first path segment names
-- the course and the same three policies cover every object.
--
-- Casting that segment inline would *raise* on a key that is not a UUID rather
-- than denying it, so the parse is wrapped: an unparseable key yields NULL,
-- which matches no course and fails closed.
create or replace function storage_course_id(p_name text)
returns uuid
language plpgsql
stable
as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

create policy "course members read material objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('course-materials', 'course-videos')
    and (
      public.teaches_course(public.storage_course_id(name))
      or public.is_enrolled_in(public.storage_course_id(name))
    )
  );

create policy "instructors write material objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('course-materials', 'course-videos')
    and public.teaches_course(public.storage_course_id(name))
  );

create policy "instructors delete material objects"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('course-materials', 'course-videos')
    and public.teaches_course(public.storage_course_id(name))
  );

-- ---------------------------------------------------------------- notify students

-- `notifications` has no client INSERT policy — a user may read and dismiss
-- their own rows, never write someone else's. Publishing material still has to
-- reach every enrolled student, so it goes through this narrow SECURITY
-- DEFINER function: instructor-only, and only for the two content types.
create or replace function notify_course_students(
  p_course_id uuid,
  p_type      notification_type,
  p_message   text,
  p_metadata  jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not teaches_course(p_course_id) then
    raise exception 'only the course instructor can notify its students';
  end if;

  if p_type not in ('material_published', 'lecture_published') then
    raise exception 'notify_course_students only sends content notifications';
  end if;

  insert into notifications (user_id, type, message, metadata)
  select e.student_id, p_type, p_message, p_metadata
    from enrollments e
   where e.course_id = p_course_id
     and e.status in ('approved', 'completed');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------- grants

grant execute on function teaches_course(uuid)  to authenticated;
grant execute on function is_enrolled_in(uuid)  to authenticated;
grant execute on function notify_course_students(uuid, notification_type, text, jsonb) to authenticated;
