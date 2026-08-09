import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/** Bypasses RLS. Only ever used after the caller's JWT has been verified. */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** An anon-key client scoped to the caller's JWT — reads/writes go through RLS as that user. */
export function userClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Response('Missing Authorization header', { status: 401 });

  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
}

/** Resolves the calling user from the request's Authorization header. */
export async function requireUser(req: Request) {
  const client = userClient(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Response('Unauthorized', { status: 401 });
  return data.user;
}
