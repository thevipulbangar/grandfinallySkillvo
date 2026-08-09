/**
 * The signed-in chrome: sticky translucent header, slide-in navigation drawer,
 * and the centred content column every screen sits in.
 *
 * The drawer is the primary navigation in this design — the header only
 * carries identity and the credit balance — so every destination has to be
 * reachable from it, including the ones the mockups show as separate pages.
 */
import React from 'react';
import type { UserProfile } from '../types';
import ChatWidget from './ChatWidget';
import { Avatar, Button, CreditPill, SkillvoMark } from './primitives';

export type Screen =
  | 'home'
  | 'explore'
  | 'learning'
  | 'teaching'
  | 'wallet'
  | 'leaderboard'
  | 'profile'
  | 'settings'
  | 'publish';

// Exactly the six entries in the approved drawer, in order. Home is reached
// from the wordmark, and Account Settings from within Profile — adding them
// here would not match the design.
const MENU: Array<{ id: Screen; label: string }> = [
  { id: 'explore', label: 'Explore Courses' },
  { id: 'learning', label: 'My Enrolled Courses' },
  { id: 'teaching', label: "Courses I'm Teaching" },
  { id: 'wallet', label: 'Credits Wallet' },
  { id: 'leaderboard', label: 'Leaderboard & Rankings' },
  { id: 'profile', label: 'Settings' },
];

interface Props {
  user: UserProfile;
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  onPublishCourse: () => void;
  onSignOut: () => void;
  notificationsSlot?: React.ReactNode;
  children: React.ReactNode;
}

export default function AppShell({
  user,
  screen,
  onNavigate,
  onPublishCourse,
  onSignOut,
  notificationsSlot,
  children,
}: Props) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const go = (next: Screen) => {
    onNavigate(next);
    setMenuOpen(false);
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-haze">
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 bg-[rgba(5,31,32,.45)] animate-overlay-in"
          />
          <nav className="fixed top-0 left-0 bottom-0 z-41 w-[min(340px,88vw)] bg-white shadow-[0_0_60px_rgba(5,31,32,.25)] p-7 overflow-y-auto animate-drawer-in">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <SkillvoMark />
                <div>
                  <div className="font-heading font-bold text-[17px] tracking-[-.3px]">
                    Skillvo Navigation
                  </div>
                  <div className="text-xs text-slate mt-0.5">Teach &amp; Learn Platform</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation"
                className="w-8 h-8 rounded-lg border-0 bg-transparent text-slate text-lg cursor-pointer hover:bg-mint transition-colors"
              >
                ×
              </button>
            </div>

            <button
              type="button"
              onClick={() => go('profile')}
              className="w-full flex items-center gap-3 mt-6 p-3.5 border border-sage rounded-[14px] cursor-pointer bg-transparent hover:bg-mint transition-colors text-left"
            >
              <Avatar name={user.name} src={user.avatar} size={38} />
              <span className="font-heading font-semibold text-sm flex-1 min-w-0 truncate">
                {user.name}
              </span>
              <span className="font-heading font-bold text-xs text-ink bg-sand rounded-full px-2.5 py-1 flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-moss" />
                {user.credits}
              </span>
            </button>

            <div className="font-heading font-bold text-[11px] tracking-[.1em] uppercase text-slate mt-6 mb-2.5">
              Menu categories
            </div>
            <div className="flex flex-col gap-1">
              {MENU.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  className={`text-left px-3.5 py-3 rounded-xl font-heading font-semibold text-sm cursor-pointer transition-colors ${
                    screen === item.id ? 'bg-pine text-white' : 'text-ink hover:bg-mint'
                  }`}
                >
                  {item.label}
                  {item.id === 'wallet' && ` (${user.credits})`}
                </button>
              ))}
            </div>

            <Button
              full
              className="mt-5"
              onClick={() => {
                setMenuOpen(false);
                onPublishCourse();
              }}
            >
              + Publish Course &amp; Skill Test
            </Button>

            <Button variant="danger" full className="mt-7" onClick={onSignOut}>
              Sign out
            </Button>
          </nav>
        </>
      )}

      <header className="sticky top-0 z-30 backdrop-blur-[14px] bg-[rgba(239,248,242,.82)] border-b border-[rgba(142,182,155,.5)]">
        <div className="max-w-[1240px] mx-auto px-6 py-4 flex items-center justify-between gap-5">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
              className="w-9.5 h-9.5 rounded-[10px] border border-sage bg-white cursor-pointer flex flex-col items-center justify-center gap-1 hover:bg-mint transition-colors"
            >
              <span className="w-4 h-0.5 bg-ink rounded-sm" />
              <span className="w-4 h-0.5 bg-ink rounded-sm" />
              <span className="w-4 h-0.5 bg-ink rounded-sm" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2.5 cursor-pointer bg-transparent border-0 p-0"
            >
              <SkillvoMark />
              <span className="font-heading font-bold text-lg tracking-[-.4px] text-ink">Skillvo</span>
            </button>
            <span className="font-heading font-semibold text-xs text-pine bg-sage px-3 py-1.5 rounded-full hidden sm:block">
              Teach &amp; Learn
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            {notificationsSlot}
            <button
              type="button"
              onClick={() => onNavigate('wallet')}
              className="cursor-pointer bg-transparent border-0 p-0 hidden sm:block"
            >
              <CreditPill credits={user.credits} className="hover:bg-apricot transition-colors" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="flex items-center gap-2.5 cursor-pointer bg-transparent border-0 p-0"
            >
              <Avatar name={user.name} src={user.avatar} size={34} />
              <span className="font-heading font-semibold text-sm text-ink hidden sm:block">
                {user.name}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-1 max-w-[1240px] mx-auto px-6 pt-8 pb-10">
        {/* The Dashboard's centred section links. Home shows no nav row. */}
        {screen !== 'home' && (
          <nav className="flex items-center justify-center gap-7 mb-6 font-heading font-semibold text-sm flex-wrap">
            {(
              [
                ['home', 'Home'],
                ['explore', 'Explore'],
                ['learning', 'My Learning'],
                ['teaching', "Courses I'm Teaching"],
              ] as Array<[Screen, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className={`cursor-pointer bg-transparent border-0 p-0 transition-colors ${
                  screen === id ? 'text-pine' : 'text-ink hover:text-pine'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
        {children}
      </main>

      <footer className="border-t border-[rgba(142,182,155,.6)] py-7 px-6 text-center text-sm text-slate">
        Skillvo — learning that adds up.
      </footer>

      {screen === 'home' && <ChatWidget />}
    </div>
  );
}
