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
