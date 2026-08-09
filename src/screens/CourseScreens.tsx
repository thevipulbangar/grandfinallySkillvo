/**
 * The three course surfaces: Explore (the marketplace), My Learning (enrolled)
 * and Courses I'm Teaching. They share the card language from the mockups, so
 * they live together and share one CourseCard.
 */
import React from 'react';
import type { Course, EnrollmentRequest, UserProfile } from '../types';
import { Avatar, Badge, Button, Card, EmptyState, ProgressBar } from '../ui/primitives';

const CATEGORY_ICON: Record<string, string> = {
  Engineering: '⚙️',
  'AI & DS': '🧠',
  Design: '🎨',
  Security: '🛡️',
  Business: '📈',
  Beginner: '🌱',
};

function categoryIcon(category: string): string {
  return CATEGORY_ICON[category] ?? '📘';
}

function CourseCard({
  course,
  footer,
}: {
  course: Course;
  footer: React.ReactNode;
}) {
  return (
    <Card className="p-6 flex flex-col gap-3.5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_44px_rgba(11,43,38,.14)]">
      <div className="flex items-center gap-3">
        <span className="w-10.5 h-10.5 rounded-xl bg-mint flex items-center justify-center text-xl shrink-0">
          {categoryIcon(course.category)}
        </span>
        <Badge>{course.category}</Badge>
      </div>

      <h3 className="font-heading font-bold text-[19px] tracking-[-.3px] m-0">{course.title}</h3>
      <p className="text-sm leading-relaxed text-slate m-0 flex-1">{course.description}</p>

      <div className="flex items-center gap-2.5 pt-3 border-t border-mint">
        <Avatar name={course.instructorName} src={course.instructorAvatar} size={28} />
        <div className="flex-1 min-w-0">
          <div className="font-heading font-semibold text-[13px] truncate">{course.instructorName}</div>
          <div className="text-[11px] text-slate">
            {course.verifiedTeacherTopic ? 'Verified instructor' : 'Instructor'}
          </div>
        </div>
        <span className="font-heading font-bold text-xs text-pine bg-sand rounded-full px-2.5 py-1.5 shrink-0">
          {course.creditFee} cr
        </span>
      </div>

      {footer}
    </Card>
  );
}

// ------------------------------------------------------------------ learning

