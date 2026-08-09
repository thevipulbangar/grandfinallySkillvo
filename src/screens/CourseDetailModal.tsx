/**
 * Course details sheet — a faithful build of the `detailsCourse` block in
 * "Skillvo Dashboard.dc.html": scrolling body with outcomes and a mentor card,
 * an enrollment-cost row, and the Cancel / Enroll Now footer.
 *
 * The outcomes and mentor bio are composed from the course the same way the
 * design composes them, so every course has them without new columns.
 */
import React from 'react';
import type { Course, EnrolledCourseState, UserProfile } from '../types';

const CATEGORY_ICON: Record<string, string> = {
  Engineering: '⚙️',
  'AI & DS': '🧠',
  Design: '🎨',
  Business: '📈',
  Security: '🛡️',
  Music: '🎵',
  Arts: '🎨',
  Crafts: '🧶',
  Beginner: '🌱',
};

/** The design cycles three tile colours across the catalogue. */
const ICON_BG = ['bg-mint', 'bg-sand', 'bg-apricot'];

export function courseIcon(category: string): string {
  return CATEGORY_ICON[category] ?? '📘';
}

export function courseIconBg(course: Course): string {
  let hash = 0;
  for (const char of course.id) hash = (hash + char.charCodeAt(0)) % 997;
  return ICON_BG[hash % ICON_BG.length];
}

function outcomesFor(course: Course): string[] {
  const topic = course.category.toLowerCase();
  return [
    `A structured path through ${topic} fundamentals with hands-on projects.`,
    'Direct feedback and code/work reviews from your mentor.',
    'A completion credential you can carry toward Skillvo credits.',
    'Lifetime access to lesson recordings and materials.',
  ];
}

export default function CourseDetailModal({
  course,
  user,
  enrolled,
  onEnroll,
  onOpenClassroom,
  onManage,
  onClose,
}: {
  course: Course;
  user: UserProfile;
  enrolled?: EnrolledCourseState;
  onEnroll: (course: Course) => void;
  onOpenClassroom: (course: Course) => void;
  onManage: (course: Course) => void;
  onClose: () => void;
}) {
  const isMine = course.instructorId === user.id;
  const affordable = user.credits >= course.creditFee;
  const initials = course.instructorName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  // Whether the primary button enrols, opens or manages depends on the
  // viewer's relationship to the course; the design only shows "Enroll Now"
  // because its catalogue is always someone else's.
  const primary = isMine
    ? { label: 'Manage course', action: () => onManage(course), disabled: false }
    : enrolled?.status === 'pending'
      ? { label: 'Awaiting approval', action: onClose, disabled: true }
      : enrolled
        ? { label: 'Open classroom', action: () => onOpenClassroom(course), disabled: false }
        : {
            label: affordable ? 'Enroll Now' : `Need ${course.creditFee - user.credits} more credits`,
            action: () => onEnroll(course),
            disabled: !affordable,
          };

  return (
    <div
      onClick={onClose}
      className="fixed left-0 right-0 top-19 bottom-6 z-50 bg-[rgba(5,31,32,.5)] flex items-center justify-center p-6 animate-overlay-in cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[20px] max-w-[640px] w-full max-h-full flex flex-col animate-pop cursor-default"
      >
        <div className="px-9 pt-9 overflow-y-auto flex-1">
          <div className="flex items-center gap-3">
            <span
              className={`w-11.5 h-11.5 rounded-[14px] ${courseIconBg(course)} flex items-center justify-center text-xl`}
            >
              {courseIcon(course.category)}
            </span>
            <span className="font-heading font-bold text-[11px] tracking-[.08em] uppercase text-pine bg-mint px-3 py-1.5 rounded-full">
              {course.category}
            </span>
          </div>

          <h2 className="font-heading font-bold text-[22px] tracking-[-.4px] mt-4.5 mb-0">
            {course.title}
          </h2>
          <p className="text-sm leading-relaxed text-slate mt-2.5 mb-0">{course.description}</p>

          <h3 className="font-heading font-bold text-sm text-ink mt-5.5 mb-2.5">What you'll get</h3>
          <div className="flex flex-col gap-2.5">
            {outcomesFor(course).map((outcome) => (
              <div key={outcome} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-moss mt-[7px] shrink-0" />
                <span className="text-[13px] leading-relaxed text-slate">{outcome}</span>
              </div>
            ))}
          </div>

          <h3 className="font-heading font-bold text-sm text-ink mt-5.5 mb-2.5">About your mentor</h3>
          <div className="bg-haze border border-sage rounded-2xl p-4.5">
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full bg-pine text-white flex items-center justify-center font-heading font-bold text-sm shrink-0">
                {initials}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-heading font-semibold text-sm truncate">
                  {course.instructorName}
                </div>
                <div className="text-xs text-slate">
                  {course.verifiedTeacherTopic ? 'AI-verified instructor' : 'Instructor'} ·{' '}
                  {course.category}
                </div>
              </div>
            </div>
            <p className="text-[13px] leading-relaxed text-slate mt-3 mb-0">
              {course.instructorName} is an AI-verified Skillvo instructor with a strong track record
              teaching {course.category.toLowerCase()}, focused on practical, project-based learning.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 mt-5.5 pt-4.5 pb-6 border-t border-mint">
            <span className="text-[13px] text-slate">Enrollment cost</span>
            <span className="font-heading font-bold text-[13px] text-pine bg-sand rounded-full px-3 py-1.5">
              {course.creditFee} cr
            </span>
          </div>
        </div>

        <div className="flex gap-2.5 px-9 pt-4.5 pb-9 border-t border-mint shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 font-heading font-semibold text-sm text-ink bg-haze border border-sage rounded-xl py-3.5 cursor-pointer hover:bg-mint transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={primary.disabled}
            onClick={primary.action}
            className="flex-1 font-heading font-bold text-sm text-white bg-pine border-0 rounded-xl py-3.5 cursor-pointer transition-colors hover:bg-moss disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {primary.label}
          </button>
        </div>
      </div>
    </div>
  );
}
