# Skillvo backend (Supabase)

The React app in `src/` talks to Postgres through `src/services/*`. Secrets
(Razorpay key secret, Google client secret) never reach the browser — they live
in Edge Functions.

```
supabase/
  migrations/0001_init.sql       tables, enums, indexes
  migrations/0002_functions.sql  signup trigger, credit/enrollment RPCs, leaderboard view
  migrations/0003_policies.sql   row level security
  migrations/0007_course_content.sql
                                 Sunday schedules, study material, recorded
                                 lectures, Storage buckets and their RLS
  seed.sql                       skill-test question bank
  functions/                     Deno Edge Functions (Razorpay, Google Meet)
src/lib/supabase.ts              browser client
src/lib/database.types.ts        row types
src/services/                    auth, profiles, courses, enrollments,
                                 notifications, leaderboard, payments, meetings,
                                 schedules, courseContent
src/components/                  CourseContentManager (teacher),
                                 CourseClassroom (student)
```

## 1. Create the project

1. Create a project at <https://supabase.com/dashboard>.
2. Copy **Project URL** and **anon public key** from Settings → API into
   `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3. Until those are filled in, `isSupabaseConfigured` is `false` and the app logs
   a warning instead of crashing.

## 2. Apply the schema

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push          # runs migrations/ in order
npx supabase db execute --file supabase/seed.sql
```

Or paste the three migration files into the SQL editor, in numeric order.

Local instead of hosted: `npx supabase start`, then `npx supabase db reset`
(applies migrations + seed automatically). Mail goes to
<http://localhost:54324>.

## 3. Email verification & password reset

Authentication → Providers → Email:

- **Confirm email: ON**. `signUpWithEmail` then returns
  `needsEmailVerification: true` and no session — show a "check your inbox"
  screen. `resendVerificationEmail(email)` re-sends.
- **Secure email change: ON** so `changeEmail()` verifies the new address.

Authentication → URL Configuration:

- Site URL: your app origin (`http://localhost:3000` in dev).
- Redirect URLs: add `<origin>/auth/callback` and `<origin>/auth/reset-password`
  for every origin you use, dev and prod. A redirect that is not on this list is
  silently dropped and the user lands on the site root with no session.

Reset flow: `sendPasswordResetEmail(email)` → user clicks the mail →
lands on `/auth/reset-password` with a temporary session → that screen calls
`updatePassword(newPassword)`.

## 4. Google OAuth

1. Google Cloud Console → Credentials → your OAuth client. Add the authorised
   redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`
   (`http://localhost:54321/auth/v1/callback` for local).
2. Supabase → Authentication → Providers → Google: paste the client ID and
   client secret, enable.
3. `signInWithGoogle()` handles the rest. `handle_new_user` provisions the
   profile from Google's `full_name` / `picture` metadata, so OAuth users and
   password users end up identical.

The existing client ID in `firebase-applet-config.json`
(`682174089595-…apps.googleusercontent.com`) can be reused — just add the
Supabase callback URI to it.

## 5. Razorpay

```bash
npx supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx
npx supabase functions deploy razorpay-create-order
npx supabase functions deploy razorpay-verify-payment
```

Put the **key id** (not the secret) in `VITE_RAZORPAY_KEY_ID`.

Credit packs are defined **inside** `razorpay-create-order/index.ts`, not sent
from the browser, so the price cannot be tampered with. Edit `CREDIT_PACKS`
there to change pricing, and keep the wallet UI in sync.

`purchaseCredits(pack, buyer)` runs the whole flow: create order → open
Checkout → verify signature → credits land in the wallet. Verification is
idempotent, so a replayed response never double-credits.

## 6. Live sessions (teacher-uploaded Meet links)

No Edge Function, no Google OAuth — a teacher starts their own Google Meet
call, then pastes the link into *Course Manage → Live sessions* along with a
date, start time and duration. `uploadMeetLink()` inserts straight into
`live_sessions` from the browser; the `"instructors create their sessions"`
policy (`0010_manual_meet_links.sql`) checks `teaches_course(course_id)` so a
teacher can only write sessions for their own courses.

Enrolled students see the same row via the existing `live_sessions` SELECT
policy — nothing else changes for them.

**Expiry.** A `pg_cron` job (also in `0010_manual_meet_links.sql`) runs every
30 minutes and deletes any session more than 24 hours past its `starts_at`,
Meet link included:

```sql
delete from public.live_sessions where starts_at < now() - interval '24 hours';
```

`pg_cron` must be enabled for this to run — on hosted Supabase it's on by
default; for `supabase start` locally, add `pg_cron` under `[db.pooler]`/
extensions in `config.toml` or enable it via the Studio Database → Extensions
page before running `db reset`.

`google-meet-create` and `sunday-sessions-ensure` (recurring Sunday classes
via the Calendar API, gated on `connectGoogleCalendar()`) still exist in
`supabase/functions/` and `services/schedules.ts` for reference, but nothing
in the UI calls them anymore — the manual upload flow above replaced them.

**Files.** Two *private* buckets, created by the migration:

| Bucket | Limit | Holds |
| --- | --- | --- |
| `course-materials` | 50 MB | PDFs, slides, notes, images |
| `course-videos` | 2 GB | recorded lectures |

Object keys are `<course_id>/<uuid>-<filename>`. **That shape is load-bearing**
— the Storage policies read the first path segment as the course id to decide
who may read an object, so writing to a different layout silently breaks
access control. Nothing is public: readers get a signed URL valid for one
hour, minted only if `is_enrolled_in()` or `teaches_course()` passes. A student
whose enrollment is still `pending` sees nothing, and a leaked URL dies within
the hour.

Unpublished lectures (`course_videos.published = false`) are invisible to
students at the RLS level, which is what makes "upload now, release later"
trustworthy rather than cosmetic.

**Notifications.** `notifications` has no client INSERT policy, so publishing
goes through `notify_course_students(course_id, type, message, metadata)` — a
SECURITY DEFINER function that refuses any caller who does not teach the course
and any type other than `material_published` / `lecture_published`.

## Design notes

**Credits only move through `adjust_credits`.** Direct `UPDATE` of
`profiles.credits` is revoked from the `authenticated` role; every movement
writes a `credit_transactions` ledger row, and the balance cannot go negative.
Same for `xp_points` / `level` (`award_xp`) and `courses.students_count`.

**Enrollment is an RPC, not an insert.** `request_enrollment` debits the
student, creates the row and notifies the instructor in one transaction.
`decide_enrollment` awards the instructor XP on approval or refunds the
student on decline — it does not pay out credits. That happens in
`complete_enrollment`, alongside the student's own completion bonus, so an
instructor is only paid once a student actually finishes the course.
`enrollments` therefore has a SELECT policy only.

**Tables with no RLS policy are service-role only** — by design, not oversight:
`two_factor_secrets` (TOTP seeds) and `google_oauth_tokens` (refresh tokens)
must never be readable by a browser, even the owner's.

## Regenerating types

```bash
npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
```

Keep the row types as `type` aliases, not `interface` — supabase-js requires an
implicit index signature, and interfaces do not have one (the schema silently
degrades to `never` and every query loses its types).
