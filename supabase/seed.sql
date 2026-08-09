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
