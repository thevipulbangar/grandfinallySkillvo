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
