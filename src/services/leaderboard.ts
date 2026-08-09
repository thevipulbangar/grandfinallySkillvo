import { supabase } from '../lib/supabase';
import type { LeaderboardUser } from '../types';
import { toLeaderboardUser } from './mappers';

export type LeaderboardFilter = 'all' | 'teachers' | 'students';

/**
 * Each tab ranks on the XP that tab is about: teachers by teaching XP,
 * students by learning XP, and the combined board by total XP. Ranking every
 * tab on the total would let a prolific student outrank teachers on the
 * teaching board, and vice versa.
 */
export async function listLeaderboard(filter: LeaderboardFilter = 'all', limit = 50): Promise<LeaderboardUser[]> {
  let query = supabase.from('leaderboard_users').select('*');
  let sortColumn: 'xp_points' | 'teaching_xp' | 'learning_xp' = 'xp_points';

  if (filter === 'teachers') {
    query = query.in('role', ['Teacher', 'Master Educator']);
    sortColumn = 'teaching_xp';
  }
  if (filter === 'students') {
    query = query.eq('role', 'Student');
    sortColumn = 'learning_xp';
  }

  const { data, error } = await query.order(sortColumn, { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(toLeaderboardUser);
}
