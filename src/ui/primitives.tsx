/**
 * Skillvo UI primitives.
 *
 * Every screen composes these rather than repeating Tailwind strings, so a
 * change to the button shape or the card border happens in one place. The
 * shapes and colours come straight from the approved mockups: 12–20px radii,
 * a 1px sage border on white surfaces, and Poppins on anything that is a
 * heading, label, number or control.
 */
import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'credit';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'text-white bg-pine hover:bg-moss shadow-[0_10px_24px_rgba(11,43,38,.18)]',
  secondary: 'text-pine bg-sage hover:bg-mint',
  ghost: 'text-ink bg-white border border-sage hover:bg-mint',
  danger: 'text-clay bg-white border border-apricot hover:bg-sand',
  credit: 'text-ink bg-sand hover:bg-apricot',
};

const SIZES: Record<Size, string> = {
  sm: 'text-xs px-3.5 py-2 rounded-[10px]',
  md: 'text-sm px-5 py-3 rounded-xl',
  lg: 'text-base px-8 py-4 rounded-[14px]',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`font-heading font-bold cursor-pointer transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${
        VARIANTS[variant]
      } ${SIZES[size]} ${full ? 'w-full' : ''} ${className}`}
    />
  );
}

/** The white surface the whole app is built on. */
export function Card({
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`bg-white border border-sage rounded-[18px] shadow-[0_16px_40px_rgba(101,113,102,.08)] ${className}`}
    >
      {children}
    </div>
  );
}

type Tone = 'mint' | 'sand' | 'sage' | 'pine' | 'clay';

const TONES: Record<Tone, string> = {
  mint: 'bg-mint text-pine',
  sand: 'bg-sand text-ink',
  sage: 'bg-sage text-pine',
  pine: 'bg-pine text-white',
  clay: 'bg-white text-clay border border-apricot',
};

export function Badge({
  tone = 'mint',
  className = '',
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`font-heading font-bold text-[11px] tracking-[.08em] uppercase px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** The credit pill in the header and drawer. Sand is reserved for this. */
export function CreditPill({ credits, className = '' }: { credits: number; className?: string }) {
  return (
    <span
      className={`font-heading font-bold text-sm text-ink bg-sand rounded-full px-4 py-2 inline-flex items-center gap-2 ${className}`}
    >
      <span className="w-2 h-2 rounded-full bg-moss shrink-0" />
      {credits} Credits
    </span>
  );
}

/** Initials disc used wherever a person appears. */
export function Avatar({
  name,
  src,
  size = 34,
  className = '',
}: {
  name: string;
  src?: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }}
      className={`rounded-full bg-pine text-white flex items-center justify-center font-heading font-bold shrink-0 ${className}`}
    >
      {initials || '?'}
    </span>
  );
}

export function Input({
  className = '',
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={`w-full bg-white border border-sage rounded-[14px] px-4 py-3.5 text-[15px] text-ink outline-none placeholder:text-mist focus:border-moss transition-colors ${className}`}
    />
  );
}

export function Textarea({
  className = '',
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={`w-full bg-white border border-sage rounded-[14px] px-4 py-3.5 text-[15px] text-ink outline-none placeholder:text-mist focus:border-moss transition-colors resize-y ${className}`}
    />
  );
}

export function Select({
  className = '',
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={`w-full bg-white border border-sage rounded-[14px] px-4 py-3.5 text-[15px] text-ink outline-none focus:border-moss transition-colors cursor-pointer ${className}`}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-heading font-bold text-[11px] tracking-[.1em] uppercase text-slate block mb-2">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-slate block mt-1.5">{hint}</span>}
    </label>
  );
}

export function SectionTitle({
  title,
  subtitle,
  center = false,
  action,
}: {
  title: string;
  subtitle?: string;
  center?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`mb-5 flex ${
        center ? 'flex-col items-center text-center' : 'items-start justify-between gap-4'
      }`}
    >
      <div>
        <h2 className="font-heading font-bold text-2xl tracking-[-.4px] m-0">{title}</h2>
        {subtitle && <p className="text-sm text-slate mt-1.5 mb-0">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12 px-6 bg-white/60 border border-dashed border-sage rounded-[18px]">
      <h4 className="font-heading font-bold text-base text-ink m-0">{title}</h4>
      <p className="text-sm text-slate max-w-md mx-auto mt-2 mb-4">{body}</p>
      {action}
    </div>
  );
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 rounded-full bg-mint overflow-hidden ${className}`}>
      <span
        className="block h-full bg-moss transition-[width] duration-700"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/**
 * Centred overlay dialog. Clicking the scrim closes; the panel stops
 * propagation so clicks inside never do.
 */
export function Modal({
  onClose,
  children,
  maxWidth = 'max-w-2xl',
  dismissable = true,
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  dismissable?: boolean;
}) {
  return (
    <div
      onClick={dismissable ? onClose : undefined}
      className="fixed inset-0 z-50 bg-[rgba(5,31,32,.5)] backdrop-blur-[2px] flex items-start justify-center p-4 overflow-y-auto animate-overlay-in cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-[20px] w-full ${maxWidth} my-8 shadow-2xl animate-pop cursor-default`}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
  badge,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-7 pb-0">
      <div>
        {badge}
        <h3 className="font-heading font-bold text-xl tracking-[-.4px] mt-2 mb-0">{title}</h3>
        {subtitle && <p className="text-sm text-slate mt-1 mb-0">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="w-9 h-9 rounded-[10px] border-0 bg-transparent text-slate text-xl leading-none cursor-pointer hover:bg-mint transition-colors shrink-0"
      >
        ×
      </button>
    </div>
  );
}

/** The four-triangle Skillvo mark from the mockups. */
export function SkillvoMark({ size = 30 }: { size?: number }) {
  const inner = size * 0.73;
  return (
    <span
      style={{ width: size, height: size }}
      className="rounded-[10px] bg-haze shadow-[0_2px_6px_rgba(5,31,32,.18)] flex items-center justify-center shrink-0"
    >
      <span
        style={{ width: inner, height: inner }}
        className="grid grid-cols-2 grid-rows-2 gap-[2px]"
      >
        <span className="bg-pine" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
        <span className="bg-pine" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} />
        <span className="bg-pine" style={{ clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />
        <span className="bg-pine" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
      </span>
    </span>
  );
}

/** Pill tabs used for the in-page section switchers. */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string; badge?: string | null }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav className="flex items-center gap-2 flex-wrap font-heading font-semibold text-sm">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 rounded-xl cursor-pointer transition-colors flex items-center gap-2 ${
            active === tab.id ? 'bg-pine text-white' : 'text-ink hover:bg-mint'
          }`}
        >
          {tab.label}
          {tab.badge && (
            <span className="bg-sand text-ink text-[10px] font-bold px-2 py-0.5 rounded-full">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
