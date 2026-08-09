// Google Calendar / Meet access shared by google-meet-create and
// sunday-sessions-ensure. Both need the same two things: a non-expired access
// token for the instructor, and "create an event that has a Meet link".

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

interface TokenRow {
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
}

/**
 * Current access token for `userId`, refreshing it first if it is close to
 * expiry. Throws a 428 Response when the instructor has never connected
 * Google or the refresh token has been revoked — the client treats that as
 * "prompt connectGoogleCalendar() and retry".
 */
export async function freshAccessToken(db: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await db
    .from('google_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle<TokenRow>();

  if (error) throw error;
  if (!data) throw new Response('google_not_connected', { status: 428 });

  // Refresh a minute early to avoid racing the expiry.
  if (new Date(data.expires_at).getTime() - Date.now() > 60_000) return data.access_token;
  if (!data.refresh_token) throw new Response('google_reauth_required', { status: 428 });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    console.error('google token refresh failed', await res.text());
    throw new Response('google_reauth_required', { status: 428 });
  }

  const token = await res.json();
  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();
  await db
    .from('google_oauth_tokens')
    .update({ access_token: token.access_token, expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  return token.access_token;
}

export interface MeetEventInput {
  summary: string;
  description: string;
  startsAt: string;
  endsAt: string;
  attendees: string[];
}

export interface MeetEvent {
  eventId: string;
  meetUrl: string | null;
}

/** Creates a Calendar event carrying a Meet conference and invites attendees. */
export async function createMeetEvent(accessToken: string, input: MeetEventInput): Promise<MeetEvent> {
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events' +
      '?conferenceDataVersion=1&sendUpdates=all',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startsAt },
        end: { dateTime: input.endsAt },
        attendees: input.attendees.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    },
  );

  if (!res.ok) {
    console.error('calendar insert failed', await res.text());
    throw new Response('calendar_rejected', { status: 502 });
  }

  const event = await res.json();
  const meetUrl: string | null =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((e: { entryPointType: string }) => e.entryPointType === 'video')?.uri ??
    null;

  return { eventId: event.id, meetUrl };
}

/** Emails of every student whose enrollment gives them access to the course. */
export async function courseAttendees(db: SupabaseClient, courseId: string): Promise<string[]> {
  const { data } = await db
    .from('enrollments')
    .select('student:profiles!enrollments_student_id_fkey (email)')
    .eq('course_id', courseId)
    .in('status', ['approved', 'completed']);

  return (data ?? [])
    .map((row: { student?: { email?: string } | null }) => row.student?.email)
    .filter((email): email is string => Boolean(email));
}

/** Student ids for the same set — used to fan out notifications. */
export async function courseStudentIds(db: SupabaseClient, courseId: string): Promise<string[]> {
  const { data } = await db
    .from('enrollments')
    .select('student_id')
    .eq('course_id', courseId)
    .in('status', ['approved', 'completed']);

  return (data ?? []).map((row: { student_id: string }) => row.student_id);
}
