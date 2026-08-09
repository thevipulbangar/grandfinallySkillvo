// Permanently deletes the calling user's account.
// Deploy: supabase functions deploy delete-account
//
// `profiles.id` references `auth.users (id) on delete cascade`, and every
// other table (courses, enrollments, payments, notifications, ...) cascades
// from `profiles`, so deleting the auth user is enough to remove everything.

import { json, preflight } from '../_shared/cors.ts';
import { requireUser, serviceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    const user = await requireUser(req);
    const db = serviceClient();

    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return json({ error: 'Could not delete account.' }, 500);
  }
});
