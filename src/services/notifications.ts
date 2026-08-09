import { supabase } from '../lib/supabase';
import type { NotificationRow } from '../lib/database.types';

export async function listNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ unread: false })
    .eq('user_id', userId)
    .eq('unread', true);
  if (error) throw error;
}

export async function markRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ unread: false })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function dismiss(notificationId: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
  if (error) throw error;
}

/** Realtime bell: fires for every notification row inserted for this user. */
export function subscribeToNotifications(
  userId: string,
  onInsert: (row: NotificationRow) => void,
): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onInsert(payload.new as NotificationRow),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
