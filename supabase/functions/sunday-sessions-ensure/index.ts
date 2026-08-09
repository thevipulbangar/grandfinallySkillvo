// Generates the upcoming Sunday Meet links from a course's weekly schedule.
//
// Deploy: supabase functions deploy sunday-sessions-ensure
//
// The teacher sets a slot once ("Sundays 10:00, 60 min, class") and this
// function materialises the next few Sundays as live_sessions rows with real
// Meet links. It is idempotent: a unique index on (schedule_id, starts_at
// date) plus the pre-flight check below mean calling it repeatedly — on every
// dashboard load, say — creates nothing new.

import { json, preflight } from '../_shared/cors.ts';
import { requireUser, serviceClient } from '../_shared/supabase.ts';
import { courseAttendees, courseStudentIds, createMeetEvent, freshAccessToken } from '../_shared/google.ts';

const DEFAULT_WEEKS_AHEAD = 4;
const MAX_WEEKS_AHEAD = 12;

/**
 * Offset of `timeZone` from UTC at `date`, in milliseconds.
 *
 * Intl can format an instant into a zone's wall-clock parts; reading those
 * parts back as if they were UTC and subtracting gives the offset. This is the
 * standard trick for doing zone maths without pulling in a date library.
 */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const at: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') at[part.type] = Number(part.value);
  }

  // Intl can emit hour 24 for midnight in some locales/zones.
  const hour = at.hour === 24 ? 0 : at.hour;
  const asUtc = Date.UTC(at.year, at.month - 1, at.day, hour, at.minute, at.second);
  return asUtc - date.getTime();
}

/** The instant at which a wall-clock time in `timeZone` occurs. */
function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  // First pass uses the offset around the naive guess; if that guess landed on
  // the far side of a DST transition the offset changes, so apply it twice.
  const firstPass = naive - zoneOffsetMs(new Date(naive), timeZone);
  const corrected = naive - zoneOffsetMs(new Date(firstPass), timeZone);
  return new Date(corrected);
}

/** Civil year/month/day and weekday of `date` as seen in `timeZone`. */
function civilDateIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const at: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') at[part.type] = part.value;
  }

  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(at.weekday);
  return {
    year: Number(at.year),
    month: Number(at.month),
    day: Number(at.day),
    weekday: weekdayIndex,
  };
}

/**
 * Start instants for the next `weeks` occurrences of `weekday` at `hh:mm` in
 * `timeZone`, skipping any occurrence that has already started.
 */
function upcomingOccurrences(
  weekday: number,
  hour: number,
  minute: number,
  timeZone: string,
  weeks: number,
): Date[] {
  const now = new Date();
  const today = civilDateIn(now, timeZone);

  // Days from today forward to the next matching weekday (0 = it is today).
  const daysAhead = (weekday - today.weekday + 7) % 7;

  const out: Date[] = [];
  // Walk one extra week: if today's slot has already passed it is dropped, and
  // we still want `weeks` future sessions.
  for (let i = 0; out.length < weeks && i <= weeks; i++) {
    // Civil-day arithmetic in UTC, then reinterpreted as a wall time.
    const civil = new Date(Date.UTC(today.year, today.month - 1, today.day + daysAhead + i * 7));
    const start = zonedWallTimeToUtc(
      civil.getUTCFullYear(),
      civil.getUTCMonth() + 1,
      civil.getUTCDate(),
      hour,
      minute,
      timeZone,
    );
    if (start.getTime() > Date.now()) out.push(start);
  }

  return out;
}

interface ScheduleRow {
  id: string;
  course_id: string;
  instructor_id: string;
  kind: 'class' | 'doubt';
  title: string;
  weekday: number;
  start_time: string;
  duration_minutes: number;
  timezone: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const courseId: string | undefined = body.courseId;
    const weeks = Math.min(MAX_WEEKS_AHEAD, Math.max(1, Number(body.weeksAhead) || DEFAULT_WEEKS_AHEAD));

