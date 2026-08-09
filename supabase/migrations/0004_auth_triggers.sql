-- Triggers on auth.users. Kept apart from 0001-0003 because creating them
-- requires ownership of auth.users, which the SQL editor's role does not have
-- on every Supabase project. If this file fails with
--
--   ERROR: 42501: must be owner of relation users
--
-- that is survivable: skip it. The app calls the `ensure_profile()` RPC after
-- sign-in, which provisions the same profile + welcome credits on first use.
-- Run it if you can, though — it is the tidier path, and it also keeps
-- profiles.email in step when a user changes their login address.

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function handle_user_email_change();
