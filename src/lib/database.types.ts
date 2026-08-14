/**
 * Row shapes for the Skillvo Postgres schema (supabase/migrations).
 *
 * Hand-written to match the migrations. Once your project is live you can
 * regenerate this file instead:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type UserRole = 'Student' | 'Teacher' | 'Master Educator';
export type EnrollmentStatus = 'pending' | 'approved' | 'declined' | 'completed';
export type PaymentStatus = 'created' | 'paid' | 'failed' | 'refunded';
export type TwoFactorMethod = 'none' | 'totp' | 'sms';
export type SessionKind = 'class' | 'doubt';

export type NotificationType =
  | 'enrollment_request'
  | 'enrollment_approved'
  | 'enrollment_declined'
  | 'course_published'
  | 'credit_added'
  | 'credit_earned'
  | 'credit_spent'
  | 'security_alert'
  | 'session_scheduled'
  | 'material_published'
  | 'lecture_published';

export type CreditReason =
  | 'welcome_bonus'
  | 'purchase'
  | 'enrollment_spend'
  | 'teaching_earning'
  | 'course_completion_bonus'
  | 'refund'
  | 'admin_adjustment';

export type ProfileRow = {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  department: string;
  title: string;
  bio: string | null;
  role: UserRole;
  credits: number;
  level: number;
  level_title: string;
  xp_points: number;
  teaching_xp: number;
  learning_xp: number;
  badges: string[];
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export type CourseRow = {
  id: string;
  instructor_id: string;
  title: string;
  category: string;
  description: string;
  credit_fee: number;
  lessons_count: number;
  level: string;
  rating: number;
  students_count: number;
  verified_teacher_topic: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export type CourseLessonRow = {
  id: string;
  course_id: string;
  position: number;
  title: string;
  summary: string | null;
  created_at: string;
}

export type EnrollmentRow = {
  id: string;
  course_id: string;
  student_id: string;
  instructor_id: string;
  status: EnrollmentStatus;
  credit_fee: number;
  progress: number;
  next_lesson: string;
  requested_at: string;
  decided_at: string | null;
  completed_at: string | null;
}

export type TopicQuizQuestionRow = {
  id: string;
  category: string;
  question: string;
  options: string[];
  correct_answer: number;
  created_at: string;
}

export type SkillTestAttemptRow = {
  id: string;
  user_id: string;
  category: string;
  score: number;
  total: number;
  passed: boolean;
  answers: unknown;
  attempted_at: string;
}

export type SkillTestBanRow = {
  user_id: string;
  category: string;
  banned_until: string;
  created_at: string;
}

export type CreditTransactionRow = {
  id: string;
  user_id: string;
  amount: number;
  reason: CreditReason;
  description: string;
  course_id: string | null;
  payment_id: string | null;
  created_at: string;
}

export type PaymentRow = {
  id: string;
  user_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  pack_name: string;
  credits: number;
  amount_paise: number;
  currency: string;
  status: PaymentStatus;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
}

export type LiveSessionRow = {
  id: string;
  course_id: string;
  instructor_id: string;
  title: string;
  description: string;
  meet_url: string | null;
  google_event_id: string | null;
  google_calendar_id: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  kind: SessionKind;
  schedule_id: string | null;
}

export type CourseScheduleRow = {
  id: string;
  course_id: string;
  instructor_id: string;
  kind: SessionKind;
  title: string;
  /** ISO weekday; always 0 (Sunday) — the schema constrains it. */
  weekday: number;
  /** 'HH:MM:SS' in `timezone`. */
  start_time: string;
  duration_minutes: number;
  timezone: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type StudyMaterialRow = {
  id: string;
  course_id: string;
  instructor_id: string;
  title: string;
  description: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  position: number;
  created_at: string;
}

export type CourseVideoRow = {
  id: string;
  course_id: string;
  instructor_id: string;
  title: string;
  description: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number;
  position: number;
  published: boolean;
  created_at: string;
}

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  message: string;
  unread: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type TwoFactorSettingsRow = {
  user_id: string;
  enabled: boolean;
  primary_method: TwoFactorMethod;
  totp_enabled: boolean;
  totp_app_name: string;
  totp_last_verified: string | null;
  sms_enabled: boolean;
  sms_country_code: string;
  sms_phone_number: string;
  sms_last_verified: string | null;
  login_verification_required: boolean;
  security_score: number;
  updated_at: string;
}

export type BackupCodeRow = {
  id: string;
  user_id: string;
  code_hash: string;
  used: boolean;
  used_at: string | null;
  created_at: string;
}

export type TrustedDeviceRow = {
  id: string;
  user_id: string;
  device_name: string;
  browser: string;
  location: string;
  fingerprint: string;
  last_active: string;
  created_at: string;
}

export type LeaderboardUserRow = {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  role: UserRole;
  department: string;
  level: number;
  level_title: string;
  xp_points: number;
  teaching_xp: number;
  learning_xp: number;
  badges: string[];
  courses_taught_count: number;
  courses_completed_count: number;
  students_taught_count: number;
  credits_earned: number;
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      courses: Table<CourseRow>;
      course_lessons: Table<CourseLessonRow>;
      enrollments: Table<EnrollmentRow>;
      topic_quiz_questions: Table<TopicQuizQuestionRow>;
      skill_test_attempts: Table<SkillTestAttemptRow>;
      skill_test_bans: Table<SkillTestBanRow>;
      credit_transactions: Table<CreditTransactionRow>;
      payments: Table<PaymentRow>;
      live_sessions: Table<LiveSessionRow>;
      course_schedules: Table<CourseScheduleRow>;
      study_materials: Table<StudyMaterialRow>;
      course_videos: Table<CourseVideoRow>;
      notifications: Table<NotificationRow>;
      two_factor_settings: Table<TwoFactorSettingsRow>;
      two_factor_backup_codes: Table<BackupCodeRow>;
      trusted_devices: Table<TrustedDeviceRow>;
    };
    Views: {
      leaderboard_users: { Row: LeaderboardUserRow; Relationships: [] };
    };
    Functions: {
      request_enrollment: { Args: { p_course_id: string }; Returns: EnrollmentRow };
      decide_enrollment: { Args: { p_enrollment_id: string; p_approve: boolean }; Returns: EnrollmentRow };
      set_enrollment_progress: {
        Args: { p_enrollment_id: string; p_progress: number; p_next_lesson?: string };
        Returns: EnrollmentRow;
      };
      complete_enrollment: { Args: { p_enrollment_id: string }; Returns: EnrollmentRow };
      record_skill_test: {
        Args: {
          p_category: string;
          p_score: number;
          p_total: number;
          p_answers?: unknown;
          p_passed?: boolean;
        };
        Returns: SkillTestAttemptRow;
      };
      ensure_profile: { Args: Record<string, never>; Returns: ProfileRow };
      teaches_course: { Args: { p_course_id: string }; Returns: boolean };
      is_enrolled_in: { Args: { p_course_id: string }; Returns: boolean };
      notify_course_students: {
        Args: {
          p_course_id: string;
          p_type: NotificationType;
          p_message: string;
          p_metadata?: Record<string, unknown>;
        };
        Returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      enrollment_status: EnrollmentStatus;
      notification_type: NotificationType;
      credit_reason: CreditReason;
      payment_status: PaymentStatus;
      two_factor_method: TwoFactorMethod;
      session_kind: SessionKind;
    };
    CompositeTypes: Record<string, never>;
  };
}
