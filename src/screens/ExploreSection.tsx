/**
 * The Explore section of the Dashboard — a faithful build of the `isExplore`
 * block in "Skillvo Dashboard.dc.html": search field with the recommendations
 * dropdown, Filters button, category chips, and the course card grid.
 *
 * The dropdown in the mockup is labelled "AI recommendations for you". There
 * is no model behind it; `recommendFor()` below is plain local matching over
 * the catalogue and the learner's own history, and each row states the reason
 * it was picked so the suggestion is never unexplained.
 */
import React from 'react';
import type { Course, UserProfile } from '../types';
import { courseIcon, courseIconBg } from './CourseDetailModal';

/** The category rail is the fixed list from the design, not whatever the
 *  catalogue happens to contain, so the rail never reshuffles as courses
 *  come and go. */
export const CATEGORIES = [
  'All',
  'Engineering',
  'AI & DS',
  'Design',
  'Business',
  'Security',
  'Music',
  'Arts',
  'Crafts',
  'Beginner',
];

export interface Recommendation {
  course: Course;
  reason: string;
}

/**
 * Ranks courses the learner has not taken, newest signal first:
 *   1. same category as something they already enrolled in
 *   2. taught by an instructor they already learn from
 *   3. whatever the most people have enrolled in
 */
export function recommendFor(
  user: UserProfile,
  courses: Course[],
  query = '',
  limit = 4,
): Recommendation[] {
  const takenIds = new Set(user.enrolledCourses.map((e) => e.courseId));
  const taken = courses.filter((c) => takenIds.has(c.id));
  const myCategories = new Set(taken.map((c) => c.category));
  const myInstructors = new Set(taken.map((c) => c.instructorId));

  const candidates = courses.filter((c) => !takenIds.has(c.id) && c.instructorId !== user.id);

  const scored = candidates.map((course) => {
    if (query) {
      return { course, reason: `Matches "${query}" · ${course.category}`, score: 4 };
    }
    if (myCategories.has(course.category)) {
      return { course, reason: `Matches your interest in ${course.category}`, score: 3 };
    }
    if (myInstructors.has(course.instructorId)) {
      return { course, reason: `More from ${course.instructorName}`, score: 2 };
    }
    return { course, reason: `Recommended for you · ${course.category}`, score: 1 };
  });

  return scored
    .sort((a, b) => b.score - a.score || b.course.studentsCount - a.course.studentsCount)
    .slice(0, limit)
    .map(({ course, reason }) => ({ course, reason }));
}

