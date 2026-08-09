/**
 * Translates database rows into the UI-facing shapes already used by App.tsx
 * (src/types.ts), so the component tree can be migrated without a rewrite.
 */
import type {
  Course,
  CourseSchedule,
  CourseVideo,
  EnrolledCourseState,
  EnrollmentRequest,
  LeaderboardUser,
  LiveSession,
  QuizQuestion,
  StudyMaterial,
  UserProfile,
} from '../types';
import type {
  CourseRow,
  CourseScheduleRow,
  CourseVideoRow,
  EnrollmentRow,
  LeaderboardUserRow,
  LiveSessionRow,
  NotificationRow,
  ProfileRow,
  StudyMaterialRow,
  TopicQuizQuestionRow,
} from '../lib/database.types';

/** "3 days ago" style stamps, matching the strings the mock data used. */
export function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const units: Array<[number, string]> = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [604800, 'week'],
    [2592000, 'month'],
  ];
  for (let i = 0; i < units.length; i++) {
    const [divisor, label] = units[i];
    const next = units[i + 1]?.[0] ?? Infinity;
    if (seconds < next) {
      const value = Math.floor(seconds / divisor);
      return `${value} ${label}${value === 1 ? '' : 's'} ago`;
    }
  }
  return new Date(iso).toLocaleDateString();
}

function joinedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export interface CourseWithInstructor extends CourseRow {
  instructor?: Pick<ProfileRow, 'id' | 'name' | 'avatar_url'> | null;
}

export function toCourse(row: CourseWithInstructor): Course {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    instructorId: row.instructor_id,
    instructorName: row.instructor?.name ?? 'Skillvo Instructor',
    instructorAvatar: row.instructor?.avatar_url ?? '',
    creditFee: row.credit_fee,
    studentsCount: row.students_count,
    verifiedTeacherTopic: row.verified_teacher_topic,
    lessonsCount: row.lessons_count,
    rating: Number(row.rating).toFixed(1),
    level: row.level,
  };
}

export function toEnrolledCourseState(row: EnrollmentRow): EnrolledCourseState {
  return {
    id: row.id,
    courseId: row.course_id,
    // The UI only models these three; 'declined' rows are filtered out upstream.
    status: row.status === 'declined' ? 'pending' : row.status,
    progress: row.progress,
    nextLesson: row.next_lesson,
    requestedAt: relativeTime(row.requested_at),
  };
}

export interface EnrollmentWithJoins extends EnrollmentRow {
  course?: Pick<CourseRow, 'id' | 'title'> | null;
  student?: Pick<ProfileRow, 'id' | 'name' | 'avatar_url'> | null;
}

export function toEnrollmentRequest(row: EnrollmentWithJoins): EnrollmentRequest {
  return {
    id: row.id,
    courseId: row.course_id,
    courseTitle: row.course?.title ?? 'Course',
    studentId: row.student_id,
    studentName: row.student?.name ?? 'Student',
    studentAvatar: row.student?.avatar_url ?? '',
    instructorId: row.instructor_id,
    creditFee: row.credit_fee,
    status: row.status === 'completed' ? 'approved' : row.status,
    requestedAt: relativeTime(row.requested_at),
  };
}

export function toUserProfile(
  profile: ProfileRow,
  enrollments: EnrollmentRow[],
  notifications: NotificationRow[],
): UserProfile {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    avatar: profile.avatar_url,
    department: profile.department,
    credits: profile.credits,
    title: profile.title,
    joinedDate: joinedDate(profile.created_at),
    level: profile.level,
    levelTitle: profile.level_title,
    xpPoints: profile.xp_points,
    teachingXp: profile.teaching_xp,
    learningXp: profile.learning_xp,
    role: profile.role,
    bio: profile.bio ?? undefined,
    enrolledCourses: enrollments
      .filter((e) => e.status !== 'declined')
      .map(toEnrolledCourseState),
    notifications: notifications.map((n) => ({
      id: n.id,
      message: n.message,
      time: relativeTime(n.created_at),
      unread: n.unread,
      // src/types.ts carries a narrower union than the DB enum.
      type: n.type as UserProfile['notifications'][number]['type'],
    })),
  };
}

export function toLeaderboardUser(row: LeaderboardUserRow): LeaderboardUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar_url,
    role: row.role,
    department: row.department,
    level: row.level,
    levelTitle: row.level_title,
    xpPoints: row.xp_points,
    teachingXp: row.teaching_xp,
    learningXp: row.learning_xp,
    coursesTaughtCount: row.courses_taught_count,
    coursesCompletedCount: row.courses_completed_count,
    studentsTaughtCount: row.students_taught_count,
    creditsEarned: row.credits_earned,
    badges: row.badges,
  };
}

export function toQuizQuestion(row: TopicQuizQuestionRow): QuizQuestion {
  return {
    id: row.id,
    question: row.question,
    options: row.options,
    correctAnswer: row.correct_answer,
  };
}

// ------------------------------------------------------------------ course content

export function toCourseSchedule(row: CourseScheduleRow): CourseSchedule {
  return {
    id: row.id,
    courseId: row.course_id,
    kind: row.kind,
    title: row.title,
    // Postgres hands back 'HH:MM:SS'; the <input type="time"> wants 'HH:MM'.
    startTime: row.start_time.slice(0, 5),
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    active: row.active,
  };
}

export function toLiveSession(row: LiveSessionRow): LiveSession {
  return {
    id: row.id,
    courseId: row.course_id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    meetUrl: row.meet_url,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    scheduleId: row.schedule_id,
  };
}

export function toStudyMaterial(row: StudyMaterialRow): StudyMaterial {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  };
}

export function toCourseVideo(row: CourseVideoRow): CourseVideo {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    fileName: row.file_name,
    sizeBytes: row.size_bytes,
    durationSeconds: row.duration_seconds,
    storagePath: row.storage_path,
    published: row.published,
    createdAt: row.created_at,
  };
}