    const db = serviceClient();

    let query = db
      .from('course_schedules')
      .select('id, course_id, instructor_id, kind, title, weekday, start_time, duration_minutes, timezone')
      .eq('instructor_id', user.id)
      .eq('active', true);
    if (courseId) query = query.eq('course_id', courseId);

    const { data: schedules, error: schedulesError } = await query;
    if (schedulesError) throw schedulesError;
    if (!schedules?.length) return json({ created: [], skipped: 0 });

    // Only reached when there is something to schedule, so a teacher with no
    // slots never gets pushed into the Google consent flow.
    const accessToken = await freshAccessToken(db, user.id);

    const created: unknown[] = [];
    let skipped = 0;

    for (const schedule of schedules as ScheduleRow[]) {
      const { data: course } = await db
        .from('courses')
        .select('id, title')
        .eq('id', schedule.course_id)
        .maybeSingle();
      if (!course) continue;

      const [hour, minute] = schedule.start_time.split(':').map(Number);
      const occurrences = upcomingOccurrences(schedule.weekday, hour, minute, schedule.timezone, weeks);
      if (!occurrences.length) continue;

      // One round trip for "which of these already exist", rather than
      // relying on the unique index to reject each insert in turn.
      const { data: existing } = await db
        .from('live_sessions')
        .select('starts_at')
        .eq('schedule_id', schedule.id)
        .gte('starts_at', new Date().toISOString());

      const taken = new Set(
        (existing ?? []).map((row: { starts_at: string }) => row.starts_at.slice(0, 10)),
      );

      const attendees = await courseAttendees(db, schedule.course_id);
      const studentIds = await courseStudentIds(db, schedule.course_id);
      const isDoubt = schedule.kind === 'doubt';
      const title = schedule.title || (isDoubt ? 'Doubt clearing session' : `${course.title} — Sunday class`);

      for (const startsAt of occurrences) {
        if (taken.has(startsAt.toISOString().slice(0, 10))) {
          skipped++;
          continue;
        }

        const endsAt = new Date(startsAt.getTime() + schedule.duration_minutes * 60_000);

        const event = await createMeetEvent(accessToken, {
          summary: title,
          description: isDoubt
            ? `Weekly doubt clearing session for "${course.title}".`
            : `Weekly Sunday class for "${course.title}".`,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          attendees,
        });

        const { data: session, error: insertError } = await db
          .from('live_sessions')
          .insert({
            course_id: schedule.course_id,
            instructor_id: schedule.instructor_id,
            schedule_id: schedule.id,
            kind: schedule.kind,
            title,
            description: '',
            meet_url: event.meetUrl,
            google_event_id: event.eventId,
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
          })
          .select('*')
          .single();

        // A concurrent invocation may have inserted the same slot; the unique
        // index turns that into a duplicate-key error we can safely ignore.
        if (insertError) {
          if (insertError.code === '23505') {
            skipped++;
            continue;
          }
          throw insertError;
        }

        created.push(session);

        if (studentIds.length) {
          const when = startsAt.toLocaleString('en-IN', {
            timeZone: schedule.timezone,
            dateStyle: 'medium',
            timeStyle: 'short',
          });
          await db.from('notifications').insert(
            studentIds.map((studentId) => ({
              user_id: studentId,
              type: 'session_scheduled',
              message: `📅 ${isDoubt ? 'Doubt session' : 'Sunday class'} for "${course.title}" — ${when}`,
              metadata: {
                course_id: schedule.course_id,
                session_id: session.id,
                meet_url: event.meetUrl,
                kind: schedule.kind,
              },
            })),
          );
        }
      }
    }

    return json({ created, skipped });
  } catch (err) {
    if (err instanceof Response) {
      const reason = await err.clone().text().catch(() => '');
      return json({ error: reason || 'Unauthorized' }, err.status);
    }
    console.error(err);
    return json({ error: 'Could not generate the Sunday sessions.' }, 500);
  }
});
