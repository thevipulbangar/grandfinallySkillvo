-- Skillvo schema: 0001 + 0002 + 0003 + seed, concatenated.
-- Paste into the Supabase SQL Editor and Run.
--
-- Does NOT include 0004_auth_triggers.sql — run that one separately, since
-- it may fail on privileges and must not roll this back.


-- ============================================================
-- supabase/migrations/0001_init.sql
-- ============================================================

-- Skillvo core schema
-- Covers: profiles, courses, enrollments, credits/wallet, notifications,
-- quizzes, 2FA (VaultShield), payments (Razorpay), live sessions (Google Meet).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums

create type user_role as enum ('Student', 'Teacher', 'Master Educator');
create type enrollment_status as enum ('pending', 'approved', 'declined', 'completed');
create type notification_type as enum (
  'enrollment_request',
  'enrollment_approved',
  'enrollment_declined',
  'course_published',
  'credit_added',
  'credit_earned',
  'credit_spent',
  'security_alert',
  'session_scheduled'
);
create type credit_reason as enum (
  'welcome_bonus',
  'purchase',
  'enrollment_spend',
  'teaching_earning',
  'course_completion_bonus',
  'refund',
  'admin_adjustment'
);
create type payment_status as enum ('created', 'paid', 'failed', 'refunded');
create type two_factor_method as enum ('none', 'totp', 'sms');

-- ---------------------------------------------------------------- profiles

create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null unique,
  name          text not null default '',
  avatar_url    text not null default '',
  department    text not null default '',
  title         text not null default '',
  bio           text,
  role          user_role not null default 'Student',
  credits       integer not null default 50 check (credits >= 0),
  level         integer not null default 1 check (level >= 1),
  level_title   text not null default 'Level 1 Scholar',
  xp_points     integer not null default 0 check (xp_points >= 0),
  badges        text[] not null default '{}',
  onboarded     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column profiles.credits is 'Skillvo credit wallet balance. Only mutated via the spend/grant RPCs.';

-- ---------------------------------------------------------------- courses

create table courses (
  id                     uuid primary key default gen_random_uuid(),
  instructor_id          uuid not null references profiles (id) on delete cascade,
  title                  text not null,
  category               text not null,
  description            text not null default '',
  credit_fee             integer not null default 0 check (credit_fee >= 0),
  lessons_count          integer not null default 0 check (lessons_count >= 0),
  level                  text not null default 'Beginner',
  rating                 numeric(2, 1) not null default 0 check (rating between 0 and 5),
  students_count         integer not null default 0 check (students_count >= 0),
  verified_teacher_topic boolean not null default false,
  published              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index courses_instructor_idx on courses (instructor_id);
create index courses_category_idx on courses (category) where published;

create table course_lessons (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references courses (id) on delete cascade,
  position   integer not null check (position >= 0),
  title      text not null,
  summary    text,
  created_at timestamptz not null default now(),
  unique (course_id, position)
);

-- ---------------------------------------------------------------- enrollments

-- One row per (student, course). Carries both the request lifecycle
-- (EnrollmentRequest) and the learning progress (EnrolledCourseState).
create table enrollments (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses (id) on delete cascade,
  student_id    uuid not null references profiles (id) on delete cascade,
  instructor_id uuid not null references profiles (id) on delete cascade,
  status        enrollment_status not null default 'pending',
  credit_fee    integer not null default 0 check (credit_fee >= 0),
  progress      integer not null default 0 check (progress between 0 and 100),
  next_lesson   text not null default '',
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  completed_at  timestamptz,
  unique (course_id, student_id)
);

create index enrollments_student_idx on enrollments (student_id);
create index enrollments_instructor_idx on enrollments (instructor_id, status);

-- ---------------------------------------------------------------- quizzes

-- Category skill-test bank used to gate course publishing (TOPIC_QUIZZES).
create table topic_quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  category       text not null,
  question       text not null,
  options        text[] not null check (array_length(options, 1) between 2 and 6),
  correct_answer integer not null check (correct_answer >= 0),
  created_at     timestamptz not null default now()
);

create index topic_quiz_category_idx on topic_quiz_questions (category);

create table skill_test_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  category     text not null,
  score        integer not null check (score >= 0),
  total        integer not null check (total > 0),
  passed       boolean not null,
  attempted_at timestamptz not null default now()
);

create index skill_test_user_idx on skill_test_attempts (user_id, category);

-- ---------------------------------------------------------------- wallet

