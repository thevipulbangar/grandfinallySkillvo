import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * True once real credentials are present in .env.local. Until then the app can
 * keep running on its mock data instead of crashing at import time.
 */
export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes('YOUR_') && !anonKey.includes('YOUR_'),
);

if (!isSupabaseConfigured) {
  console.warn(
    '[skillvo] Supabase is not configured. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in .env.local — running on mock data until then.',
  );
}

// Deliberately un-annotated: SupabaseClient's later type parameters must be
// inferred from createClient, or the schema resolves to `never`.
export const supabase = createClient<Database>(
  url || 'http://localhost:54321',
  anonKey || 'public-anon-key-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Required so the ?code= in OAuth / email-verification / password-reset
      // redirects is exchanged for a session automatically.
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'skillvo.auth',
    },
  },
);

/** Absolute URL used for OAuth and email redirect targets. */
export function appUrl(path = ''): string {
  const base = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
  return path ? `${base}${path.startsWith('/') ? path : `/${path}`}` : base;
}

/** Normalises Supabase/Postgres errors into a message fit for a toast. */
export function toFriendlyError(error: unknown): string {
  if (!error) return 'Something went wrong. Please try again.';
  const message = typeof error === 'string' ? error : (error as { message?: string }).message ?? '';

  if (message.includes('insufficient credits')) return 'Not enough credits in your wallet.';
  if (message.includes('duplicate key') && message.includes('enrollments')) {
    return 'You have already requested this course.';
  }
  if (message.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (message.includes('Email not confirmed')) {
    return 'Please verify your email address first — check your inbox.';
  }
  if (message.includes('User already registered')) return 'An account with this email already exists.';
  if (message.toLowerCase().includes('rate limit')) return 'Too many attempts. Please wait a minute.';

  return message || 'Something went wrong. Please try again.';
}
