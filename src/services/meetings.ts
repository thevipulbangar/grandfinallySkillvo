/**
 * Live sessions — the teacher pastes their own Google Meet link along with
 * when it starts, and it shows up for enrolled students until the session
 * expires. This is a plain client-side insert (RLS checks the instructor
 * owns the course); there is no Google Calendar integration involved.
 *
 * Rows older than 24 hours past their start time are removed server-side by
 * a scheduled job (see supabase/migrations/0010_manual_meet_links.sql), so
 * an expired link simply disappears from `listCourseSessions` on its own.
 */
import { supabase } from '../lib/supabase';
import type { LiveSession, SessionKind } from '../types';
import { toLiveSession } from './mappers';

const GOOGLE_MEET_URL = /^https:\/\/meet\.google\.com\/[a-z0-9-]+$/i;

export function isValidMeetUrl(url: string): boolean {
  return GOOGLE_MEET_URL.test(url.trim());
}

export interface UploadMeetLinkInput {
  courseId: string;
  instructorId: string;
  title: string;
  meetUrl: string;
  kind: SessionKind;
  startsAt: Date;
  durationMinutes: number;
}

/** Teacher-uploaded Meet link for a single session — no Calendar API involved. */
export async function uploadMeetLink(input: UploadMeetLinkInput): Promise<LiveSession> {
  if (!isValidMeetUrl(input.meetUrl)) {
    throw new Error('Enter a valid Google Meet link, e.g. https://meet.google.com/abc-defg-hij');
  }
  const { data, error } = await supabase
    .from('live_sessions')
    .insert({
      course_id: input.courseId,
      instructor_id: input.instructorId,
      title: input.title,
      meet_url: input.meetUrl.trim(),
      kind: input.kind,
      starts_at: input.startsAt.toISOString(),
      ends_at: new Date(input.startsAt.getTime() + input.durationMinutes * 60_000).toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return toLiveSession(data);
}

export async function listCourseSessions(courseId: string, kind?: SessionKind): Promise<LiveSession[]> {
  let query = supabase.from('live_sessions').select('*').eq('course_id', courseId);
  if (kind) query = query.eq('kind', kind);

  const { data, error } = await query.order('starts_at');
  if (error) throw error;
  return (data ?? []).map(toLiveSession);
}

/** Sessions that have not finished yet, for one course. */
export async function listUpcomingCourseSessions(courseId: string): Promise<LiveSession[]> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('course_id', courseId)
    .gte('ends_at', new Date().toISOString())
    .order('starts_at');
  if (error) throw error;
  return (data ?? []).map(toLiveSession);
}

/** Sessions across every course the signed-in user teaches or is enrolled in. */
export async function listUpcomingSessions(): Promise<LiveSession[]> {
  const { data, error } = await supabase
    .from('live_sessions')
    .select('*')
    .gte('ends_at', new Date().toISOString())
    .order('starts_at');
  if (error) throw error;
  return (data ?? []).map(toLiveSession);
}

export async function cancelSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('live_sessions').delete().eq('id', sessionId);
  if (error) throw error;
}

/** A session is joinable from 10 minutes before it starts until it ends. */
export function isJoinable(session: LiveSession, now = Date.now()): boolean {
  const start = new Date(session.startsAt).getTime();
  const end = new Date(session.endsAt).getTime();
  return now >= start - 10 * 60_000 && now <= end;
}
