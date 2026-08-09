/**
 * Pre-login landing — a faithful build of "pre login.dc.html".
 *
 * Full-bleed hero video behind a dark scrim, drifting blobs and floating
 * shapes over the page background, the character-by-character headline, the
 * three "How it works" cards, the trust stats, and the closing sign-up band.
 */
import React from 'react';
import { SkillvoMark } from '../ui/primitives';

const HEADLINE = 'Zero limits. Zero excuses. Your pace, your rules.';

function Icon({ paths, stroke }: { paths: string[]; stroke: string }) {
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

const CARDS = [
  {
    bg: 'bg-mint',
    text: 'text-ink',
    title: 'Learn at your pace',
    body: 'Study anytime, anywhere. No rigid schedules, no catching up.',
    tag: 'Flexible',
    paths: ['M12 3a9 9 0 1 0 9 9', 'M12 7v5l4 2'],
    stroke: '#0B2B26',
  },
  {
    bg: 'bg-sage',
    text: 'text-black',
    title: 'Earn credits',
    body: 'Get recognized achievements that stack toward real credentials.',
    tag: 'Rewarding',
    paths: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M12 13v4', 'M9 21h6'],
    stroke: '#C99A6B',
  },
  {
    bg: 'bg-forest',
    text: 'text-white',
    title: 'AI-verified teachers',
    body: 'Anyone with a skill can teach — after passing our AI verification.',
    tag: 'Trusted',
    paths: ['M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0'],
    stroke: '#C4816B',
  },
];

const STATS = [
  { title: 'Fast-growing community', note: 'Students joining daily' },
  { title: 'Diverse course catalog', note: 'Topics across all interests' },
  {
    title: 'AI-verified credentials',
    note: '80%+ AI score to teach, human review for 70–80%',
  },
  { title: 'Trusted learning platform', note: 'Built for students first' },
];

export default function LandingPage({ onSignUp }: { onSignUp: () => void }) {
  // The design fades a loader out once the page is ready.
  const [loaded, setLoaded] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 600);
    return () => clearTimeout(timer);
  }, []);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      <div
        style={{ opacity: loaded ? 0 : 1, pointerEvents: loaded ? 'none' : 'auto' }}
        className="fixed inset-0 z-100 bg-haze flex flex-col items-center justify-center gap-4.5 transition-opacity duration-600"
      >
        <div className="flex gap-2">
          {['bg-moss', 'bg-forest', 'bg-sage'].map((tone, index) => (
            <span
              key={tone}
              className={`w-2 h-2 rounded-full ${tone}`}
              style={{ animation: `loaderDot 1s ease-in-out infinite ${index * 0.15}s` }}
            />
          ))}
        </div>
        <span className="font-heading font-semibold text-[13px] tracking-[.1em] uppercase text-mist">
          Loading Skillvo
        </span>
      </div>

      <div className="relative min-h-screen overflow-x-clip bg-haze">
        <div aria-hidden="true" className="absolute inset-x-[-5%] -top-[10%] h-[1200px] pointer-events-none z-0 overflow-hidden">
          <div
            className="absolute -top-45 -left-30 w-[720px] h-[720px] rounded-full"
            style={{
              background: 'radial-gradient(circle at 40% 40%, #DAF1DE 0%, rgba(218,235,227,0) 68%)',
              animation: 'driftBlob 26s ease-in-out infinite',
            }}
          />
          <div
            className="absolute top-10 -right-40 w-[640px] h-[640px] rounded-full"
            style={{
              background: 'radial-gradient(circle at 55% 45%, #8EB69B 0%, rgba(253,232,211,0) 70%)',
              animation: 'driftBlob 32s ease-in-out infinite reverse',
            }}
          />
          <div
            className="absolute top-[520px] left-[30%] w-[560px] h-[560px] rounded-full opacity-70"
            style={{
              background: 'radial-gradient(circle at 50% 50%, #0B2B26 0%, rgba(243,195,178,0) 72%)',
              animation: 'driftBlob 38s ease-in-out infinite',
            }}
          />
          <div className="absolute top-45 left-[8%] w-[74px] h-[74px] rounded-[26px] bg-moss opacity-35" style={{ animation: 'floatA 9s ease-in-out infinite' }} />
          <div className="absolute top-105 left-[4%] w-[34px] h-[34px] rounded-full bg-sage opacity-80" style={{ animation: 'floatB 11s ease-in-out infinite' }} />
          <div className="absolute top-[130px] right-[12%] w-[46px] h-[46px] rounded-full bg-forest opacity-60" style={{ animation: 'floatB 13s ease-in-out infinite' }} />
          <div className="absolute top-150 right-[6%] w-24 h-24 rounded-[32px] bg-mint opacity-90" style={{ animation: 'floatA 15s ease-in-out infinite' }} />
        </div>

        <header className="sticky top-0 z-20 backdrop-blur-[12px] bg-[rgba(251,252,250,.72)] border-b border-[rgba(207,219,202,.6)]">
          <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
            <span className="flex items-center gap-2.5 text-ink">
              <SkillvoMark />
              <span className="font-heading font-bold text-lg tracking-[-.4px]">Skillvo</span>
            </span>
            <nav className="flex items-center gap-7 text-[15px]">
              <button
                type="button"
                onClick={() => scrollTo('features')}
                className="text-ink hover:text-forest transition-colors cursor-pointer bg-transparent border-0 hidden sm:block"
              >
                How it works
              </button>
              <button
                type="button"
                onClick={() => scrollTo('trust')}
                className="text-ink hover:text-forest transition-colors cursor-pointer bg-transparent border-0 hidden sm:block"
              >
                Why students trust us
              </button>
              <button
                type="button"
                onClick={onSignUp}
                className="font-heading font-semibold text-[15px] text-white bg-moss px-6.5 py-3 rounded-2xl cursor-pointer border-0 shadow-[0_6px_16px_rgba(94,156,170,.45)] transition-all duration-250 hover:bg-[#143a32] hover:-translate-y-0.5"
              >
                Sign up/Login
              </button>
            </nav>
          </div>
        </header>

        <main id="top" className="relative z-1 max-w-[1200px] mx-auto px-6 pb-10">
          <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen min-h-[92vh] flex flex-col justify-center overflow-hidden">
            <video
              id="heroBgVideo"
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover object-center z-0 opacity-100 pointer-events-none"
            >
              <source src="/uploads/hero-bg-video.mp4" type="video/mp4" />
            </video>

            <section className="relative z-2 max-w-[1200px] w-full mx-auto text-left px-6 py-15">
              <div className="max-w-[620px]">
                <span className="inline-flex items-center gap-2 font-heading text-xs font-semibold tracking-[.04em] text-forest bg-mint border border-forest/20 px-3.5 py-2 rounded-full whitespace-nowrap animate-pop">
                  <span className="w-[7px] h-[7px] rounded-full bg-forest block" />
                  Sign up today and get 50 credits free
                </span>

                <h1 className="font-heading font-bold text-[clamp(34px,4.2vw,52px)] leading-[1.15] tracking-[-1px] text-ink mt-5.5 mb-0 flex flex-wrap justify-start gap-x-[.28em]">
                  {HEADLINE.split(' ').map((word, wordIndex, words) => {
                    const before = words.slice(0, wordIndex).join(' ').length;
                    return (
                      <span key={`${word}-${wordIndex}`} className="inline-flex">
                        {word.split('').map((char, charIndex) => (
                          <span
                            key={charIndex}
                            className="inline-block"
                            style={{ animation: `charFade .4s ease both ${(before + charIndex) * 0.02}s` }}
                          >
                            {char}
                          </span>
                        ))}
                      </span>
                    );
                  })}
                </h1>

                <p className="font-heading font-medium text-[clamp(17px,1.6vw,19px)] leading-[1.5] text-[#163832] mt-4.5 mb-0 max-w-[46ch] animate-rise">
                  Earn real credits that matter. Your journey to mastery begins here. Pick any topic, from
                  day one — every lesson turns into credits you can carry toward credentials employers
                  actually recognize.
                </p>

                <div className="flex items-center gap-3.5 mt-7.5 flex-wrap animate-rise">
                  <button
                    type="button"
                    onClick={onSignUp}
                    className="inline-flex items-center gap-2.5 font-heading font-semibold text-[15px] text-ink bg-white border border-[rgba(5,31,32,.15)] px-6.5 py-3.5 rounded-2xl cursor-pointer transition-all duration-250 hover:bg-haze hover:-translate-y-0.5"
                  >
                    <svg width={18} height={18} viewBox="0 0 18 18">
                      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.86 2.7-6.62Z" />
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18Z" />
                      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33Z" />
                      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
                    </svg>
                    Sign in with Google
                  </button>
                </div>
              </div>
            </section>
          </div>

          <h2
            id="features"
            className="font-heading font-bold text-[clamp(26px,3vw,34px)] tracking-[-.6px] text-center mt-24 mb-8"
          >
            How it works
          </h2>
          <section className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
            {CARDS.map((card) => (
              <article
                key={card.title}
                className={`${card.bg} ${card.text} rounded-[20px] p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_44px_rgba(11,43,38,.16)]`}
              >
                <span className="inline-flex">
                  <Icon paths={card.paths} stroke={card.stroke} />
                </span>
                <h3 className="font-heading font-bold text-xl mt-4 mb-2">{card.title}</h3>
                <p className="text-[15px] leading-relaxed m-0 opacity-90">{card.body}</p>
                <span className="inline-block mt-5 font-heading font-bold text-[11px] tracking-[.1em] uppercase bg-white/25 px-3 py-1.5 rounded-full">
                  {card.tag}
                </span>
              </article>
            ))}
          </section>

          <h2
            id="trust"
            className="font-heading font-bold text-[clamp(26px,3vw,34px)] tracking-[-.6px] text-center mt-24 mb-8"
          >
            Why students trust us
          </h2>
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STATS.map((stat) => (
              <div
                key={stat.title}
                className="flex items-start gap-3.5 bg-white border border-sage rounded-2xl p-5"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-moss mt-1.5 shrink-0" />
                <div>
                  <div className="font-heading font-bold text-[15px]">{stat.title}</div>
                  <div className="text-sm text-slate mt-0.5">{stat.note}</div>
                </div>
              </div>
            ))}
          </section>

          <section className="mt-24 bg-pine text-white rounded-[24px] p-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <h2 className="font-heading font-bold text-[clamp(22px,2.5vw,30px)] tracking-[-.5px] m-0 max-w-[24ch]">
                No prerequisites. Start anywhere. Keep the credits.
              </h2>
              <p className="text-[15px] leading-relaxed text-mint mt-3 mb-0 max-w-[52ch]">
                Topics for every interest, expert instructors on every step, and a schedule that bends
                around your life.
              </p>
              <p className="text-sm text-mint mt-3 mb-0">
                New to Skillvo?{' '}
                <button
                  type="button"
                  onClick={onSignUp}
                  className="text-white underline bg-transparent border-0 cursor-pointer p-0"
                >
                  Create your account now
                </button>
              </p>
            </div>
            <button
              type="button"
              onClick={onSignUp}
              className="font-heading font-bold text-base text-ink bg-sage border-0 rounded-[14px] px-9 py-4 cursor-pointer shrink-0 transition-transform duration-250 hover:scale-105"
            >
              Sign up
            </button>
          </section>
        </main>

        <footer className="relative z-1 border-t border-[rgba(183,199,174,.7)] py-7 px-6 text-center text-sm text-mist">
          Skillvo — learning that adds up.
        </footer>

        {chatOpen && (
          <div className="fixed z-40 bottom-24 right-6 w-80 max-w-[calc(100vw-3rem)] bg-white rounded-[18px] shadow-[0_24px_60px_rgba(5,31,32,.22)] overflow-hidden font-body">
            <div className="bg-[#163832] px-4.5 py-4 flex items-center justify-between">
              <span className="font-heading font-bold text-sm text-white">Skillvo Assistant</span>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
                className="bg-transparent border-0 text-mint text-base cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="p-4.5 min-h-35 bg-[#F5FAF7] text-[13px] text-[#4A544C] leading-relaxed">
              👋 Hi! Ask me anything about credits, courses, or getting started.
            </div>
            <div className="flex gap-2 p-3 border-t border-mint">
              <input
                type="text"
                placeholder="Type a message…"
                className="flex-1 text-[13px] px-3 py-2.5 rounded-[10px] border border-mint outline-none bg-white"
              />
              <button
                type="button"
                className="font-heading font-bold text-[13px] text-white bg-moss border-0 rounded-[10px] px-4 cursor-pointer"
              >
                Send
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setChatOpen((open) => !open)}
          aria-label="Toggle AI chatbot"
          className="fixed z-40 bottom-6 right-6 w-14 h-14 rounded-full bg-moss border-0 shadow-[0_10px_26px_rgba(5,31,32,.35)] cursor-pointer flex items-center justify-center transition-transform duration-250 hover:scale-108"
        >
          <span className="text-2xl">{chatOpen ? '×' : '💬'}</span>
        </button>
      </div>
    </>
  );
}
