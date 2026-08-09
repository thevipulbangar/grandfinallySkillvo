/**
 * Course Manage — a faithful build of "Skillvo Course Manage".
 *
 * Standalone centred card (not the drawer shell, not the back-link sub-page
 * header): a fixed "← Back to dashboard" link, a 720px white card, pill tabs
 * for Live sessions / Study material / Recorded lectures.
 *
 * Live sessions are a teacher-uploaded Google Meet link plus a start time —
 * a plain insert into `live_sessions`, no Google Calendar integration. A
 * scheduled job removes each row 24 hours after its start time (see
 * supabase/migrations/0010_manual_meet_links.sql).
 */
import React from 'react';
import type { Course, CourseVideo, LiveSession, SessionKind, StudyMaterial, UserProfile } from '../types';
import { isSupabaseConfigured, toFriendlyError } from '../lib/supabase';
import {
  deleteCourseVideo,
  deleteStudyMaterial,
  formatBytes,
  listCourseVideos,
  listStudyMaterials,
  uploadCourseVideo,
  uploadStudyMaterial,
} from '../services/courseContent';
import { cancelSession, isValidMeetUrl, listCourseSessions, uploadMeetLink } from '../services/meetings';
import { markRead } from '../services/notifications';

type Tab = 'live' | 'material' | 'recorded';

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'live', label: 'Live sessions', icon: '🎥' },
  { key: 'material', label: 'Study material', icon: '📄' },
  { key: 'recorded', label: 'Recorded lectures', icon: '🎬' },
];

const KINDS: Array<{ kind: SessionKind; label: string }> = [
  { kind: 'class', label: 'Class' },
  { kind: 'doubt', label: 'Doubt clearing' },
];

function todayLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

interface MeetLinkDraft {
  kind: SessionKind;
  title: string;
  date: string;
  time: string;
  minutes: number;
  meetUrl: string;
}

const EMPTY_DRAFT: MeetLinkDraft = {
  kind: 'class',
  title: '',
  date: todayLocal(),
  time: '10:00',
  minutes: 60,
  meetUrl: '',
};

interface Props {
  course: Course;
  instructorId: string;
  /** The profile's notification feed; only course-relevant ones are shown. */
  notifications: UserProfile['notifications'];
  onBack: () => void;
  onNotificationsChange: () => void;
  onDeleteCourse: () => Promise<void>;
  showToast: (message: string) => void;
}

