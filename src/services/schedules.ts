/**
 * Weekly Sunday slots and the sessions generated from them.
 *
 * A teacher sets one slot per course per kind ("Sundays 10:00, 60 min"); the
 * `sunday-sessions-ensure` Edge Function turns that into real Google Meet
 * links for the next few Sundays. Meet links can only be minted server-side —
 * they need the instructor's Calendar refresh token — so the client's job is
 * to store the slot and ask for a top-up.
 */
import { supabase } from '../lib/supabase';
import type { CourseSchedule, LiveSession, SessionKind } from '../types';
import { toCourseSchedule, toLiveSession } from './mappers';

/** 0 = Sunday. The schema rejects anything else; this is here for readability. */
export const SUNDAY = 0;

export interface ScheduleInput {
  courseId: string;
  kind: SessionKind;
  /** 'HH:MM' in `timezone`. */
  startTime: string;
  durationMinutes: number;
  title?: string;
  /** IANA zone; defaults to whatever the teacher's browser reports. */
  timezone?: string;
}

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
}

/** True when `date` falls on a Sunday in the given zone. */
export function isSunday(date: Date, timezone = browserTimezone()): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(date);
  return weekday === 'Sun';
}

export async function listSchedules(courseId: string): Promise<CourseSchedule[]> {
  const { data, error } = await supabase
    .from('course_schedules')
    .select('*')
    .eq('course_id', courseId)
    .order('kind');
  if (error) throw error;
  return (data ?? []).map(toCourseSchedule);
}

/**
 * Creates or replaces the slot for (course, kind). The unique constraint makes
 * this a genuine upsert rather than a read-then-write race.
 */
export async function saveSchedule(instructorId: string, input: ScheduleInput): Promise<CourseSchedule> {
  const { data, error } = await supabase
    .from('course_schedules')
    .upsert(
      {
        course_id: input.courseId,
        instructor_id: instructorId,
        kind: input.kind,
        title: input.title ?? '',
        weekday: SUNDAY,
        // Postgres `time` accepts 'HH:MM'; normalise so the row always has seconds.
        start_time: input.startTime.length === 5 ? `${input.startTime}:00` : input.startTime,
        duration_minutes: input.durationMinutes,
        timezone: input.timezone ?? browserTimezone(),
        active: true,
      },
      { onConflict: 'course_id,kind' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return toCourseSchedule(data);
}

/** Turns the slot off without deleting already-generated sessions. */
export async function deactivateSchedule(scheduleId: string): Promise<void> {
  const { error } = await supabase
    .from('course_schedules')
    .update({ active: false })
    .eq('id', scheduleId);
  if (error) throw error;
}

export interface EnsureResult {
  created: LiveSession[];
  skipped: number;
}

/**
 * Materialises the next `weeksAhead` Sundays as Meet links. Safe to call on
 * every dashboard load — sessions that already exist are skipped server-side.
 *
 * Throws with `google_not_connected` / `google_reauth_required` (HTTP 428) when
 * the teacher has not granted Calendar access; callers should prompt
 * `connectGoogleCalendar()` and retry.
 */
export async function ensureSundaySessions(courseId?: string, weeksAhead = 4): Promise<EnsureResult> {
  const { data, error } = await supabase.functions.invoke<{ created: unknown[]; skipped: number }>(
    'sunday-sessions-ensure',
    { body: { courseId, weeksAhead } },
  );
  if (error) throw await toFunctionError(error);
  return {
    created: (data?.created ?? []).map((row) => toLiveSession(row as never)),
    skipped: data?.skipped ?? 0,
  };
}

/**
 * `supabase.functions.invoke` rejects with a generic "non-2xx status code"
 * message for any failure — the actual reason (e.g. `google_not_connected`)
 * only lives in the raw Response on `error.context`. Read it so callers like
 * `needsGoogleConnection` can match on the real reason.
 */
async function toFunctionError(error: unknown): Promise<Error> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.text === 'function') {
    try {
      const body = await context.clone().text();
      const reason = (JSON.parse(body) as { error?: string }).error;
      if (reason) return new Error(reason);
    } catch {
      // Not JSON, or already consumed — fall through to the original error.
    }
  }
  return error as Error;
}

/** True when the error from `ensureSundaySessions` means "connect Google first". */
export function needsGoogleConnection(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? String(error ?? '');
  return message.includes('google_not_connected') || message.includes('google_reauth_required');
}
