/**
 * Sign-in and sign-up — a faithful build of "login page.dc.html".
 *
 * The split card, blurred background video, drifting blobs and success overlay
 * all come from that file. Forgot-password, email-verification and
 * reset-password are not in the design; they reuse this exact card and field
 * styling with different copy rather than introducing new visual language.
 */
import React from 'react';
import { SkillvoMark } from '../ui/primitives';

export type AuthMode = 'login' | 'register' | 'forgot' | 'verify' | 'reset';

const FIELD =
  'w-full text-[15px] text-ink bg-white border rounded-xl px-4 py-3.5 outline-none transition-shadow focus:border-moss focus:shadow-[0_0_0_4px_rgba(153,205,216,.3)] placeholder:text-mist';
const LABEL = 'block font-heading font-semibold text-[13px] text-ink mb-1.5';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .98 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}

export interface AuthScreenProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  name: string;
  onNameChange: (value: string) => void;
  emailError?: string;
  passwordError?: string;
  notice?: string;
  isSubmitting: boolean;
  onSubmit: () => void;
  onGoogle: () => void;
  onResendVerification: () => void;
  /** Shown as a full-screen confirmation when set. */
  success?: { title: string; body: string } | null;
}

export default function AuthScreen({
  mode,
  onModeChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  name,
  onNameChange,
  emailError,
  passwordError,
  notice,
  isSubmitting,
  onSubmit,
  onGoogle,
  onResendVerification,
  success,
}: AuthScreenProps) {
  if (success) {
    return (
      <div
        className="fixed inset-0 z-50 bg-haze flex flex-col items-center justify-center gap-4.5 px-6 text-center"
        style={{ animation: 'overlayIn .3s ease both' }}
      >
        <span
          className="w-21 h-21 rounded-full bg-pine flex items-center justify-center"
          style={{ animation: 'checkPop .5s cubic-bezier(.22,1,.36,1) both' }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M4 12l5 5L20 6"
              strokeDasharray="24"
              style={{ animation: 'checkDraw .5s ease .2s forwards' }}
            />
          </svg>
        </span>
        <h1 className="font-heading font-bold text-2xl text-ink m-0">{success.title}</h1>
        <p className="text-[15px] text-slate m-0">{success.body}</p>
      </div>
    );
  }

  const isLogin = mode === 'login';
  const isRegister = mode === 'register';

  return (
    <div className="relative min-h-screen overflow-clip flex items-center justify-center p-6">
      <video
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none scale-110 opacity-35"
        style={{ filter: 'blur(18px) saturate(1.1)' }}
      >
        <source src="/uploads/hero-bg-video.mp4" type="video/mp4" />
      </video>
      <div aria-hidden="true" className="absolute inset-0 bg-[rgba(239,248,242,.55)] z-0 pointer-events-none" />
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute -top-40 -left-35 w-[620px] h-[620px] rounded-full"
          style={{
            background: 'radial-gradient(circle at 40% 40%, #DAF1DE 0%, rgba(218,235,227,0) 68%)',
            animation: 'driftBlob 26s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-45 -right-37 w-[560px] h-[560px] rounded-full"
          style={{
            background: 'radial-gradient(circle at 55% 45%, #8EB69B 0%, rgba(253,232,211,0) 70%)',
            animation: 'driftBlob 32s ease-in-out infinite reverse',
          }}
        />
      </div>

      <div className="relative z-1 w-full max-w-[960px] grid grid-cols-1 md:grid-cols-2 rounded-3xl overflow-hidden bg-white border border-sage shadow-[0_40px_90px_rgba(5,31,32,.22),0_12px_32px_rgba(11,43,38,.16)] animate-pop">
        <div
          className="bg-mint px-10 py-12 flex flex-col justify-between"
          style={{
            backgroundImage: "url('/uploads/education-doodle-pattern.jpg')",
            backgroundSize: '420px',
            backgroundRepeat: 'repeat',
          }}
        >
          <span className="flex items-center gap-2.5 text-ink">
            <SkillvoMark />
            <span className="font-heading font-bold text-lg tracking-[-.4px]">Skillvo</span>
          </span>

          <div className="mt-10">
            <h2 className="font-heading font-bold text-[clamp(24px,3vw,32px)] leading-[1.2] tracking-[-.6px] text-ink m-0">
              Start with zero prerequisites. Learn at your own pace.
            </h2>
            <p className="text-[15px] leading-relaxed text-ink mt-3.5 mb-0 max-w-[34ch]">
              Earn real credits that matter. Your journey to mastery begins here.
            </p>
            <div className="inline-flex items-center gap-2.5 mt-5.5 font-heading font-bold text-sm text-white bg-moss px-4.5 py-2.5 rounded-full shadow-[0_10px_22px_rgba(153,205,216,.5)]">
              <span className="w-4 h-4 rounded-full bg-white/85 shrink-0" />
              Sign up today and get 50 credits free
            </div>
          </div>

          <p className="text-[13px] text-forest mt-10 mb-0">
            Trusted by a fast-growing community of students.
          </p>
        </div>

        <div className="px-10 py-12 flex flex-col">
          {(isLogin || isRegister) && (
            <div className="flex gap-1 bg-haze border border-sage rounded-xl p-1 mb-7">
              {(
                [
                  ['login', 'Log in'],
                  ['register', 'Sign up'],
                ] as Array<[AuthMode, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onModeChange(id)}
                  className={`flex-1 font-heading font-semibold text-sm py-2.5 border-0 rounded-[9px] cursor-pointer transition-colors ${
                    mode === id ? 'bg-pine text-white' : 'bg-transparent text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div style={{ animation: 'rise .5s cubic-bezier(.22,1,.36,1) both' }}>
            <h1 className="font-heading font-bold text-[26px] tracking-[-.5px] text-ink m-0">
              {isLogin && 'Welcome back'}
              {isRegister && 'Create your account'}
              {mode === 'forgot' && 'Reset your password'}
              {mode === 'verify' && 'Check your inbox'}
              {mode === 'reset' && 'Choose a new password'}
            </h1>
            <p className="text-sm text-forest mt-2 mb-6">
              {isLogin && 'Log in to keep earning credits.'}
              {isRegister && 'Sign up today and get 50 credits free.'}
              {mode === 'forgot' && "Enter your email and we'll send you a reset link."}
              {mode === 'verify' && `We sent a verification link to ${email || 'your email'}.`}
              {mode === 'reset' && 'Pick something you have not used before.'}
            </p>

            {notice && (
              <p className="text-[13px] text-moss bg-mint rounded-xl px-4 py-3 mt-0 mb-5">{notice}</p>
            )}

            {mode === 'verify' ? (
              <>
                <button
                  type="button"
                  onClick={onResendVerification}
                  className="w-full font-heading font-bold text-base text-white bg-forest border-0 rounded-xl py-4 min-h-12 cursor-pointer shadow-[0_10px_24px_rgba(94,156,170,.45)] transition-transform duration-200 hover:scale-[1.02]"
                >
                  Resend verification email
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange('login')}
                  className="w-full mt-3 font-heading font-semibold text-sm text-forest bg-transparent border-0 cursor-pointer hover:underline"
                >
                  Back to log in
                </button>
              </>
            ) : (
              <>
                {isRegister && (
                  <>
                    <label className={LABEL}>Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => onNameChange(e.target.value)}
                      placeholder="Your name"
                      className={`${FIELD} border-sage mb-4`}
                    />
                  </>
                )}

                {mode !== 'reset' && (
                  <>
                    <label className={LABEL}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => onEmailChange(e.target.value)}
                      placeholder="you@example.com"
                      className={`${FIELD} ${emailError ? 'border-clay' : 'border-sage'} mb-1`}
                    />
                    <p className="min-h-4 m-0 mb-3 text-xs text-clay">{emailError ?? ''}</p>
                  </>
                )}

                {mode !== 'forgot' && (
                  <>
                    <label className={LABEL}>
                      {mode === 'reset' ? 'New password' : 'Password'}
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => onPasswordChange(e.target.value)}
                      placeholder={isRegister || mode === 'reset' ? 'Create a password' : '••••••••'}
                      className={`${FIELD} ${passwordError ? 'border-clay' : 'border-sage'}`}
                    />
                    {passwordError && (
                      <p className="m-0 mt-1 text-xs text-clay">{passwordError}</p>
                    )}
                  </>
                )}

                {isLogin && (
                  <div className="flex justify-end mt-2.5">
                    <button
                      type="button"
                      onClick={() => onModeChange('forgot')}
                      className="text-[13px] text-forest bg-transparent border-0 cursor-pointer hover:underline p-0"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onSubmit}
                  className="w-full mt-5.5 font-heading font-bold text-base text-white bg-forest border-0 rounded-xl py-4 min-h-12 cursor-pointer shadow-[0_10px_24px_rgba(94,156,170,.45)] transition-transform duration-200 hover:scale-[1.02] active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? 'Please wait…'
                    : isLogin
                      ? 'Log in'
                      : isRegister
                        ? 'Create account'
                        : mode === 'forgot'
                          ? 'Send reset link'
                          : 'Save new password'}
                </button>

                {(isLogin || isRegister) && (
                  <>
                    <div className="flex items-center gap-3 my-5">
                      <span className="flex-1 h-px bg-sage" />
                      <span className="text-xs text-mist">or</span>
                      <span className="flex-1 h-px bg-sage" />
                    </div>

                    <button
                      type="button"
                      onClick={onGoogle}
                      className="w-full flex items-center justify-center gap-2.5 font-heading font-semibold text-[15px] text-ink bg-white border border-sage rounded-xl py-3.5 min-h-12 cursor-pointer transition-all hover:bg-haze hover:shadow-[0_8px_20px_rgba(101,113,102,.1)]"
                    >
                      <GoogleIcon />
                      Sign in with Google
                    </button>
                  </>
                )}

                {(mode === 'forgot' || mode === 'reset') && (
                  <button
                    type="button"
                    onClick={() => onModeChange('login')}
                    className="w-full mt-3 font-heading font-semibold text-sm text-forest bg-transparent border-0 cursor-pointer hover:underline"
                  >
                    Back to log in
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