export function LearningScreen({
  user,
  courses,
  onOpenClassroom,
  onExplore,
}: {
  user: UserProfile;
  courses: Course[];
  onOpenClassroom: (course: Course) => void;
  onExplore: () => void;
}) {
  const rows = user.enrolledCourses
    .map((enrolled) => ({ enrolled, course: courses.find((c) => c.id === enrolled.courseId) }))
    .filter((row): row is { enrolled: (typeof user.enrolledCourses)[number]; course: Course } =>
      Boolean(row.course),
    );

  return (
    <section className="mt-6 bg-white border border-sage rounded-[18px] px-10 pt-10 pb-2">
      <h2 className="font-heading font-bold text-xl m-0">My Enrolled Learning Tracks</h2>
      <p className="text-sm text-slate mt-2 mb-0">
        Courses requested using Skillvo Credits and approved by teachers.
      </p>

      {rows.length === 0 ? (
        <div className="mt-6 border-t border-mint px-5 py-11 text-center">
          <span className="w-12 h-12 mx-auto rounded-xl bg-mint flex items-center justify-center text-2xl">
            📖
          </span>
          <h3 className="font-heading font-bold text-lg mt-4 mb-0">No enrolled courses yet</h3>
          <p className="text-sm text-slate mt-2 mb-0 max-w-[44ch] mx-auto">
            Use your {user.credits} Skillvo Credits to request enrollment in any course on the
            marketplace.
          </p>
          <button
            type="button"
            onClick={onExplore}
            className="mt-4.5 font-heading font-bold text-sm text-white bg-pine border-0 rounded-full px-6.5 py-3.5 cursor-pointer transition-all duration-300 hover:bg-moss hover:scale-[1.03]"
          >
            Browse Marketplace Courses
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mt-6 pb-8">
          {rows.map(({ enrolled, course }) => (
            <Card key={course.id} className="p-6 flex flex-col lg:flex-row lg:items-center gap-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge>{course.category}</Badge>
                  {enrolled.status === 'completed' ? (
                    <Badge tone="sage">✓ Completed</Badge>
                  ) : enrolled.status === 'approved' ? (
                    <Badge tone="pine">Active learning</Badge>
                  ) : (
                    <Badge tone="sand">Pending approval</Badge>
                  )}
                </div>

                <h3 className="font-heading font-bold text-lg m-0">{course.title}</h3>
                <p className="text-sm text-slate mt-1 mb-0">
                  Teacher: {course.instructorName} • {course.creditFee} credits
                </p>

                {(enrolled.status === 'approved' || enrolled.status === 'completed') && (
                  <div className="mt-4 max-w-sm">
                    <div className="flex justify-between font-heading text-[11px] font-bold text-slate mb-1.5">
                      <span>Course progress</span>
                      <span>{enrolled.status === 'completed' ? 100 : enrolled.progress}%</span>
                    </div>
                    <ProgressBar value={enrolled.status === 'completed' ? 100 : enrolled.progress} />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {enrolled.status === 'pending' ? (
                  <p className="text-sm text-slate max-w-xs m-0">
                    {course.instructorName} will review your request. Credits are deducted when you
                    complete the course.
                  </p>
                ) : (
                  <Button variant="ghost" onClick={() => onOpenClassroom(course)}>
                    Open classroom
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ teaching

export function TeachingScreen({
  user,
  courses,
  requests,
  onDecide,
  onManageCourse,
  onPublishCourse,
}: {
  user: UserProfile;
  courses: Course[];
  requests: EnrollmentRequest[];
  onDecide: (requestId: string, action: 'approve' | 'decline') => void;
  onManageCourse: (course: Course) => void;
  onPublishCourse: () => void;
}) {
  const mine = courses.filter((course) => course.instructorId === user.id);
  const pending = requests.filter((r) => r.instructorId === user.id && r.status === 'pending');

  return (
    <>
      <section className="mt-6 mb-6 bg-white border border-sage rounded-[18px] p-10 flex flex-wrap items-center justify-between gap-5">
        <div>
          <h2 className="font-heading font-bold text-xl m-0">Courses You Teach</h2>
          <p className="text-sm text-slate mt-2 mb-0">
            Manage your published curriculum and student enrollment approvals.
          </p>
        </div>
        <button
          type="button"
          onClick={onPublishCourse}
          className="inline-flex items-center gap-2 font-heading font-bold text-sm text-white bg-pine border-0 rounded-xl px-5.5 py-3.5 cursor-pointer whitespace-nowrap transition-all duration-300 hover:bg-moss hover:scale-[1.03]"
        >
          <span className="text-base">+</span> Publish New Course
        </button>
      </section>

      {pending.length > 0 && (
        <div className="bg-pine text-white rounded-[20px] p-6 mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="font-heading font-bold text-base m-0">
              Pending enrollment requests ({pending.length})
            </h3>
            <span className="font-heading text-xs font-bold bg-sand text-ink px-3 py-1 rounded-full">
              Requires approval
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {pending.map((request) => (
              <div
                key={request.id}
                className="bg-white/10 border border-white/10 rounded-[14px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={request.studentName} src={request.studentAvatar} size={40} />
                  <div className="min-w-0">
                    <div className="font-heading font-bold text-sm truncate">{request.studentName}</div>
                    <div className="text-xs text-mint truncate">
                      Requested <strong>{request.courseTitle}</strong>
                    </div>
                    <div className="text-[11px] text-sand font-bold mt-0.5">
                      You earn +{request.creditFee} credits once they complete the course
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => onDecide(request.id, 'approve')}>
                    Approve
                  </Button>
                  <button
                    type="button"
                    onClick={() => onDecide(request.id, 'decline')}
                    className="font-heading font-bold text-xs text-white bg-white/20 hover:bg-white/30 px-3.5 py-2 rounded-[10px] cursor-pointer transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mine.length === 0 ? (
        <EmptyState
          title="You are not teaching any course yet"
          body="Publish one to unlock Sunday live sessions, study material uploads and recorded lectures for your students."
          action={<Button onClick={onPublishCourse}>Publish your first course</Button>}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
          {mine.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              footer={
                <>
                  <div className="flex justify-between text-[13px] font-heading font-semibold text-slate bg-haze rounded-xl px-4 py-3">
                    <span>
                      Students: <strong className="text-ink">{course.studentsCount}</strong>
                    </span>
                    <span>
                      Fee: <strong className="text-ink">{course.creditFee} cr</strong>
                    </span>
                  </div>
                  <Button full onClick={() => onManageCourse(course)}>
                    Sessions, material &amp; lectures
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
