import { supabase } from '../lib/supabase';
import type { CreditTransactionRow, ProfileRow } from '../lib/database.types';
import type { UserProfile } from '../types';
import { toUserProfile } from './mappers';

/**
 * Guarantees the signed-in user has a profile row.
 *
 * Normally the `on_auth_user_created` trigger has already done this. On
 * projects where that trigger could not be installed (creating it needs
 * ownership of auth.users), this RPC provisions the profile, welcome credits
 * and welcome notification on first sign-in instead. Idempotent — safe to call
 * on every sign-in.
 */
export async function ensureProfile(): Promise<ProfileRow> {
  const { data, error } = await supabase.rpc('ensure_profile');
  if (error) throw error;
  return data as ProfileRow;
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Everything App.tsx needs for `currentUser` in one round trip: the profile,
 * the user's enrollments, and their notifications.
 */
export async function getCurrentUserProfile(userId: string): Promise<UserProfile | null> {
  const [profileRes, enrollmentsRes, notificationsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('enrollments').select('*').eq('student_id', userId).order('requested_at', { ascending: false }),
    supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (enrollmentsRes.error) throw enrollmentsRes.error;
  if (notificationsRes.error) throw notificationsRes.error;
  if (!profileRes.data) return null;

  return toUserProfile(profileRes.data, enrollmentsRes.data ?? [], notificationsRes.data ?? []);
}

export interface ProfileUpdate {
  name?: string;
  email?: string;
  avatar_url?: string;
  department?: string;
  title?: string;
  bio?: string;
}

/**
 * Note: this writes the *profile* email only. Changing the login email goes
 * through `changeEmail()` in services/auth so it gets re-verified.
 */
export async function updateProfile(userId: string, patch: ProfileUpdate): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function listCreditTransactions(userId: string, limit = 50): Promise<CreditTransactionRow[]> {
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Live wallet balance updates (credit purchases settle asynchronously). */
export function subscribeToProfile(userId: string, onChange: (row: ProfileRow) => void): () => void {
  const channel = supabase
    .channel(`profile:${userId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
      (payload) => onChange(payload.new as ProfileRow),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
