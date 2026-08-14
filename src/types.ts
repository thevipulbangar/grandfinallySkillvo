export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

/** One answered question in a sequential skill test, with per-question timestamps. */
export interface QuizAnswerLogEntry {
  questionIndex: number;
  question: string;
  options: string[];
  selectedOption: number;
  correctAnswer: number;
  correct: boolean;
  shownAt: string;
  answeredAt: string;
}

export interface Course {
  id: string;
  title: string;
  category: string;
  description: string;
  instructorId: string;
  instructorName: string;
  instructorAvatar: string;
  creditFee: number;
  studentsCount: number;
  verifiedTeacherTopic: boolean;
  lessonsCount: number;
  rating: string;
  level: string;
}

export interface EnrollmentRequest {
  id: string;
  courseId: string;
  courseTitle: string;
  studentId: string;
  studentName: string;
  studentAvatar: string;
  instructorId: string;
  creditFee: number;
  status: 'pending' | 'approved' | 'declined';
  requestedAt: string;
}

export interface EnrolledCourseState {
  /**
   * The enrollment row's id. Absent in the offline demo, where enrollments are
   * local state; the progress/complete RPCs key off this, not the course id.
   */
  id?: string;
  courseId: string;
  status: 'pending' | 'approved' | 'completed';
  progress: number;
  nextLesson: string;
  requestedAt: string;
}

/** A regular Sunday lecture, or the doubt-clearing slot. */
export type SessionKind = 'class' | 'doubt';

/**
 * The teacher's recurring weekly slot for a course. Sundays only — the
 * database constrains `weekday` to 0, so the UI restriction is a convenience,
 * not the actual guarantee.
 */
export interface CourseSchedule {
  id: string;
  courseId: string;
  kind: SessionKind;
  title: string;
  /** 'HH:MM' in `timezone`. */
  startTime: string;
  durationMinutes: number;
  timezone: string;
  active: boolean;
}

/** A generated (or manually added) live session with its Google Meet link. */
export interface LiveSession {
  id: string;
  courseId: string;
  kind: SessionKind;
  title: string;
  description: string;
  meetUrl: string | null;
  startsAt: string;
  endsAt: string;
  scheduleId: string | null;
}

export interface StudyMaterial {
  id: string;
  courseId: string;
  title: string;
  description: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: string;
}

export interface CourseVideo {
  id: string;
  courseId: string;
  title: string;
  description: string;
  fileName: string;
  sizeBytes: number;
  durationSeconds: number;
  storagePath: string;
  published: boolean;
  createdAt: string;
}

export interface TwoFactorConfig {
  enabled: boolean;
  primaryMethod: 'totp' | 'sms' | 'none';
  totp: {
    enabled: boolean;
    secret: string;
    appName: string;
    lastVerified?: string;
  };
  sms: {
    enabled: boolean;
    phoneNumber: string;
    countryCode: string;
    lastVerified?: string;
  };
  backupCodes: Array<{
    code: string;
    used: boolean;
  }>;
  trustedDevices: Array<{
    id: string;
    deviceName: string;
    browser: string;
    location: string;
    lastActive: string;
    current: boolean;
  }>;
  loginVerificationRequired: boolean;
  securityScore: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
  department: string;
  credits: number;
  title: string;
  joinedDate: string;
  level: number;
  levelTitle: string;
  xpPoints: number;
  /** XP earned as an instructor. Sums with learningXp into xpPoints. */
  teachingXp: number;
  /** XP earned as a student. Sums with teachingXp into xpPoints. */
  learningXp: number;
  role: 'Teacher' | 'Student' | 'Master Educator';
  bio?: string;
  twoFactorConfig?: TwoFactorConfig;
  enrolledCourses: EnrolledCourseState[];
  notifications: Array<{
    id: string;
    message: string;
    time: string;
    unread: boolean;
    type: 'enrollment_request' | 'enrollment_approved' | 'course_published' | 'credit_added' | 'credit_earned' | 'security_alert';
  }>;
}

export interface LeaderboardUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'Teacher' | 'Student' | 'Master Educator';
  department: string;
  level: number;
  levelTitle: string;
  xpPoints: number;
  teachingXp: number;
  learningXp: number;
  coursesTaughtCount: number;
  coursesCompletedCount: number;
  studentsTaughtCount: number;
  creditsEarned: number;
  badges: string[];
}

export interface CountryPhoneCode {
  code: string;
  country: string;
  flag: string;
  formatPlaceholder: string;
}

export const COUNTRY_CODES: CountryPhoneCode[] = [
  { code: '+1', country: 'United States / Canada', flag: '🇺🇸', formatPlaceholder: '(555) 019-2834' },
  { code: '+91', country: 'India', flag: '🇮🇳', formatPlaceholder: '98765 43210' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', formatPlaceholder: '7911 123456' },
  { code: '+61', country: 'Australia', flag: '🇦🇺', formatPlaceholder: '0412 345 678' },
  { code: '+49', country: 'Germany', flag: '🇩🇪', formatPlaceholder: '0151 23456789' },
  { code: '+81', country: 'Japan', flag: '🇯🇵', formatPlaceholder: '090 1234 5678' },
  { code: '+33', country: 'France', flag: '🇫🇷', formatPlaceholder: '06 12 34 56 78' },
];