export default function CourseManagePage({
  course,
  instructorId,
  notifications,
  onBack,
  onNotificationsChange,
  onDeleteCourse,
  showToast,
}: Props) {
  const [tab, setTab] = React.useState<Tab>('live');
  const [deleting, setDeleting] = React.useState(false);

  const handleDeleteCourse = async () => {
    const confirmed = window.confirm(
      `Delete "${course.title}"? This permanently removes its schedule, materials, lectures, and enrollments. This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await onDeleteCourse();
    } catch (err) {
      showToast(toFriendlyError(err));
    } finally {
      setDeleting(false);
    }
  };

  const [sessions, setSessions] = React.useState<LiveSession[]>([]);
  const [materials, setMaterials] = React.useState<StudyMaterial[]>([]);
  const [videos, setVideos] = React.useState<CourseVideo[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState<MeetLinkDraft>(EMPTY_DRAFT);

  /**
   * Ticking a past session off is a personal note-to-self; there is no column
   * for it, so it lives here and resets on reload.
   */
  const [doneIds, setDoneIds] = React.useState<Set<string>>(new Set());

  const refresh = React.useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const [sessionRows, materialRows, videoRows] = await Promise.all([
        listCourseSessions(course.id),
        listStudyMaterials(course.id),
        listCourseVideos(course.id),
      ]);
      setSessions(sessionRows);
      setMaterials(materialRows);
      setVideos(videoRows);
    } catch (err) {
      showToast(toFriendlyError(err));
    }
  }, [course.id, showToast]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const patchDraft = (patch: Partial<MeetLinkDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const handleUpload = async () => {
    if (!isValidMeetUrl(draft.meetUrl)) {
      showToast('Enter a valid Google Meet link, e.g. https://meet.google.com/abc-defg-hij');
      return;
    }
    const startsAt = new Date(`${draft.date}T${draft.time}`);
    if (Number.isNaN(startsAt.getTime())) {
      showToast('Pick a valid date and time.');
      return;
    }

    setBusy(true);
    try {
      await uploadMeetLink({
        courseId: course.id,
        instructorId,
        title: draft.title.trim() || (draft.kind === 'doubt' ? 'Doubt clearing session' : 'Live class'),
        meetUrl: draft.meetUrl,
        kind: draft.kind,
        startsAt,
        durationMinutes: draft.minutes,
      });
      setDraft({ ...EMPTY_DRAFT, kind: draft.kind });
      await refresh();
      showToast('Meet link uploaded — visible to enrolled students until it expires.');
    } catch (err) {
      showToast(toFriendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveSession = async (sessionId: string) => {
    try {
      await cancelSession(sessionId);
      await refresh();
    } catch (err) {
      showToast(toFriendlyError(err));
    }
  };

  const upcoming = sessions.filter((s) => new Date(s.endsAt).getTime() >= Date.now());

  const inputStyle =
    'w-full text-sm text-ink bg-[#F5FAF7] border border-mint rounded-lg px-2.5 py-2 outline-none focus:border-moss';

  return (
    <div className="relative min-h-screen overflow-x-clip flex items-start justify-center bg-haze px-5 pt-25 pb-10">
      <button
        type="button"
        onClick={onBack}
        className="fixed top-5 left-6 flex items-center gap-2 font-heading font-bold text-sm text-ink cursor-pointer bg-transparent border-0 hover:text-moss transition-colors"
      >
        ← Back to dashboard
      </button>

      <div className="w-full max-w-[720px] bg-white rounded-[20px] shadow-[0_24px_60px_rgba(5,31,32,.12)] p-8 animate-rise">
        <div className="flex items-start justify-between">
          <span className="inline-flex font-heading font-bold text-[11px] tracking-[.08em] uppercase text-pine bg-mint px-3.5 py-1.5 rounded-full">
            {course.category}
          </span>
          <button
            type="button"
            onClick={onBack}
            aria-label="Close"
            className="text-xl text-slate leading-none cursor-pointer bg-transparent border-0 hover:text-ink transition-colors"
          >
            ×
          </button>
        </div>

        <h1 className="font-heading font-bold text-[26px] mt-3.5 mb-0">{course.title}</h1>
        <p className="text-sm text-slate mt-1.5 mb-0">
          Course content — {course.studentsCount} enrolled student
          {course.studentsCount === 1 ? '' : 's'}
        </p>

        <div className="flex gap-2 mt-5.5 bg-haze rounded-full p-1.5">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`flex-1 flex items-center justify-center gap-2 font-heading font-bold text-[13px] px-4.5 py-2.5 rounded-full border-0 cursor-pointer whitespace-nowrap transition-colors ${
                tab === item.key ? 'bg-pine text-white' : 'bg-transparent text-ink'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'live' && (
          <>
            <div className="mt-5 bg-[#F5FAF7] border border-mint rounded-2xl p-5.5">
              <div className="flex items-center gap-2 font-heading font-bold text-[15px]">
                <span>🎥</span>Upload a Google Meet link
              </div>
              <p className="text-[13px] leading-relaxed text-slate mt-2 mb-0">
                Start your own Meet call, then paste the link here with when it starts. It shows up for
                every enrolled student and disappears automatically 24 hours after the start time.
              </p>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 mt-4">
                <div>
                  <div className="text-[10px] tracking-[.08em] uppercase text-slate mb-1">Type</div>
                  <select
                    value={draft.kind}
                    onChange={(e) => patchDraft({ kind: e.target.value as SessionKind })}
                    className={inputStyle}
                  >
                    {KINDS.map((k) => (
                      <option key={k.kind} value={k.kind}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[10px] tracking-[.08em] uppercase text-slate mb-1">Date</div>
                  <input
                    type="date"
                    value={draft.date}
                    min={todayLocal()}
                    onChange={(e) => patchDraft({ date: e.target.value })}
                    className={inputStyle}
                  />
                </div>
                <div>
                  <div className="text-[10px] tracking-[.08em] uppercase text-slate mb-1">Start time</div>
                  <input
                    type="time"
                    value={draft.time}
                    onChange={(e) => patchDraft({ time: e.target.value })}
                    className={inputStyle}
                  />
                </div>
                <div>
                  <div className="text-[10px] tracking-[.08em] uppercase text-slate mb-1">Minutes</div>
                  <input
                    type="number"
                    min={15}
                    max={480}
                    step={15}
                    value={draft.minutes}
                    onChange={(e) => patchDraft({ minutes: Number(e.target.value) })}
                    className={inputStyle}
                  />
                </div>
              </div>

              <div className="mt-3">
                <div className="text-[10px] tracking-[.08em] uppercase text-slate mb-1">
                  Title (optional)
                </div>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => patchDraft({ title: e.target.value })}
                  placeholder={draft.kind === 'doubt' ? 'Doubt clearing session' : 'Live class'}
                  className={inputStyle}
                />
              </div>

              <div className="mt-3">
                <div className="text-[10px] tracking-[.08em] uppercase text-slate mb-1">
                  Google Meet link
                </div>
                <input
                  type="url"
                  value={draft.meetUrl}
                  onChange={(e) => patchDraft({ meetUrl: e.target.value })}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  className={inputStyle}
                />
              </div>

              <button
                type="button"
                disabled={busy || !draft.meetUrl}
                onClick={() => void handleUpload()}
                className="w-full mt-4 font-heading font-bold text-sm text-white bg-moss border-0 rounded-xl py-3.5 cursor-pointer transition-colors hover:bg-pine disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🎥 {busy ? 'Uploading…' : 'Upload meet link'}
              </button>
            </div>

            <div className="mt-4 bg-white border border-mint rounded-2xl p-5.5">
              <div className="font-heading font-bold text-[15px]">
                Upcoming sessions ({upcoming.length})
              </div>

              {upcoming.length === 0 ? (
                <p className="text-center text-sm text-slate mt-6 mb-2">
                  No sessions yet. Upload a Meet link above.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5 mt-3.5">
                  {upcoming.map((session) => {
                    const done = doneIds.has(session.id);
                    const starts = new Date(session.startsAt);
                    return (
                      <div
                        key={session.id}
                        className="flex items-center justify-between gap-3 bg-[#F5FAF7] rounded-xl px-4 py-3"
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() =>
                              setDoneIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(session.id)) next.delete(session.id);
                                else next.add(session.id);
                                return next;
                              })
                            }
                            className="w-4 h-4 accent-moss cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <div
                              className={`font-heading font-semibold text-[13px] truncate ${
                                done ? 'line-through text-sage' : 'text-ink'
                              }`}
                            >
                              {session.title}
                            </div>
                            <div className="text-xs text-slate">
                              {starts.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
                              {starts.toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </label>

                        <div className="flex items-center gap-3 shrink-0">
                          {session.meetUrl ? (
                            <a
                              href={session.meetUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-heading font-bold text-xs text-moss hover:underline"
                            >
                              Meet link
                            </a>
                          ) : (
                            <span className="text-xs text-slate">Pending</span>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleRemoveSession(session.id)}
                            aria-label={`Remove ${session.title}`}
                            className="text-xs text-clay bg-transparent border-0 cursor-pointer hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 bg-white border border-mint rounded-2xl p-5.5">
              <div className="font-heading font-bold text-[15px]">Notifications</div>
              {notifications.length === 0 ? (
                <p className="text-center text-sm text-slate mt-6 mb-2">Nothing new for this course.</p>
              ) : (
                <div className="flex flex-col gap-2.5 mt-3.5">
                  {notifications.map((note) => (
                    <div
                      key={note.id}
                      className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${
                        note.unread ? 'bg-[#F5FAF7]' : 'bg-white'
                      }`}
                    >
                      <div className="text-[13px] text-ink">{note.message}</div>
                      <button
                        type="button"
                        disabled={!note.unread}
                        onClick={async () => {
                          try {
                            await markRead(note.id);
                            onNotificationsChange();
                          } catch (err) {
                            showToast(toFriendlyError(err));
                          }
                        }}
                        className={`font-heading font-bold text-xs bg-transparent border-0 whitespace-nowrap ${
                          note.unread ? 'text-moss cursor-pointer' : 'text-sage cursor-default'
                        }`}
                      >
                        {note.unread ? 'Mark as read' : 'Read'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'material' && (
          <UploadTab
            emptyLabel="No study material uploaded yet."
            buttonLabel="⬆ Publish study material"
            accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            icon="📄"
            items={materials.map((m) => ({ id: m.id, name: m.title, size: formatBytes(m.sizeBytes) }))}
            onUpload={async (file) => {
              await uploadStudyMaterial({ courseId: course.id, instructorId, title: file.name, file });
              await refresh();
              showToast('Study material published to your enrolled students.');
            }}
            onDelete={async (id) => {
              const target = materials.find((m) => m.id === id);
              if (target) await deleteStudyMaterial(target);
              await refresh();
            }}
            showToast={showToast}
          />
        )}

        {tab === 'recorded' && (
          <UploadTab
            emptyLabel="No recorded lectures yet."
            buttonLabel="⬆ Upload recorded lecture"
            accept="video/mp4,video/webm,video/quicktime"
            icon="🎬"
            items={videos.map((v) => ({ id: v.id, name: v.title, size: formatBytes(v.sizeBytes) }))}
            onUpload={async (file) => {
              await uploadCourseVideo({ courseId: course.id, instructorId, title: file.name, file });
              await refresh();
              showToast('Lecture published.');
            }}
            onDelete={async (id) => {
              const target = videos.find((v) => v.id === id);
              if (target) await deleteCourseVideo(target);
              await refresh();
            }}
            showToast={showToast}
          />
        )}

        <div className="mt-4 bg-[#FBF1EE] border border-[rgba(196,129,107,.35)] rounded-2xl p-5.5">
          <div className="font-heading font-bold text-[13px] tracking-[.08em] uppercase text-clay">
            Danger zone
          </div>
          <p className="text-[13px] text-slate mt-2.5 mb-4">
            Deleting this course removes its schedule, materials, lectures, and enrollments permanently.
          </p>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDeleteCourse()}
            className="font-heading font-bold text-[13px] text-white bg-clay border-0 rounded-[10px] px-5.5 py-3 cursor-pointer transition-colors hover:bg-[#B06B54] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? 'Deleting…' : 'Delete course'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The material and lecture tabs are the same shape with different copy. */
function UploadTab({
  emptyLabel,
  buttonLabel,
  accept,
  icon,
  items,
  onUpload,
  onDelete,
  showToast,
}: {
  emptyLabel: string;
  buttonLabel: string;
  accept: string;
  icon: string;
  items: Array<{ id: string; name: string; size: string }>;
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  showToast: (message: string) => void;
}) {
  const [uploading, setUploading] = React.useState(false);

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      showToast(toFriendlyError(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="mt-5 bg-[#F5FAF7] border border-dashed border-sage rounded-2xl p-10 text-center text-sm text-slate">
        <div>{items.length === 0 ? emptyLabel : `${items.length} published.`}</div>
        <label className="inline-flex items-center gap-2 mt-4.5 font-heading font-bold text-[13px] text-white bg-moss rounded-xl px-5.5 py-3 cursor-pointer transition-colors hover:bg-pine">
          {uploading ? 'Uploading…' : buttonLabel}
          <input type="file" accept={accept} onChange={pick} disabled={uploading} hidden />
        </label>
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-2.5 mt-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 bg-white border border-mint rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-2.5 text-[13px] text-ink min-w-0">
                <span>{icon}</span>
                <span className="truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate">{item.size}</span>
                <button
                  type="button"
                  onClick={() => void onDelete(item.id).catch((err) => showToast(toFriendlyError(err)))}
                  aria-label={`Delete ${item.name}`}
                  className="text-xs text-clay bg-transparent border-0 cursor-pointer hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
