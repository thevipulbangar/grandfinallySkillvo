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
