/**
 * Signed-in home: a welcome hero, the four-step platform tour carousel, a
 * leaderboard preview and "pick up where you left off" cards.
 *
 * Everything here is real data — the leaderboard rows and the suggestions come
 * from the same state the dedicated screens use, so the preview can never
 * disagree with the full page.
 */
import React from 'react';
import type { Course, EnrolledCourseState, LeaderboardUser, UserProfile } from '../types';
import type { Screen } from '../ui/AppShell';
import { Avatar, Button, Card, EmptyState } from '../ui/primitives';

/** The four steps, copy and colours exactly as in "Skillvo Home.dc.html". */
const TOUR = [
  {
    title: 'Start any topic, zero prerequisites',
    body: 'Browse the full catalog and jump straight into a lesson — no application, no waitlist.',
    bg: 'bg-mint',
    text: 'text-ink',
    paths: ['M12 3a9 9 0 1 0 9 9', 'M12 7v5l4 2'],
    stroke: '#0B2B26',
  },
  {
    title: 'Earn credits as you learn',
    body: 'Every completed lesson and project adds real credits to your balance.',
    bg: 'bg-sage',
    text: 'text-ink',
    paths: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M12 13v4', 'M9 21h6'],
    stroke: '#C99A6B',
  },
  {
    title: 'Climb the leaderboard',
    body: 'Compare your weekly progress with the community and stay motivated.',
    bg: 'bg-pine',
    text: 'text-white',
    paths: ['M4 20h4v-8H4z', 'M10 20h4V6h-4z', 'M16 20h4v-11h-4z'],
    stroke: '#C4816B',
  },
  {
    title: 'Redeem for real credentials',
    body: 'Turn banked credits into certificates that employers recognize.',
    bg: 'bg-mint',
    text: 'text-ink',
    paths: ['M12 3l3 6 6 1-4.5 4.5L18 21l-6-3-6 3 1.5-6.5L3 10l6-1z'],
    stroke: '#0B2B26',
  },
];

