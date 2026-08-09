import type { Session, User } from '@supabase/supabase-js';
import { appUrl, supabase } from '../lib/supabase';
import type { UserRole } from '../lib/database.types';

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  department?: string;
  role?: UserRole;
}

export interface SignUpResult {
  user: User | null;
  /** True when Supabase sent a confirmation mail and there is no session yet. */
  needsEmailVerification: boolean;
}

/**
 * Email + password registration. The `handle_new_user` trigger creates the
 * profile, 2FA row, welcome credits and welcome notification server-side, so
 * nothing else needs writing here.
 *
 * With "Confirm email" enabled in Supabase Auth (recommended), no session is
 * returned until the user clicks the link in their inbox.
 */
export async function signUpWithEmail(input: SignUpInput): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      emailRedirectTo: appUrl('/auth/callback'),
      data: {
        name: input.name.trim(),
        department: input.department?.trim() ?? '',
        role: input.role ?? 'Student',
      },
    },
  });
  if (error) throw error;

  return { user: data.user, needsEmailVerification: !data.session };
}

export async function signInWithEmail(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data.session;
}

/**
 * Google OAuth. Redirects the browser to Google; the session lands back on
 * /auth/callback where `detectSessionInUrl` completes the PKCE exchange.
 *
 * `access_type: offline` + `prompt: consent` are what make Google return a
 * refresh token — required later for the Calendar/Meet integration.
 */
export async function signInWithGoogle(options?: { requestCalendarScope?: boolean }) {
  const scopes = ['email', 'profile'];
  if (options?.requestCalendarScope) {
    scopes.push('https://www.googleapis.com/auth/calendar.events');
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: appUrl('/auth/callback'),
      scopes: scopes.join(' '),
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Re-sends the confirmation mail for an address that never verified. */
export async function resendVerificationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: appUrl('/auth/callback') },
  });
  if (error) throw error;
}

/** Step 1 of password reset: mail the user a recovery link. */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: appUrl('/auth/reset-password'),
  });
  if (error) throw error;
}

/**
 * Step 2 of password reset: called on the /auth/reset-password screen, once
 * the recovery link has established a temporary session.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Changing the account email re-triggers verification on the new address. */
export async function changeEmail(newEmail: string): Promise<void> {
  const { error } = await supabase.auth.updateUser(
    { email: newEmail.trim().toLowerCase() },
    { emailRedirectTo: appUrl('/auth/callback') },
  );
  if (error) throw error;
}

/**
 * Confirms the given password is correct for the signed-in user's email by
 * re-authenticating with it. `updateUser` doesn't check the current password
 * on its own, so this is the only way to catch a wrong one before saving.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  return !error;
}

/** Permanently deletes the signed-in user's account and all their data. */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function isEmailVerified(user: User | null): boolean {
  return Boolean(user?.email_confirmed_at ?? user?.confirmed_at);
}

/**
 * Supabase surfaces the Google provider tokens exactly once, on the sign-in
 * event right after the OAuth redirect. Hand them to the Edge Function while
 * we still have them, or the Meet integration has nothing to call Calendar
 * with. Failures are non-fatal: the user is signed in either way.
 */
async function captureGoogleTokens(session: Session): Promise<void> {
  if (!session.provider_token) return;
  try {
    await supabase.functions.invoke('google-oauth-store', {
      body: {
        providerToken: session.provider_token,
        providerRefreshToken: session.provider_refresh_token,
        expiresIn: session.expires_in,
        scope: 'https://www.googleapis.com/auth/calendar.events',
      },
    });
  } catch (err) {
    console.warn('[skillvo] could not persist Google credentials', err);
  }
}

/**
 * Subscribe to sign-in / sign-out / token-refresh. Returns an unsubscribe
 * function suitable for a `useEffect` cleanup.
 */
export function onAuthStateChange(
  handler: (session: Session | null, event: string) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) void captureGoogleTokens(session);
    handler(session, event);
  });
  return () => data.subscription.unsubscribe();
}
