import { supabase } from '../lib/supabase';
import type { EnrollmentRequest } from '../types';
import type { EnrollmentRow } from '../lib/database.types';
import { toEnrollmentRequest, type EnrollmentWithJoins } from './mappers';

const REQUEST_SELECT =
  '*, course:courses!enrollments_course_id_fkey (id, title), ' +
  'student:profiles!enrollments_student_id_fkey (id, name, avatar_url)';

/**
 * Enrol in a course. The RPC debits the student's wallet, creates the pending
 * row and notifies the instructor in one transaction — so a failed debit
 * leaves no orphan request.
 */
export async function requestEnrollment(courseId: string): Promise<EnrollmentRow> {
  const { data, error } = await supabase.rpc('request_enrollment', { p_course_id: courseId });
  if (error) throw error;
  return data as EnrollmentRow;
}

/** Approve pays the instructor and awards XP; decline refunds the student. */
export async function decideEnrollment(enrollmentId: string, approve: boolean): Promise<EnrollmentRow> {
  const { data, error } = await supabase.rpc('decide_enrollment', {
    p_enrollment_id: enrollmentId,
    p_approve: approve,
  });
  if (error) throw error;
  return data as EnrollmentRow;
}

export async function setProgress(
  enrollmentId: string,
  progress: number,
  nextLesson?: string,
): Promise<EnrollmentRow> {
  const { data, error } = await supabase.rpc('set_enrollment_progress', {
    p_enrollment_id: enrollmentId,
    p_progress: progress,
    p_next_lesson: nextLesson,
  });
  if (error) throw error;
  return data as EnrollmentRow;
}

export async function completeEnrollment(enrollmentId: string): Promise<EnrollmentRow> {
  const { data, error } = await supabase.rpc('complete_enrollment', { p_enrollment_id: enrollmentId });
  if (error) throw error;
  return data as EnrollmentRow;
}

export async function listStudentEnrollments(studentId: string): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('student_id', studentId)
    .order('requested_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** The instructor's inbox of enrollment requests. */
export async function listInstructorRequests(
  instructorId: string,
  onlyPending = false,
): Promise<EnrollmentRequest[]> {
  let query = supabase.from('enrollments').select(REQUEST_SELECT).eq('instructor_id', instructorId);
  if (onlyPending) query = query.eq('status', 'pending');

  const { data, error } = await query.order('requested_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as EnrollmentWithJoins[]).map(toEnrollmentRequest);
}

/** Push new/changed requests to an instructor's dashboard without polling. */
export function subscribeToInstructorRequests(instructorId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`enrollments:instructor:${instructorId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'enrollments', filter: `instructor_id=eq.${instructorId}` },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