function TourIcon({ paths, stroke }: { paths: string[]; stroke: string }) {
  return (
    <svg
      width={40}
      height={40}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

interface Props {
  user: UserProfile;
  courses: Course[];
  leaderboard: LeaderboardUser[];
  onNavigate: (screen: Screen) => void;
  onOpenCourse: (course: Course) => void;
}

export default function HomeScreen({ user, courses, leaderboard, onNavigate, onOpenCourse }: Props) {
  const [step, setStep] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const topFive = leaderboard.slice(0, 5);
  const maxScore = Math.max(1, ...topFive.map((entry) => entry.creditsEarned));

  // In-progress courses first, then anything else on offer.
  const inProgress = user.enrolledCourses
    .filter((enrolled) => enrolled.status === 'approved')
    .map((enrolled) => ({
      enrolled,
      course: courses.find((course) => course.id === enrolled.courseId),
    }))
    .filter((row): row is { enrolled: EnrolledCourseState; course: Course } => Boolean(row.course));

  const enrolledIds = new Set(user.enrolledCourses.map((e) => e.courseId));
  const recommended = courses
    .filter((course) => !enrolledIds.has(course.id) && course.instructorId !== user.id)
    .slice(0, 3);

  return (
    <>
      <section className="relative text-center max-w-[640px] mx-auto py-6">
        <span className="inline-flex items-center gap-2 font-heading text-xs font-semibold tracking-[.12em] uppercase text-forest bg-white border border-sage px-3.5 py-2 rounded-full animate-pop">
          Welcome back
        </span>
        <h1 className="font-heading font-bold text-[clamp(30px,4vw,44px)] leading-[1.15] tracking-[-1px] mt-4.5 mb-0 animate-rise">
          Hey {user.name.split(' ')[0]}, ready to keep the streak going?
        </h1>
        <p className="text-base leading-relaxed text-forest mt-3.5 mb-0 animate-rise">
          You've got {user.credits} credits banked. Here's what you can do next.
        </p>
        <div className="flex items-center justify-center gap-3.5 flex-wrap mt-7 animate-rise">
          <button
            type="button"
            onClick={() => onNavigate('explore')}
            className="inline-flex items-center gap-2.5 font-heading font-bold text-[17px] text-white bg-forest rounded-[14px] px-9 py-4.5 cursor-pointer shadow-[0_16px_36px_rgba(11,43,38,.32)] transition-all duration-300 hover:bg-moss hover:scale-105 hover:shadow-[0_20px_44px_rgba(11,43,38,.4)]"
          >
            Go to Dashboard <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-heading font-bold text-2xl tracking-[-.4px] mb-5 text-center">
          What you can do with Skillvo
        </h2>
        <div className="relative">
          <div className="overflow-hidden rounded-[20px]">
            <div
              className="flex transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
              style={{ transform: `translateX(-${step * 100}%)` }}
            >
              {TOUR.map((item, index) => (
                <div
                  key={item.title}
                  className={`flex-[0_0_100%] grid grid-cols-1 md:grid-cols-2 min-h-[260px] ${item.bg}`}
                >
                  <div className="p-10 flex flex-col justify-center gap-2.5">
                    <span
                      className={`font-heading font-bold text-[13px] tracking-[.1em] uppercase opacity-75 ${item.text}`}
                    >
                      Step {index + 1} of {TOUR.length}
                    </span>
                    <h3 className={`font-heading font-bold text-[26px] tracking-[-.4px] m-0 ${item.text}`}>
                      {item.title}
                    </h3>
                    <p className={`text-[15px] leading-relaxed max-w-[40ch] m-0 ${item.text}`}>
                      {item.body}
                    </p>
                  </div>
                  <div className="flex items-center justify-center p-6">
                    <span className="w-24 h-24 rounded-[28px] bg-white/60 flex items-center justify-center">
                      <TourIcon paths={item.paths} stroke={item.stroke} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep((s) => (s + TOUR.length - 1) % TOUR.length)}
            aria-label="Previous step"
            className="absolute -left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full border border-sage bg-white text-ink text-lg cursor-pointer hover:bg-mint transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => (s + 1) % TOUR.length)}
            aria-label="Next step"
            className="absolute -right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full border border-sage bg-white text-ink text-lg cursor-pointer hover:bg-mint transition-colors"
          >
            ›
          </button>
        </div>
        <div className="flex justify-center gap-2 mt-4.5">
          {TOUR.map((item, index) => (
            <button
              key={item.title}
              type="button"
              onClick={() => setStep(index)}
              aria-label={`Go to step ${index + 1}`}
              className={`w-2.5 h-2.5 rounded-full border-0 cursor-pointer transition-colors ${
                index === step ? 'bg-moss' : 'bg-mint'
              }`}
            />
          ))}
        </div>
      </section>

      <section className="mt-20">
        <div className="text-center mb-7">
          <h2 className="font-heading font-bold text-2xl tracking-[-.4px] m-0">
            This week's leaderboard
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('leaderboard')}
            className="inline-block mt-1.5 text-[13px] font-semibold text-forest cursor-pointer bg-transparent border-0 hover:underline"
          >
            See full rankings →
          </button>
          <p className="text-sm text-forest mt-2 mb-0">Credits earned across the platform this week</p>
        </div>

        <Card className="max-w-[640px] mx-auto p-3">
          {topFive.length === 0 ? (
            <p className="text-sm text-slate text-center py-8 m-0">
              No rankings yet — complete a course to appear here.
            </p>
          ) : (
            topFive.map((entry, index) => {
              const isYou = entry.id === user.id;
              return (
                <div
                  key={entry.id}
                  style={{ animationDelay: `${index * 0.12}s` }}
                  className={`flex items-center gap-3.5 px-4 py-3.5 rounded-[14px] animate-row-in ${
                    isYou ? 'bg-[rgba(231,169,143,.18)]' : ''
                  }`}
                >
                  <span
                    className={`font-heading font-bold text-[15px] w-6 text-center ${
                      index === 0 ? 'text-bronze' : 'text-ink'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="relative shrink-0">
                    <Avatar name={entry.name} src={entry.avatar} size={40} />
                    {index === 0 && (
                      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-base animate-crown">
                        👑
                      </span>
                    )}
                  </span>
                  <span className="flex-1 font-heading font-semibold text-[15px] min-w-0 truncate">
                    {isYou ? 'You' : entry.name}
                  </span>
                  <div className="w-[120px] h-1.5 rounded-full bg-mint overflow-hidden hidden sm:block">
                    <span
                      className="block h-full bg-moss"
                      style={{ width: revealed ? `${(entry.creditsEarned / maxScore) * 100}%` : 0, transition: 'width 1.1s cubic-bezier(.22,1,.36,1)' }}
                    />
                  </div>
                  <span className="font-heading font-bold text-sm w-16 text-right text-ink">
                    {entry.creditsEarned}
                  </span>
                </div>
              );
            })
          )}
        </Card>
      </section>

      <section className="mt-20">
        <h2 className="font-heading font-bold text-2xl tracking-[-.4px] mb-5 text-center">
          Pick up where you left off
        </h2>

        {inProgress.length === 0 && recommended.length === 0 ? (
          <EmptyState
            title="Nothing in progress yet"
            body="Browse the catalogue and request enrollment in your first course."
            action={<Button onClick={() => onNavigate('explore')}>Explore Courses</Button>}
          />
        ) : (
          /* Three slots, tags and colours exactly as the mockup: In progress
             (mint), Recommended (sage), Trending (pine, white text). */
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
            {[
              inProgress[0]
                ? {
                    tag: 'In progress',
                    course: inProgress[0].course,
                    body: `Pick up where you left off — you're ${inProgress[0].enrolled.progress}% through.`,
                    bg: 'bg-mint',
                    text: 'text-ink',
                  }
                : null,
              recommended[0]
                ? {
                    tag: 'Recommended',
                    course: recommended[0],
                    body: `${recommended[0].category} • ${recommended[0].creditFee} credits`,
                    bg: 'bg-sage',
                    text: 'text-ink',
                  }
                : null,
              recommended[1]
                ? {
                    tag: 'Trending',
                    course: recommended[1],
                    body: `${recommended[1].studentsCount} learners enrolled so far.`,
                    bg: 'bg-pine',
                    text: 'text-white',
                  }
                : null,
            ]
              .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot))
              .map((slot) => (
                <button
                  key={slot.course.id}
                  type="button"
                  onClick={() => onOpenCourse(slot.course)}
                  className={`text-left rounded-2xl p-6 border border-[rgba(183,199,174,.7)] cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(101,113,102,.14)] ${slot.bg}`}
                >
                  <span className={`font-heading font-semibold text-xs tracking-[.1em] uppercase opacity-80 ${slot.text}`}>
                    {slot.tag}
                  </span>
                  <h3 className={`font-heading font-bold text-lg mt-2 mb-1.5 ${slot.text}`}>
                    {slot.course.title}
                  </h3>
                  <p className={`text-sm leading-snug m-0 ${slot.text}`}>{slot.body}</p>
                </button>
              ))}
          </div>
        )}
      </section>
    </>
  );
}