create table credit_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  amount      integer not null, -- positive = credited, negative = debited
  reason      credit_reason not null,
  description text not null default '',
  course_id   uuid references courses (id) on delete set null,
  payment_id  uuid, -- FK added after payments table
  created_at  timestamptz not null default now()
);

create index credit_tx_user_idx on credit_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------- payments (Razorpay)

create table payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles (id) on delete cascade,
  razorpay_order_id   text not null unique,
  razorpay_payment_id text unique,
  razorpay_signature  text,
  pack_name           text not null,
  credits             integer not null check (credits > 0),
  amount_paise        integer not null check (amount_paise > 0),
  currency            text not null default 'INR',
  status              payment_status not null default 'created',
  failure_reason      text,
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);

create index payments_user_idx on payments (user_id, created_at desc);

alter table credit_transactions
  add constraint credit_transactions_payment_fk
  foreign key (payment_id) references payments (id) on delete set null;

-- ---------------------------------------------------------------- live sessions (Google Meet)

create table live_sessions (
  id                uuid primary key default gen_random_uuid(),
  course_id         uuid not null references courses (id) on delete cascade,
  instructor_id     uuid not null references profiles (id) on delete cascade,
  title             text not null,
  description       text not null default '',
  meet_url          text,
  google_event_id   text,
  google_calendar_id text not null default 'primary',
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  created_at        timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index live_sessions_course_idx on live_sessions (course_id, starts_at);

-- Google OAuth tokens for the Calendar/Meet API. Service-role access only:
-- no RLS policy grants any client read access to refresh tokens.
create table google_oauth_tokens (
  user_id       uuid primary key references profiles (id) on delete cascade,
  access_token  text not null,
  refresh_token text,
  scope         text not null default '',
  expires_at    timestamptz not null,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- notifications

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  type       notification_type not null,
  message    text not null,
  unread     boolean not null default true,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications (user_id, created_at desc);

-- ---------------------------------------------------------------- 2FA (VaultShield)

create table two_factor_settings (
  user_id                       uuid primary key references profiles (id) on delete cascade,
  enabled                       boolean not null default false,
  primary_method                two_factor_method not null default 'none',
  totp_enabled                  boolean not null default false,
  totp_app_name                 text not null default 'Skillvo VaultShield',
  totp_last_verified            timestamptz,
  sms_enabled                   boolean not null default false,
  sms_country_code              text not null default '+91',
  sms_phone_number              text not null default '',
  sms_last_verified             timestamptz,
  login_verification_required   boolean not null default false,
  security_score                integer not null default 0 check (security_score between 0 and 100),
  updated_at                    timestamptz not null default now()
);

-- TOTP secrets are never exposed to the browser; Edge Functions read them
-- with the service role. See 0002_policies.sql (no select policy for clients).
create table two_factor_secrets (
  user_id     uuid primary key references profiles (id) on delete cascade,
  totp_secret text not null,
  created_at  timestamptz not null default now()
);

create table two_factor_backup_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  code_hash  text not null,
  used       boolean not null default false,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index backup_codes_user_idx on two_factor_backup_codes (user_id) where not used;

create table trusted_devices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  device_name text not null,
  browser     text not null default '',
  location    text not null default '',
  fingerprint text not null,
  last_active timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (user_id, fingerprint)
);

-- ---------------------------------------------------------------- updated_at

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on profiles
  for each row execute function touch_updated_at();
create trigger courses_touch before update on courses
  for each row execute function touch_updated_at();
create trigger two_factor_settings_touch before update on two_factor_settings
  for each row execute function touch_updated_at();

-- ============================================================
-- supabase/migrations/0002_functions.sql
-- ============================================================

-- Business logic: signup provisioning, credit movements, enrollment lifecycle,
-- XP/levelling, and the leaderboard view.

-- ---------------------------------------------------------------- levelling

create or replace function level_for_xp(xp integer)
returns integer
language sql
immutable
as $$
  select greatest(1, least(10, (xp / 500) + 1));
$$;

create or replace function level_title_for(lvl integer, r user_role)
returns text
language sql
immutable
as $$
  select 'Level ' || lvl || ' ' || case
    when r = 'Master Educator' then 'Master Educator'
    when r = 'Teacher' then 'Senior Specialist'
    when lvl >= 4 then 'Senior Scholar'
    else 'Scholar'
  end;
$$;

create or replace function award_xp(p_user_id uuid, p_xp integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp integer;
  v_role user_role;
  v_level integer;
begin
  update profiles
     set xp_points = xp_points + greatest(0, p_xp)
   where id = p_user_id
  returning xp_points, role into v_xp, v_role;

  if not found then
    raise exception 'profile % not found', p_user_id;
  end if;

  v_level := level_for_xp(v_xp);
  update profiles
     set level = v_level,
         level_title = level_title_for(v_level, v_role)
   where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------- signup

-- Provision a profile + welcome credits the moment auth.users gets a row.
-- Works for email/password signup and for Google OAuth alike; OAuth metadata
-- keys (full_name, avatar_url) are read alongside our own signup fields.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := coalesce(
    nullif(v_meta ->> 'name', ''),
    nullif(v_meta ->> 'full_name', ''),
    split_part(new.email, '@', 1)
  );
  v_role user_role := coalesce((v_meta ->> 'role')::user_role, 'Student');
begin
  insert into profiles (id, email, name, avatar_url, department, title, role, credits, level_title)
  values (
    new.id,
    new.email,
    v_name,
    coalesce(nullif(v_meta ->> 'avatar_url', ''), nullif(v_meta ->> 'picture', ''), ''),
    coalesce(v_meta ->> 'department', ''),
    case when v_role = 'Student' then 'Learner' else 'Instructor' end,
    v_role,
    50,
    level_title_for(1, v_role)
  )
  on conflict (id) do nothing;

  insert into two_factor_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into credit_transactions (user_id, amount, reason, description)
  values (new.id, 50, 'welcome_bonus', 'Welcome bonus: 50 free Skillvo credits');

  insert into notifications (user_id, type, message)
  values (new.id, 'credit_added', '🎁 Welcome bonus: 50 Free Skillvo Credits added to your account wallet!');

  return new;
end;
$$;

-- The trigger that calls this lives in 0004_auth_triggers.sql: creating a
-- trigger on auth.users needs privileges the SQL editor does not always have,
-- and a failure there must not roll back the rest of the schema.

-- Keep profiles.email in step with a verified email change.
create or replace function handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

-- Trigger also in 0004_auth_triggers.sql.

-- Client-callable fallback for `handle_new_user`. If the auth.users trigger
-- could not be installed, the app calls this right after sign-in and it
-- provisions the profile on first use instead. Idempotent either way.
create or replace function ensure_profile()
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user auth.users;
  v_row profiles;
  v_meta jsonb;
  v_role user_role;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_row from profiles where id = auth.uid();
  if found then
    return v_row;
  end if;

  select * into v_user from auth.users where id = auth.uid();
  v_meta := coalesce(v_user.raw_user_meta_data, '{}'::jsonb);
  v_role := coalesce((v_meta ->> 'role')::user_role, 'Student');

  insert into profiles (id, email, name, avatar_url, department, title, role, credits, level_title)
  values (
    v_user.id,
    v_user.email,
    coalesce(
      nullif(v_meta ->> 'name', ''),
      nullif(v_meta ->> 'full_name', ''),
      split_part(v_user.email, '@', 1)
    ),
    coalesce(nullif(v_meta ->> 'avatar_url', ''), nullif(v_meta ->> 'picture', ''), ''),
    coalesce(v_meta ->> 'department', ''),
    case when v_role = 'Student' then 'Learner' else 'Instructor' end,
    v_role,
    50,
    level_title_for(1, v_role)
  )
  returning * into v_row;

  insert into two_factor_settings (user_id) values (v_row.id)
  on conflict (user_id) do nothing;

  insert into credit_transactions (user_id, amount, reason, description)
  values (v_row.id, 50, 'welcome_bonus', 'Welcome bonus: 50 free Skillvo credits');

  insert into notifications (user_id, type, message)
  values (v_row.id, 'credit_added', '🎁 Welcome bonus: 50 Free Skillvo Credits added to your account wallet!');

  return v_row;
end;
$$;

-- ---------------------------------------------------------------- credits

-- Single writer for the wallet: adjusts the balance, logs the ledger row, and
-- refuses to overdraw. Callers never UPDATE profiles.credits directly.
create or replace function adjust_credits(
  p_user_id     uuid,
  p_amount      integer,
  p_reason      credit_reason,
  p_description text default '',
  p_course_id   uuid default null,
  p_payment_id  uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_amount = 0 then
    raise exception 'credit adjustment must be non-zero';
  end if;

  update profiles
     set credits = credits + p_amount
   where id = p_user_id
  returning credits into v_balance;

  if not found then
    raise exception 'profile % not found', p_user_id;
  end if;

  if v_balance < 0 then
    raise exception 'insufficient credits' using errcode = 'check_violation';
  end if;

  insert into credit_transactions (user_id, amount, reason, description, course_id, payment_id)
  values (p_user_id, p_amount, p_reason, p_description, p_course_id, p_payment_id);

  return v_balance;
end;
$$;

-- ---------------------------------------------------------------- enrollment lifecycle

-- Student requests a seat. Credits are held (debited) at request time and
-- refunded if the instructor declines, mirroring the current UI behaviour.
create or replace function request_enrollment(p_course_id uuid)
returns enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid := auth.uid();
  v_course courses;
  v_row enrollments;
  v_student_name text;
begin
  if v_student is null then
    raise exception 'not authenticated';
  end if;

  select * into v_course from courses where id = p_course_id and published;
  if not found then
    raise exception 'course not available';
  end if;

  if v_course.instructor_id = v_student then
    raise exception 'you cannot enrol in your own course';
  end if;

  perform adjust_credits(
    v_student, -v_course.credit_fee, 'enrollment_spend',
    'Enrollment request: ' || v_course.title, v_course.id
  );

  insert into enrollments (course_id, student_id, instructor_id, status, credit_fee, next_lesson)
  values (p_course_id, v_student, v_course.instructor_id, 'pending', v_course.credit_fee, 'Awaiting instructor approval')
  returning * into v_row;

  select name into v_student_name from profiles where id = v_student;

  insert into notifications (user_id, type, message, metadata)
  values (
    v_course.instructor_id,
    'enrollment_request',
    v_student_name || ' requested to enrol in "' || v_course.title || '"',
    jsonb_build_object('enrollment_id', v_row.id, 'course_id', v_course.id)
  );

  return v_row;
end;
$$;

-- Instructor approves or declines. Approval pays the instructor and grants XP;
-- a decline refunds the student.
create or replace function decide_enrollment(p_enrollment_id uuid, p_approve boolean)
returns enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row enrollments;
  v_course courses;
begin
  select * into v_row from enrollments where id = p_enrollment_id;
  if not found then
    raise exception 'enrollment not found';
  end if;
  if v_row.instructor_id <> auth.uid() then
    raise exception 'only the instructor can decide this enrollment';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'enrollment already decided';
  end if;

  select * into v_course from courses where id = v_row.course_id;

  if p_approve then
    update enrollments
       set status = 'approved', decided_at = now(), next_lesson = 'Lesson 1'
     where id = p_enrollment_id
    returning * into v_row;

    update courses set students_count = students_count + 1 where id = v_row.course_id;

    if v_row.credit_fee > 0 then
      perform adjust_credits(
        v_row.instructor_id, v_row.credit_fee, 'teaching_earning',
        'Enrollment approved: ' || v_course.title, v_course.id
      );
    end if;

    perform award_xp(v_row.instructor_id, 50);

    insert into notifications (user_id, type, message, metadata)
    values (
      v_row.student_id, 'enrollment_approved',
      '✅ Your enrollment in "' || v_course.title || '" was approved.',
      jsonb_build_object('course_id', v_course.id)
    );
  else
    update enrollments
       set status = 'declined', decided_at = now()
     where id = p_enrollment_id
    returning * into v_row;

    if v_row.credit_fee > 0 then
      perform adjust_credits(
        v_row.student_id, v_row.credit_fee, 'refund',
        'Refund for declined enrollment: ' || v_course.title, v_course.id
      );
    end if;

    insert into notifications (user_id, type, message, metadata)
    values (
      v_row.student_id, 'enrollment_declined',
      'Your enrollment request for "' || v_course.title || '" was declined and your credits were refunded.',
      jsonb_build_object('course_id', v_course.id)
    );
  end if;

  return v_row;
end;
$$;

create or replace function set_enrollment_progress(
  p_enrollment_id uuid,
  p_progress      integer,
  p_next_lesson   text default null
)
returns enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row enrollments;
begin
  update enrollments
     set progress = least(100, greatest(0, p_progress)),
         next_lesson = coalesce(p_next_lesson, next_lesson)
   where id = p_enrollment_id
     and student_id = auth.uid()
     and status in ('approved', 'completed')
  returning * into v_row;

  if not found then
    raise exception 'enrollment not found for this student';
  end if;

  return v_row;
end;
$$;

create or replace function complete_enrollment(p_enrollment_id uuid)
returns enrollments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row enrollments;
  v_course courses;
begin
  select * into v_row from enrollments
   where id = p_enrollment_id and student_id = auth.uid();
  if not found then
    raise exception 'enrollment not found for this student';
  end if;
  if v_row.status = 'completed' then
    return v_row;
  end if;
  if v_row.status <> 'approved' then
    raise exception 'enrollment is not active';
  end if;

  select * into v_course from courses where id = v_row.course_id;

  update enrollments
     set status = 'completed', progress = 100, completed_at = now(), next_lesson = 'Course complete'
   where id = p_enrollment_id
  returning * into v_row;

  perform award_xp(v_row.student_id, 250);
  perform adjust_credits(
    v_row.student_id, 10, 'course_completion_bonus',
    'Completion bonus: ' || v_course.title, v_course.id
  );

  insert into notifications (user_id, type, message, metadata)
  values (
    v_row.student_id, 'credit_earned',
    '🏆 Course complete: "' || v_course.title || '". +250 XP and +10 credits.',
    jsonb_build_object('course_id', v_course.id)
  );

  return v_row;
end;
$$;

-- ---------------------------------------------------------------- publishing

create or replace function record_skill_test(
  p_category text,
  p_score    integer,
  p_total    integer
)
returns skill_test_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row skill_test_attempts;
begin
  insert into skill_test_attempts (user_id, category, score, total, passed)
  values (auth.uid(), p_category, p_score, p_total, p_score * 2 >= p_total)
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------- leaderboard

create or replace view leaderboard_users
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.email,
  p.avatar_url,
  p.role,
  p.department,
  p.level,
  p.level_title,
  p.xp_points,
  p.badges,
  coalesce(taught.count, 0)::integer     as courses_taught_count,
  coalesce(completed.count, 0)::integer  as courses_completed_count,
  coalesce(earned.total, 0)::integer     as credits_earned
from profiles p
left join lateral (
  select count(*) as count from courses c
   where c.instructor_id = p.id and c.published
) taught on true
left join lateral (
  select count(*) as count from enrollments e
   where e.student_id = p.id and e.status = 'completed'
) completed on true
left join lateral (
  select sum(t.amount) as total from credit_transactions t
   where t.user_id = p.id and t.amount > 0
     and t.reason in ('teaching_earning', 'course_completion_bonus')
) earned on true;

-- ============================================================
-- supabase/migrations/0003_policies.sql
-- ============================================================

-- Row Level Security. Everything is deny-by-default; tables with no policy
-- below (secrets, OAuth tokens) are reachable only by the service role from
-- Edge Functions.

alter table profiles                enable row level security;
alter table courses                 enable row level security;
alter table course_lessons          enable row level security;
alter table enrollments             enable row level security;
alter table topic_quiz_questions    enable row level security;
alter table skill_test_attempts     enable row level security;
alter table credit_transactions     enable row level security;
alter table payments                enable row level security;
alter table live_sessions           enable row level security;
alter table google_oauth_tokens     enable row level security;
alter table notifications           enable row level security;
alter table two_factor_settings     enable row level security;
alter table two_factor_secrets      enable row level security;
alter table two_factor_backup_codes enable row level security;
alter table trusted_devices         enable row level security;

-- ---------------------------------------------------------------- profiles

-- Profiles are public within the app: the marketplace and leaderboard show
-- every user's name, avatar, level and department.
create policy "profiles are readable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "users update their own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- credits / xp / level / badges are wallet+progression state owned by the
-- SECURITY DEFINER functions. Revoke them from direct client updates.
revoke update (credits, xp_points, level, level_title, badges) on profiles from authenticated;

-- ---------------------------------------------------------------- courses

create policy "published courses are readable"
  on courses for select
  to authenticated
  using (published or instructor_id = auth.uid());

create policy "instructors create their own courses"
  on courses for insert
  to authenticated
  with check (instructor_id = auth.uid());

create policy "instructors update their own courses"
  on courses for update
  to authenticated
  using (instructor_id = auth.uid())
  with check (instructor_id = auth.uid());

create policy "instructors delete their own courses"
  on courses for delete
  to authenticated
  using (instructor_id = auth.uid());

revoke update (students_count) on courses from authenticated;

create policy "lessons follow their course"
  on course_lessons for select
  to authenticated
  using (
    exists (select 1 from courses c where c.id = course_id and (c.published or c.instructor_id = auth.uid()))
  );

create policy "instructors manage their lessons"
  on course_lessons for all
  to authenticated
  using (exists (select 1 from courses c where c.id = course_id and c.instructor_id = auth.uid()))
  with check (exists (select 1 from courses c where c.id = course_id and c.instructor_id = auth.uid()));

-- ---------------------------------------------------------------- enrollments

-- Read-only for clients; every mutation goes through the RPCs in 0002 so that
-- credits and notifications stay consistent.
create policy "students and instructors read their enrollments"
  on enrollments for select
  to authenticated
  using (student_id = auth.uid() or instructor_id = auth.uid());

-- ---------------------------------------------------------------- quizzes

create policy "quiz bank is readable"
  on topic_quiz_questions for select
  to authenticated
  using (true);

create policy "users read their own attempts"
  on skill_test_attempts for select
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------- wallet & payments

create policy "users read their own ledger"
  on credit_transactions for select
  to authenticated
  using (user_id = auth.uid());

create policy "users read their own payments"
  on payments for select
  to authenticated
  using (user_id = auth.uid());

-- Orders are created and settled by the Razorpay Edge Functions (service role).

-- ---------------------------------------------------------------- live sessions

create policy "course members read sessions"
  on live_sessions for select
  to authenticated
  using (
    instructor_id = auth.uid()
    or exists (
      select 1 from enrollments e
       where e.course_id = live_sessions.course_id
         and e.student_id = auth.uid()
         and e.status in ('approved', 'completed')
    )
  );

-- Session rows are written by the google-meet Edge Function (service role),
-- which holds the Calendar credentials.

-- google_oauth_tokens: intentionally no policy. Service role only.

-- ---------------------------------------------------------------- notifications

create policy "users read their own notifications"
  on notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "users mark their notifications read"
  on notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete their own notifications"
  on notifications for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------- 2FA

create policy "users read their 2FA settings"
  on two_factor_settings for select
  to authenticated
  using (user_id = auth.uid());

create policy "users update their 2FA settings"
  on two_factor_settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- two_factor_secrets: intentionally no policy. TOTP secrets never leave the
-- server; enrollment and verification run in an Edge Function.

-- Backup codes: the user may see which codes remain unused, never the hashes'
-- plaintext (only hashes are stored) and never another user's rows.
create policy "users read their backup codes"
  on two_factor_backup_codes for select
  to authenticated
  using (user_id = auth.uid());

create policy "users manage their trusted devices"
  on trusted_devices for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------- rpc grants

revoke execute on function adjust_credits(uuid, integer, credit_reason, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function award_xp(uuid, integer) from public, anon, authenticated;

grant execute on function request_enrollment(uuid)                       to authenticated;
grant execute on function decide_enrollment(uuid, boolean)               to authenticated;
grant execute on function set_enrollment_progress(uuid, integer, text)   to authenticated;
grant execute on function complete_enrollment(uuid)                      to authenticated;
grant execute on function record_skill_test(text, integer, integer)      to authenticated;
grant execute on function ensure_profile()                               to authenticated;

-- ============================================================
-- supabase/seed.sql
-- ============================================================

-- Seed data that does not depend on a real auth user.
-- Course/profile demo rows are intentionally omitted: profiles.id is a FK to
-- auth.users, so create those by signing up through the app.

insert into topic_quiz_questions (category, question, options, correct_answer) values
  ('Engineering',
   'Which HTTP header is primarily used to transmit JWT authentication tokens securely?',
   array['Content-Type', 'Authorization', 'X-Auth-Scope', 'Cache-Control'], 1),
  ('Engineering',
   'What is the key advantage of using Express middleware functions in Node.js?',
   array[
     'They compile TypeScript to C++',
     'They process, transform, or validate requests sequentially before route handlers',
     'They eliminate database queries entirely',
     'They automatically double server memory'
   ], 1),
  ('Security',
   'How does Time-based One-Time Password (TOTP) authentication function?',
   array[
     'It calculates a unique 6-digit hash from a shared secret key and current 30-second UNIX timestamp',
     'It sends a plain text email every 5 minutes',
     'It scans the user fingerprint remotely',
     'It encrypts browser cookies'
   ], 0),
  ('Security',
   'Why are offline Backup Recovery Codes essential when configuring VaultShield 2FA?',
   array[
     'To speed up website graphics rendering',
     'They provide one-time emergency access if the user loses their smartphone or authenticator app',
     'They decrease memory usage on servers',
     'They change user avatar photos'
   ], 1)
on conflict do nothing;