export default function ExploreSection({
  user,
  courses,
  allCourses,
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearch,
  onOpenCourse,
}: {
  user: UserProfile;
  /** Already filtered by category and search. */
  courses: Course[];
  /** Unfiltered, for the recommendations. */
  allCourses: Course[];
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearch: (value: string) => void;
  onOpenCourse: (course: Course) => void;
}) {
  const [focused, setFocused] = React.useState(false);
  const recommendations = React.useMemo(
    () => recommendFor(user, allCourses, searchQuery.trim().toLowerCase()),
    [user, allCourses, searchQuery],
  );
  const showSuggestions = focused && recommendations.length > 0;

  return (
    <>
      <section className="mt-8 flex gap-3 flex-wrap items-center">
        <div className="flex-[1_1_320px] relative">
          <div className="flex items-center gap-2.5 bg-white border border-sage rounded-[14px] px-4.5 py-3.5">
            <span className="w-4 h-4 rounded-full border-2 border-pine shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              onFocus={() => setFocused(true)}
              // Blur is delayed by the mousedown handler on each row, which
              // fires before blur — so picking a suggestion still registers.
              onBlur={() => setFocused(false)}
              placeholder="Search by skill, title, or instructor…"
              className="flex-1 border-0 outline-none text-[15px] text-ink bg-transparent placeholder:text-mist"
            />
          </div>

          {showSuggestions && (
            <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-30 bg-white border border-mint rounded-[14px] shadow-[0_12px_32px_rgba(5,31,32,.15)] p-2.5 animate-pop">
              <div className="flex items-center gap-1.5 px-2.5 pt-1 pb-2 font-heading font-bold text-[11px] tracking-[.08em] uppercase text-moss">
                <span>✨</span>
                <span>AI recommendations for you</span>
              </div>
              {recommendations.map(({ course, reason }) => (
                <div
                  key={course.id}
                  onMouseDown={() => onOpenCourse(course)}
                  className="flex items-center gap-3 px-2.5 py-2.5 rounded-[10px] cursor-pointer transition-colors hover:bg-haze"
                >
                  <span className={`w-8.5 h-8.5 rounded-[10px] ${courseIconBg(course)} flex items-center justify-center shrink-0`}>
                    {courseIcon(course.category)}
                  </span>
                  <div className="min-w-0">
                    <div className="font-heading font-semibold text-[13px] text-ink truncate">
                      {course.title}
                    </div>
                    <div className="text-xs text-slate truncate">{reason}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSelectCategory('All')}
          className="font-heading font-semibold text-sm text-pine bg-sage border-0 rounded-[14px] px-5.5 py-3.5 cursor-pointer hover:bg-mint transition-colors"
        >
          Filters
        </button>
      </section>

      <section className="mt-4 flex gap-2.5 flex-wrap">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onSelectCategory(category)}
            className={`font-heading font-semibold text-[13px] px-4.5 py-2.5 rounded-full border border-sage cursor-pointer transition-colors ${
              selectedCategory === category ? 'bg-pine text-white' : 'bg-white text-ink hover:bg-mint'
            }`}
          >
            {category}
          </button>
        ))}
      </section>

      <section className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
        {courses.length === 0 && (
          <div className="col-span-full text-center py-12 px-6 text-sm text-slate">
            No courses match your search. Try a different keyword or category.
          </div>
        )}

        {courses.map((course) => (
          <article
            key={course.id}
            className="bg-white border border-sage rounded-[18px] p-6 flex flex-col gap-3.5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_44px_rgba(11,43,38,.14)]"
          >
            <div className="flex items-center gap-3">
              <span className={`w-10.5 h-10.5 rounded-xl ${courseIconBg(course)} flex items-center justify-center text-xl shrink-0`}>
                {courseIcon(course.category)}
              </span>
              <span className="font-heading font-bold text-[11px] tracking-[.08em] uppercase text-pine bg-mint px-3 py-1.5 rounded-full">
                {course.category}
              </span>
            </div>

            <h3 className="font-heading font-bold text-[19px] tracking-[-.3px] m-0">{course.title}</h3>
            <p className="text-sm leading-relaxed text-slate m-0 flex-1">{course.description}</p>

            <div className="flex items-center gap-2.5 pt-3 border-t border-mint">
              <span className="w-7 h-7 rounded-full bg-pine text-white flex items-center justify-center font-heading font-bold text-[11px] shrink-0">
                {course.instructorName
                  .split(' ')
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-heading font-semibold text-[13px] truncate">
                  {course.instructorName}
                </div>
                <div className="text-[11px] text-slate">
                  {course.verifiedTeacherTopic ? 'Verified instructor' : 'Instructor'}
                </div>
              </div>
              <span className="font-heading font-bold text-xs text-pine bg-sand rounded-full px-2.5 py-1.5 shrink-0">
                {course.creditFee} cr
              </span>
            </div>

            <button
              type="button"
              onClick={() => onOpenCourse(course)}
              className="w-full font-heading font-bold text-sm text-white bg-pine border-0 rounded-xl py-3.5 cursor-pointer transition-all duration-300 hover:bg-moss hover:scale-[1.02]"
            >
              View Details
            </button>
          </article>
        ))}
      </section>
    </>
  );
}
