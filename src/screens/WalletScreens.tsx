/**
 * Credits Wallet — a faithful build of the redesigned "Skillvo Credit Wallet"
 * mockup: earning-rules stat cards up top, then an instant-purchase panel
 * with the three credit packs inline (no separate Buy Credits page).
 *
 * Pack pricing is defined server-side in the razorpay-create-order Edge
 * Function; the list here is display only.
 */
import React from 'react';
import type { UserProfile } from '../types';
import SubPageLayout from '../ui/SubPageLayout';

export interface CreditPack {
  credits: number;
  priceRupees: number;
  packName: string;
  badge: string;
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { credits: 50, priceRupees: 39, packName: 'Starter Credit Pack', badge: 'Standard Pack' },
  { credits: 500, priceRupees: 299, packName: 'Pro Scholar Pack', badge: 'Most Popular', popular: true },
  { credits: 100, priceRupees: 69, packName: 'Popular Learning Pack', badge: 'Best Value' },
];

const EARN_RULES = [
  {
    title: 'First Time Welcome Bonus',
    value: '+50 Credits',
    note: 'Granted upon account creation',
  },
  {
    title: 'Teaching Earnings',
    value: '+10–20 Credits / Student',
    note: 'Earned when approving enrollments',
  },
  {
    title: 'Course Enrollment Cost',
    value: '10–20 Credits',
    note: 'Deducted per enrollment request',
  },
];

const PACK_PERKS = [
  'Instant credit addition to wallet',
  'No expiry on purchased credits',
  'Access to all verified teacher courses',
];

export function WalletScreen({
  user,
  onSelectPack,
  isProcessingPayment,
  onBack,
}: {
  user: UserProfile;
  onSelectPack: (pack: CreditPack) => void;
  isProcessingPayment: boolean;
  onBack: () => void;
}) {
  return (
    <SubPageLayout backLabel="Back to dashboard" onBack={onBack} maxWidth="max-w-[1100px]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading font-bold text-[26px] m-0">Skillvo Credits Wallet</h1>
          <p className="text-sm text-slate mt-2 mb-0 max-w-[52ch]">
            Earn credits by teaching courses, buy credit packs instantly, or spend credits to enroll in
            learning tracks.
          </p>
        </div>
        <span className="font-heading font-bold text-sm text-ink bg-sand rounded-full px-4.5 py-2.5 whitespace-nowrap">
          {user.credits} Credits Available
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6">
        {EARN_RULES.map((rule) => (
          <div key={rule.title} className="bg-white border border-sage rounded-2xl p-5">
            <div className="text-sm text-slate">{rule.title}</div>
            <div className="font-heading font-bold text-xl text-moss mt-1.5">{rule.value}</div>
            <div className="text-xs text-slate mt-1.5">{rule.note}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[20px] bg-forest p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <span className="font-heading font-bold text-[11px] tracking-[.08em] uppercase text-ink bg-sand rounded-full px-3.5 py-2 inline-block">
            Skillvo Instant Credit Store
          </span>
          <div className="bg-white/10 rounded-xl px-4 py-2.5 text-right">
            <div className="font-heading font-bold text-[10px] tracking-[.08em] uppercase text-sage">
              Your balance
            </div>
            <div className="font-heading font-bold text-lg text-white mt-0.5">{user.credits} Credits</div>
          </div>
        </div>

        <h2 className="font-heading font-bold text-2xl text-white mt-5 mb-0">
          Buy Additional Skillvo Credits
        </h2>
        <p className="text-sm text-mint mt-2 mb-0 max-w-[60ch]">
          Select a credit package to unlock instant course enrollments. Choose from{' '}
          {CREDIT_PACKS.map((p) => p.credits).join(', ')} credit packs.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-7 items-start">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.packName}
              className={`relative bg-white rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 ${
                pack.popular
                  ? 'sm:-mt-3 shadow-[0_24px_50px_rgba(5,31,32,.4)] hover:shadow-[0_30px_60px_rgba(5,31,32,.5)]'
                  : 'shadow-[0_16px_34px_rgba(5,31,32,.25)] hover:shadow-[0_24px_46px_rgba(5,31,32,.35)]'
              }`}
            >
              {pack.popular && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 font-heading font-bold text-[11px] tracking-[.04em] uppercase text-ink bg-sand rounded-full px-4 py-1.5 whitespace-nowrap">
                  🔥 Most popular
                </span>
              )}

              <div className="flex items-start justify-between gap-2">
                <span className="font-heading font-bold text-base text-ink">{pack.packName}</span>
                <span className="font-heading font-bold text-[10px] tracking-[.06em] uppercase text-slate bg-haze rounded-full px-2.5 py-1 whitespace-nowrap">
                  {pack.badge}
                </span>
              </div>

              <div className="mt-4">
                <span className="font-heading font-extrabold text-3xl text-ink">₹{pack.priceRupees}</span>{' '}
                <span className="text-sm text-slate">/ one-time</span>
              </div>

              <div className="bg-sand rounded-xl px-4 py-3.5 mt-4">
                <div className="font-heading font-bold text-lg text-ink">+{pack.credits} Credits</div>
                <div className="text-xs text-ink/70 mt-0.5">Instant balance credit</div>
              </div>

              <ul className="list-none p-0 mt-4 flex flex-col gap-2">
                {PACK_PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-[13px] text-slate">
                    <span className="text-moss shrink-0">✓</span>
                    {perk}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={isProcessingPayment}
                onClick={() => onSelectPack(pack)}
                className="w-full mt-5 font-heading font-bold text-sm text-white bg-pine border-0 rounded-xl py-3.5 cursor-pointer transition-colors hover:bg-moss disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isProcessingPayment ? 'Please wait…' : `Buy Now (₹${pack.priceRupees})`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </SubPageLayout>
  );
}
