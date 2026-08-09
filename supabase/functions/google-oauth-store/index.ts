// Persists the Google provider tokens returned to the client after an OAuth
// sign-in that included the Calendar scope.
// Deploy: supabase functions deploy google-oauth-store
//
// Supabase hands `provider_token` / `provider_refresh_token` to the browser
// once, on the callback, and never again — so the client posts them here
// immediately and they live in a table no client can read.

import { json, preflight } from '../_shared/cors.ts';
import { requireUser, serviceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    const user = await requireUser(req);
    const { providerToken, providerRefreshToken, expiresIn, scope } = await req.json();
    if (!providerToken) return json({ error: 'Missing provider token.' }, 400);

    const db = serviceClient();
    const expiresAt = new Date(Date.now() + (Number(expiresIn) || 3600) * 1000).toISOString();

    // Google only returns a refresh token on first consent; keep the stored one
    // when this sign-in did not include a fresh one.
    const { data: existing } = await db
      .from('google_oauth_tokens')
      .select('refresh_token')
      .eq('user_id', user.id)
      .maybeSingle();

    const { error } = await db.from('google_oauth_tokens').upsert({
      user_id: user.id,
      access_token: providerToken,
      refresh_token: providerRefreshToken ?? existing?.refresh_token ?? null,
      scope: scope ?? '',
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    return json({ ok: true });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return json({ error: 'Could not store Google credentials.' }, 500);
  }
});
