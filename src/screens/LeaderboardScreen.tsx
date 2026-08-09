/**
 * Leaderboard — a faithful build of "Skillvo Leaderboard.dc.html": hero pill,
 * filter tabs, the three-place podium with falling confetti, the "you're rank
 * #n" streak banner, full rankings, and the dashed card that pins your own row
 * when you fall outside the visible list.
 *
 * Points are XP, and each tab ranks on the XP that tab is about (see
 * listLeaderboard) so the order shown is the order the server produced.
 */
import React from 'react';
import type { LeaderboardUser, UserProfile } from '../types';
import SubPageLayout from '../ui/SubPageLayout';

export type LeaderboardFilter = 'all' | 'teachers' | 'students';

const TABS: Array<{ id: LeaderboardFilter; label: string }> = [
  { id: 'all', label: 'Everyone' },
  { id: 'teachers', label: 'Teachers' },
  { id: 'students', label: 'Students' },
];

function pointsFor(entry: LeaderboardUser, filter: LeaderboardFilter): number {
  if (filter === 'teachers') return entry.teachingXp;
  if (filter === 'students') return entry.learningXp;
  return entry.xpPoints;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/** 2nd, 1st, 3rd — the winner stands in the middle on a taller plinth. */
const PODIUM_STYLE = [
  { order: 2, avatarSize: 76, fontSize: 24, barHeight: 96, barBg: 'bg-pine', ring: 'border-sand' },
  { order: 1, avatarSize: 60, fontSize: 19, barHeight: 68, barBg: 'bg-moss', ring: 'border-sage' },
  { order: 3, avatarSize: 56, fontSize: 18, barHeight: 52, barBg: 'bg-sage', ring: 'border-mint' },
];

export default function LeaderboardScreen({
  user,
  entries,
  filter,
  onFilterChange,
  onBack,
}: {
  user: UserProfile;
  entries: LeaderboardUser[];
  filter: LeaderboardFilter;
  onFilterChange: (filter: LeaderboardFilter) => void;
  onBack: () => void;
}) {
  const [revealed, setRevealed] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const maxScore = Math.max(1, ...entries.map((entry) => pointsFor(entry, filter)));
  const podium = entries.slice(0, 3);
  const myIndex = entries.findIndex((entry) => entry.id === user.id);
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const myScore = myIndex >= 0 ? pointsFor(entries[myIndex], filter) : user.xpPoints;
  const pointsToNext =
    myIndex > 0 ? Math.max(0, pointsFor(entries[myIndex - 1], filter) - myScore) : 0;

  // The full list already shows everyone; pin a dashed row only when the
  // learner is outside the first 10 and would have to scroll to find it.
  const showMyRankCard = myIndex >= 10;

  return (
    <SubPageLayout backLabel="Back to dashboard" onBack={onBack} maxWidth="max-w-[900px]">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 font-heading text-xs font-bold tracking-[.1em] uppercase text-moss bg-white border border-sage px-4 py-2 rounded-full">
          🔥 This week
        </span>
        <h1 className="font-heading font-extrabold text-[32px] tracking-[-.6px] mt-4 mb-0">
          Who's leading the charge?
        </h1>
        <p className="text-[15px] text-slate mt-2 mb-0">
          Every lesson counts. Climb the board and earn bragging rights.
        </p>
      </div>

      <div className="flex justify-center gap-1.5 bg-white border border-sage rounded-[14px] p-1.5 mt-6 mx-auto w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onFilterChange(tab.id)}
            className={`font-heading font-semibold text-sm px-6 py-2.5 rounded-[10px] border-0 cursor-pointer whitespace-nowrap transition-colors ${
              filter === tab.id ? 'bg-pine text-white' : 'bg-transparent text-ink hover:bg-mint'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-center text-sm text-slate py-16">
          No rankings yet — complete a course or teach one to appear on the board.
        </p>
      ) : (
        <>
          {podium.length === 3 && (
            <div className="relative flex items-end justify-center gap-4 mt-10 px-2.5">
              <span
                aria-hidden="true"
                className="absolute -top-2.5 left-[20%] w-2 h-2 rounded-sm bg-sand"
                style={{ animation: 'confettiFall 3.2s linear infinite .2s' }}
              />
              <span
                aria-hidden="true"
                className="absolute -top-2.5 left-1/2 w-2 h-2 rounded-sm bg-apricot"
                style={{ animation: 'confettiFall 2.8s linear infinite .6s' }}
              />
              <span
                aria-hidden="true"
                className="absolute -top-2.5 left-[78%] w-2 h-2 rounded-sm bg-sage"
                style={{ animation: 'confettiFall 3.5s linear infinite 1s' }}
              />

              {podium.map((entry, index) => {
                const style = PODIUM_STYLE[index];
                return (
                  <div
                    key={entry.id}
                    style={{ order: style.order, animationDelay: `${index * 0.12}s` }}
                    className="flex flex-col items-center gap-2.5"
                  >
                    <div style={{ animation: 'podiumUp .5s cubic-bezier(.22,1,.36,1) both' }} className="flex flex-col items-center gap-2.5">
                      {index === 0 && (
                        <span
                          className="text-[26px]"
                          style={{ animation: 'crownFloat 2.4s ease-in-out infinite' }}
                        >
                          👑
                        </span>
                      )}
                      <span
                        style={{
                          width: style.avatarSize,
                          height: style.avatarSize,
                          fontSize: style.fontSize,
                        }}
                        className={`rounded-full bg-mint text-ink flex items-center justify-center font-heading font-bold border-[3px] ${style.ring}`}
                      >
                        {initials(entry.name)}
                      </span>
                      <div className="font-heading font-bold text-sm text-center max-w-[100px] truncate">
                        {entry.id === user.id ? 'You' : entry.name}
                      </div>
                      <div className="font-heading font-extrabold text-[13px] text-moss">
                        {pointsFor(entry, filter)} pts
                      </div>
                      <div
                        style={{ height: style.barHeight }}
                        className={`w-[92px] rounded-t-xl ${style.barBg} flex items-start justify-center pt-2.5`}
                      >
                        <span className="font-heading font-extrabold text-xl text-white">
                          {index + 1}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {myRank && (
            <div className="mt-9 rounded-[18px] bg-gradient-to-br from-pine to-moss px-6 py-5.5 flex items-center gap-4 text-white">
              <span className="text-[28px]" style={{ animation: 'flamePulse 1.6s ease-in-out infinite' }}>
                🔥
              </span>
              <div>
                <div className="font-heading font-bold text-[15px]">
                  {myRank === 1
                    ? "You're rank #1 — nobody's ahead of you"
                    : `You're rank #${myRank} — ${pointsToNext} pts from the next spot`}
                </div>
                <div className="text-[13px] text-mint mt-1">
                  Finish one more lesson today to keep your streak alive.
                </div>
              </div>
            </div>
          )}

          <h2 className="font-heading font-bold text-lg mt-8 mb-3.5">Full rankings</h2>
          <div className="bg-white border border-sage rounded-[20px] p-3 shadow-[0_16px_40px_rgba(11,43,38,.08)]">
            {entries.map((entry, index) => {
              const isYou = entry.id === user.id;
              const score = pointsFor(entry, filter);
              return (
                <div
                  key={entry.id}
                  style={{ animationDelay: `${Math.min(index, 8) * 0.06}s` }}
                  className={`flex items-center gap-3.5 px-4 py-3.5 rounded-[14px] animate-row-in transition-transform duration-200 hover:translate-x-1 ${
                    isYou ? 'bg-[rgba(231,169,143,.18)]' : ''
                  }`}
                >
                  <span
                    className={`font-heading font-bold text-[15px] w-6.5 text-center shrink-0 ${
                      index === 0 ? 'text-bronze' : 'text-ink'
                    }`}
                  >
                    {index + 1}
                  </span>

                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-heading font-bold text-[15px] shrink-0 relative ${
                      isYou ? 'bg-forest text-white' : 'bg-mint text-ink'
                    }`}
                  >
                    {initials(entry.name)}
                    {index === 0 && (
                      <span
                        className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-base"
                        style={{ animation: 'crownFloat 1.6s ease-in-out infinite' }}
                      >
                        👑
                      </span>
                    )}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-semibold text-[15px] truncate">
                      {isYou ? 'You' : entry.name}
                    </div>
                    <div className="text-[11px] text-slate mt-px truncate">
                      {entry.levelTitle} • {entry.coursesTaughtCount} taught •{' '}
                      {entry.coursesCompletedCount} completed
                    </div>
                  </div>

                  <div className="w-[120px] h-1.5 rounded-full bg-mint overflow-hidden hidden sm:block shrink-0">
                    <span
                      className="block h-full bg-moss"
                      style={{
                        width: revealed ? `${(score / maxScore) * 100}%` : 0,
                        transition: 'width 1.1s cubic-bezier(.22,1,.36,1)',
                      }}
                    />
                  </div>

                  <span className="font-heading font-bold text-sm w-[70px] text-right shrink-0">
                    {score}
                  </span>
                </div>
              );
            })}
          </div>

          {showMyRankCard && myRank && (
            <div className="mt-3.5 flex items-center gap-3.5 px-4 py-3.5 rounded-[14px] border-2 border-dashed border-sage bg-[rgba(142,182,155,.1)]">
              <span className="font-heading font-bold text-[15px] w-6.5 text-center text-moss shrink-0">
                {myRank}
              </span>
              <span className="w-10 h-10 rounded-full bg-forest text-white flex items-center justify-center font-heading font-bold text-[15px] shrink-0">
                {initials(user.name)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-heading font-semibold text-[15px]">You</div>
                <div className="text-[11px] text-slate mt-px">{user.levelTitle}</div>
              </div>
              <span className="font-heading font-bold text-sm w-[70px] text-right">{myScore}</span>
            </div>
          )}
        </>
      )}
    </SubPageLayout>
  );
}
