/**
 * Chrome for the secondary pages — Wallet, Buy Credits, Leaderboard, Profile,
 * Account Settings, Publish Course.
 *
 * These do NOT use the drawer shell. In the approved design each carries a
 * plain "← Back to …" link, the Skillvo wordmark, and (on Profile and Buy
 * Credits) the credit pill. Keep it that way — the drawer belongs to Home and
 * the Dashboard only.
 */
import React from 'react';
import { SkillvoMark } from './primitives';

export default function SubPageLayout({
  backLabel,
  onBack,
  credits,
  maxWidth = 'max-w-[800px]',
  dark = false,
  children,
}: {
  backLabel: string;
  onBack: () => void;
  /** Pass to show the credit pill in the header. */
  credits?: number;
  maxWidth?: string;
  /** Account Settings is a dark page in the design (#051F20 body). */
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative min-h-screen ${dark ? 'bg-ink text-white' : 'bg-haze'}`}>
      <header
        className={`sticky top-0 z-20 backdrop-blur-[14px] border-b ${
          dark
            ? 'bg-[rgba(5,31,32,.82)] border-white/10'
            : 'bg-[rgba(239,248,242,.82)] border-[rgba(142,182,155,.5)]'
        }`}
      >
        <div className={`${maxWidth} mx-auto px-6 py-4 flex items-center gap-4`}>
          <button
            type="button"
            onClick={onBack}
            className={`flex items-center gap-2 font-heading font-semibold text-sm transition-colors cursor-pointer bg-transparent border-0 p-0 ${
              dark ? 'text-sage hover:text-white' : 'text-moss hover:text-ink'
            }`}
          >
            <span aria-hidden="true">←</span>
            <span>{backLabel}</span>
          </button>

          <span className="flex items-center gap-2.5 ml-auto">
            <SkillvoMark />
            <span className={`font-heading font-bold text-lg tracking-[-.4px] ${dark ? 'text-white' : 'text-ink'}`}>
              Skillvo
            </span>
          </span>

          {credits !== undefined && (
            <span className="font-heading font-bold text-sm text-ink bg-sand rounded-full px-4 py-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-moss shrink-0" />
              {credits} Credits
            </span>
          )}
        </div>
      </header>

      <main className={`relative z-1 ${maxWidth} mx-auto px-6 pt-10 pb-20 animate-rise`}>{children}</main>

      <footer
        className={`border-t py-7 px-6 text-center text-sm ${
          dark ? 'border-white/10 text-sage' : 'border-[rgba(183,199,174,.7)] text-mist'
        }`}
      >
        Skillvo — learning that adds up.
      </footer>
    </div>
  );
}
