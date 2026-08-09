-- Teacher-uploaded Google Meet links.
--
-- Live sessions used to be created only by the sunday-sessions-ensure /
-- google-meet-create Edge Functions (service role), so live_sessions never
-- got an INSERT policy. Teachers now paste their own Meet link straight from
-- the Course Manage page, so they need one. A scheduled job then deletes each
-- session 24 hours after its start time, Meet link included.

create policy "instructors create their sessions"
  on live_sessions for insert
  to authenticated
  with check (teaches_course(course_id) and instructor_id = auth.uid());

-- ---------------------------------------------------------------- expiry

create extension if not exists pg_cron with schema pg_catalog;

-- Re-running this migration should replace the job, not stack a duplicate.
do $$
begin
  perform cron.unschedule('expire-live-sessions');
exception when others then
  null; -- no existing job with this name
end $$;

select cron.schedule(
  'expire-live-sessions',
  '*/30 * * * *',
  $$delete from public.live_sessions where starts_at < now() - interval '24 hours';$$
);
