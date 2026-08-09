-- DESTRUCTIVE. Drops everything in the public schema and recreates it empty.
-- Use when a partial migration run left the database in an unknown state.
--
-- auth.users is in a different schema and survives this, so any accounts you
-- already created stay — but their profiles/courses/credits do not. On a fresh
-- project that is exactly what you want; on a live one it is data loss.

-- The signup triggers live on auth.users, outside the schema being dropped.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_email_changed on auth.users;

drop schema public cascade;
create schema public;

-- Restore the grants Supabase expects on a fresh public schema.
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
