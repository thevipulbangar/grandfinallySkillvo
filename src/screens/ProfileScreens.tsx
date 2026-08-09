/**
 * Profile and Account Settings — faithful builds of "Skillvo Profile.dc.html"
 * and "Skillvo Account Settings.dc.html".
 *
 * Note the settings page is deliberately DARK (#051F20 body with translucent
 * white cards) while Profile is on the light haze background. That contrast is
 * in the design, not an accident.
 */
import React from 'react';
import type { Course, UserProfile } from '../types';
import SubPageLayout from '../ui/SubPageLayout';

// ------------------------------------------------------------------ profile

/** Levels step every 500 XP (level_for_xp in migrations/0002). */
const XP_PER_LEVEL = 500;

export function ProfileScreen({
  user,
  courses,
  rank,
  onSaveProfile,
  onOpenSettings,
  onSignOut,
  onBack,
}: {
  user: UserProfile;
  courses: Course[];
  rank: number | null;
  onSaveProfile: (patch: { name: string; title: string; bio: string; avatar: string }) => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  onBack: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(user.name);
  const [specialization, setSpecialization] = React.useState(user.title);
  const [bio, setBio] = React.useState(user.bio ?? '');
  const [avatar, setAvatar] = React.useState(user.avatar);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const xpIntoLevel = user.xpPoints % XP_PER_LEVEL;
  const xpDeg = (xpIntoLevel / XP_PER_LEVEL) * 360;

  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const enrolled = user.enrolledCourses
    .map((state) => ({ state, course: courses.find((c) => c.id === state.courseId) }))
    .filter((row): row is { state: (typeof user.enrolledCourses)[number]; course: Course } =>
      Boolean(row.course),
    );

  const badges = user.twoFactorConfig?.enabled ? ['🛡️'] : [];
  const earnedBadges = [
    ...(user.enrolledCourses.some((e) => e.status === 'completed') ? ['🎓'] : []),
    ...(courses.some((c) => c.instructorId === user.id) ? ['📚'] : []),
    ...(user.level >= 2 ? ['⭐'] : []),
    ...(rank !== null && rank <= 3 ? ['🏆'] : []),
    ...badges,
  ];
  // Six slots always render; unearned ones stay as muted placeholders.
  const badgeSlots = Array.from({ length: 6 }, (_, i) => earnedBadges[i] ?? null);

  /** Reads the picked image as a data URL so it can be previewed and saved. */
  const onAvatarFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };

  const toggleEdit = () => {
    if (editing) {
      onSaveProfile({ name, title: specialization, bio, avatar });
    }
    setEditing((was) => !was);
  };

  return (
    <SubPageLayout
      backLabel="Back to dashboard"
      onBack={onBack}
      credits={user.credits}
      maxWidth="max-w-[1160px]"
    >
      <section>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex flex-col items-center gap-2.5 shrink-0">
            <span
              className="relative w-25 h-25 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: `conic-gradient(var(--color-sage) 0deg ${xpDeg}deg, var(--color-mint) ${xpDeg}deg 360deg)`,
              }}
            >
              <span
                className="w-21 h-21 rounded-full overflow-hidden bg-haze border-[3px] border-white flex items-center justify-center font-heading font-bold text-[22px] text-pine bg-cover bg-center"
                style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}
              >
                {!avatar && initials}
              </span>
            </span>

            {editing && (
              <>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="font-heading font-semibold text-[11px] text-ink bg-sage border-0 rounded-lg px-2.5 py-1.5 cursor-pointer"
                  >
                    Browse files
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="font-heading font-semibold text-[11px] text-white bg-pine border-0 rounded-lg px-2.5 py-1.5 cursor-pointer"
                  >
                    Take photo
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onAvatarFile} hidden />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={onAvatarFile}
                  hidden
                />
              </>
            )}
          </div>

          <div className="flex-1 min-w-[220px]">
            {editing ? (
              <>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="font-heading font-bold text-[22px] text-black bg-white border border-[rgba(5,31,32,.15)] rounded-lg px-3 py-2 outline-none w-full max-w-[320px]"
                />
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="Professional specialization"
                  className="block mt-2 text-sm font-bold text-moss bg-white border border-[rgba(5,31,32,.15)] rounded-lg px-3 py-2 outline-none w-full max-w-[320px]"
                />
              </>
            ) : (
              <>
                <h1 className="font-heading font-bold text-[26px] text-ink m-0">{user.name}</h1>
                <p className="text-sm text-moss font-bold mt-1 mb-0">
                  {user.title || 'Skillvo member'}
                </p>
              </>
            )}
            <p className="text-sm text-slate mt-1.5 mb-0">
              Level {user.level} · {xpIntoLevel} / {XP_PER_LEVEL} XP to next level
            </p>
          </div>

          <button
            type="button"
            onClick={toggleEdit}
            className="ml-auto font-heading font-bold text-[13px] text-ink bg-sage border-0 rounded-[10px] px-5.5 py-3 cursor-pointer transition-transform duration-200 hover:scale-[1.04]"
          >
            {editing ? 'Save profile' : 'Edit profile'}
          </button>
        </div>

        <div className="mt-6 bg-white border border-[rgba(5,31,32,.08)] rounded-[14px] p-5 shadow-[0_4px_16px_rgba(5,31,32,.05)]">
          <div className="font-heading font-bold text-[13px] tracking-[.08em] uppercase text-sage">
            About
          </div>
          {editing ? (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write a short bio about yourself…"
              rows={3}
              className="w-full mt-2.5 text-sm text-ink bg-[#F5FAF7] border border-[rgba(5,31,32,.15)] rounded-lg px-3 py-2.5 outline-none resize-y"
            />
          ) : (
            <p className="text-sm leading-relaxed text-slate mt-2.5 mb-0">
              {user.bio || 'No bio yet — add one so learners know who is teaching them.'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 mt-8">
          <div>
            <div className="font-heading font-bold text-[13px] tracking-[.08em] uppercase text-sage">
              Badges earned
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {badgeSlots.map((badge, index) =>
                badge ? (
                  <span
                    key={index}
                    className="w-14 h-14 shrink-0 rounded-[14px] bg-pine flex items-center justify-center text-2xl transition-transform duration-300 hover:scale-[1.08] hover:rotate-6"
                  >
                    {badge}
                  </span>
                ) : (
                  <span key={index} className="text-sm text-mist">
                    Locked
                  </span>
                ),
              )}
            </div>

            <div className="font-heading font-bold text-[13px] tracking-[.08em] uppercase text-sage mt-8">
              Enrolled courses
            </div>
            <div className="flex flex-col gap-2.5 mt-3">
              {enrolled.length === 0 ? (
                <p className="text-sm text-slate m-0">No enrolled courses yet.</p>
              ) : (
                enrolled.map(({ state, course }) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between bg-white border border-[rgba(5,31,32,.08)] rounded-xl px-4 py-3.5"
                  >
                    <span className="font-heading font-semibold text-sm text-ink truncate">
                      {course.title}
                    </span>
                    <span className="text-xs text-slate shrink-0 ml-3">
                      {state.status === 'completed'
                        ? 'Completed'
                        : state.status === 'approved'
                          ? `${state.progress}% done`
                          : 'Pending approval'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="bg-white border border-[rgba(5,31,32,.08)] rounded-[14px] p-5 shadow-[0_4px_16px_rgba(5,31,32,.05)]">
              <div className="font-heading font-bold text-[13px] tracking-[.08em] uppercase text-moss">
                This week
              </div>
              {[
                { label: 'Leaderboard rank', value: rank ? `#${rank}` : '—' },
                { label: 'Credits balance', value: user.credits },
                { label: 'Courses completed', value: enrolled.filter((e) => e.state.status === 'completed').length },
              ].map((row, index) => (
                <div
                  key={row.label}
                  className={`flex items-center justify-between ${index === 0 ? 'mt-3.5' : 'mt-2.5'}`}
                >
                  <span className="text-[13px] text-slate">{row.label}</span>
                  <span className="font-heading font-bold">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="bg-white border border-[rgba(5,31,32,.08)] rounded-[14px] p-5 mt-4 shadow-[0_4px_16px_rgba(5,31,32,.05)]">
              <div className="font-heading font-bold text-[13px] tracking-[.08em] uppercase text-moss">
                Account
              </div>
              <div className="flex items-center justify-between mt-3.5">
                <span className="text-[13px] text-slate">Email</span>
                <span className="text-[13px] text-ink truncate ml-3">{user.email}</span>
              </div>
              <div className="flex items-center justify-between mt-2.5">
                <span className="text-[13px] text-slate">Joined</span>
                <span className="text-[13px] text-ink">{user.joinedDate}</span>
              </div>

              <button
                type="button"
                onClick={onOpenSettings}
                className="block w-full mt-4 text-center font-heading font-bold text-[13px] text-ink bg-haze border border-[rgba(5,31,32,.1)] rounded-[10px] py-3 cursor-pointer transition-colors hover:bg-mint"
              >
                Account settings
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="block w-full mt-2.5 text-center font-heading font-bold text-[13px] text-clay bg-transparent border border-[rgba(196,129,107,.5)] rounded-[10px] py-3 cursor-pointer transition-colors hover:bg-[rgba(196,129,107,.12)]"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </section>
    </SubPageLayout>
  );
}

// ------------------------------------------------------------------ settings

export interface NotificationPrefs {
  enrollment: boolean;
  sessions: boolean;
  material: boolean;
}

export function AccountSettingsScreen({
  user,
  prefs,
  onPrefsChange,
  onSave,
  onVerifyPassword,
  onDeleteAccount,
  onBack,
  isSaving,
  isDeletingAccount,
}: {
  user: UserProfile;
  prefs: NotificationPrefs;
  onPrefsChange: (prefs: NotificationPrefs) => void;
  onSave: (patch: { email: string; currentPassword: string; newPassword: string }) => void;
  onVerifyPassword: (currentPassword: string) => Promise<boolean>;
  onDeleteAccount: () => void;
  onBack: () => void;
  isSaving: boolean;
  isDeletingAccount?: boolean;
}) {
  const [email, setEmail] = React.useState(user.email);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [incorrectPassword, setIncorrectPassword] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);

  // Mirrors the mockup's inline validation: a new password needs the current one.
  const passwordError = newPassword.length > 0 && currentPassword.length === 0;

  const handleSave = async () => {
    if (newPassword.length > 0 && currentPassword.length > 0) {
      setVerifying(true);
      const correct = await onVerifyPassword(currentPassword);
      setVerifying(false);
      if (!correct) {
        setIncorrectPassword(true);
        return;
      }
    }
    setIncorrectPassword(false);
    onSave({ email, currentPassword, newPassword });
  };

  const toggles: Array<{ key: keyof NotificationPrefs; label: string; desc: string }> = [
    {
      key: 'enrollment',
      label: 'Enrollment updates',
      desc: 'When a teacher approves or declines your request.',
    },
    {
      key: 'sessions',
      label: 'Live session reminders',
      desc: 'When a Sunday class or doubt session is scheduled.',
    },
    {
      key: 'material',
      label: 'New study material',
      desc: 'When a teacher publishes notes or a recorded lecture.',
    },
  ];

  const inputClass =
    'w-full text-sm text-white bg-white/8 border border-white/20 rounded-[10px] px-3.5 py-3 outline-none focus:border-sage transition-colors placeholder:text-white/40';

  return (
    <SubPageLayout
      backLabel="Back to profile"
      onBack={onBack}
      maxWidth="max-w-[900px]"
      dark
    >
      <h1 className="font-heading font-bold text-[26px] m-0">Account settings</h1>
      <p className="text-sm text-sage mt-2 mb-0">
        Manage your login, notifications, and account preferences.
      </p>

      <div className="bg-white/6 rounded-[14px] p-6 mt-7">
        <div className="font-heading font-bold text-[13px] tracking-[.08em] uppercase text-sage">
          Login &amp; security
        </div>
        <div className="mt-4 flex flex-col gap-3.5">
          <label className="block">
            <span className="block text-xs text-mint mb-1.5">Email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-mint mb-1.5">
              Current password{newPassword.length > 0 ? ' *' : ''}
            </span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setIncorrectPassword(false);
              }}
              placeholder="Required to change password"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-mint mb-1.5">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              className={inputClass}
            />
          </label>
          {passwordError && (
            <p className="m-0 text-xs text-clay">
              Enter your current password to save a new password.
            </p>
          )}
          {incorrectPassword && (
            <p className="m-0 text-xs text-clay">Incorrect password.</p>
          )}
        </div>
      </div>

      <div className="bg-white/6 rounded-[14px] p-6 mt-5">
        <div className="font-heading font-bold text-[13px] tracking-[.08em] uppercase text-sage">
          Notifications
        </div>
        <div className="mt-4 flex flex-col gap-3.5">
          {toggles.map((toggle) => {
            const on = prefs[toggle.key];
            return (
              <div key={toggle.key} className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-heading font-semibold text-sm">{toggle.label}</div>
                  <div className="text-xs text-sage mt-0.5">{toggle.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onPrefsChange({ ...prefs, [toggle.key]: !on })}
                  aria-label={`Toggle ${toggle.label}`}
                  aria-pressed={on}
                  className={`w-11 h-6.5 rounded-full border-0 cursor-pointer relative transition-colors shrink-0 ${
                    on ? 'bg-sage' : 'bg-white/20'
                  }`}
                >
                  <span
                    className="absolute top-[3px] w-5 h-5 rounded-full bg-white transition-[left] duration-250 ease-[cubic-bezier(.22,1,.36,1)]"
                    style={{ left: on ? 21 : 3 }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white/6 rounded-[14px] p-6 mt-5">
        <div className="font-heading font-bold text-[13px] tracking-[.08em] uppercase text-clay">
          Danger zone
        </div>
        <p className="text-[13px] text-mint mt-2.5 mb-4">
          Deleting your account removes your credits, courses, and progress permanently.
        </p>
        <button
          type="button"
          onClick={onDeleteAccount}
          disabled={isDeletingAccount}
          className="font-heading font-bold text-[13px] text-white bg-clay border-0 rounded-[10px] px-5.5 py-3 cursor-pointer transition-colors hover:bg-[#B06B54] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeletingAccount ? 'Deleting…' : 'Delete account'}
        </button>
      </div>

      <div className="flex justify-end mt-6">
        <button
          type="button"
          disabled={isSaving || verifying || passwordError}
          onClick={() => void handleSave()}
          className="font-heading font-bold text-sm text-ink bg-sage border-0 rounded-[10px] px-6.5 py-3.5 cursor-pointer transition-transform duration-200 hover:scale-[1.03] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {verifying ? 'Checking…' : isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </SubPageLayout>
  );
}
