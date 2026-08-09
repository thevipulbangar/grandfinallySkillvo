/**
 * Student classroom — same full-page shell as CourseManagePage (the teacher's
 * "Sessions, material & lectures" page), not a modal overlay: a fixed
 * "← Back to dashboard" link, a 720px white card, pill tabs for Live sessions
 * / Study material / Recorded lectures. Read-only mirror of what the teacher
 * publishes; only an approved/completed enrollment ever reaches this page.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import type { Course, CourseVideo, LiveSession, StudyMaterial } from '../types';
import { isSupabaseConfigured, toFriendlyError } from '../lib/supabase';
import {
  formatBytes,
  formatDuration,
  listCourseVideos,
  listStudyMaterials,
  materialUrl,
} from '../services/courseContent';
import { isJoinable, listCourseSessions } from '../services/meetings';
import LecturePlayerPage from '../components/LecturePlayerPage';

type Tab = 'live' | 'material' | 'recorded';

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'live', label: 'Live sessions', icon: '🎥' },
  { key: 'material', label: 'Study material', icon: '📄' },
  { key: 'recorded', label: 'Recorded lectures', icon: '🎬' },
];

interface Props {
  course: Course;
  onBack: () => void;
  showToast: (message: string) => void;
}

export default function CourseClassroomPage({ course, onBack, showToast }: Props) {
  const [tab, setTab] = useState<Tab>('live');
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [videos, setVideos] = useState<CourseVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
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
    } finally {
      setLoading(false);
    }
  }, [course.id, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = sessions.filter((s) => new Date(s.endsAt).getTime() >= Date.now());

  const openMaterial = async (material: StudyMaterial) => {
    try {
      window.open(await materialUrl(material), '_blank', 'noreferrer');
    } catch (err) {
      showToast(toFriendlyError(err));
    }
  };

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
        <p className="text-sm text-slate mt-1.5 mb-0">Classroom • Teacher: {course.instructorName}</p>

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

        {loading ? (
          <div className="flex items-center justify-center py-14 text-slate gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your classroom…
          </div>
        ) : (
          <div className="mt-5.5">
            {tab === 'live' && (
              <>
                <h4 className="font-heading font-bold text-sm mb-3">
                  Upcoming sessions ({upcoming.length})
                </h4>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-slate py-10 text-center">
                    Your teacher has not uploaded the next session's Meet link yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {upcoming.map((session) => {
                      const joinable = isJoinable(session);
                      return (
                        <div
                          key={session.id}
                          className="flex items-center justify-between gap-3 bg-[#F5FAF7] border border-mint rounded-xl px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-[.06em] text-slate">
                              {session.kind === 'doubt' ? '❓ Doubt clearing' : '🎥 Live class'}
                            </div>
                            <div className="font-heading font-semibold text-[13px] truncate mt-0.5">
                              {session.title}
                            </div>
                            <div className="text-xs text-slate mt-0.5">
                              {new Date(session.startsAt).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </div>
                          </div>

                          {session.meetUrl ? (
                            <a
                              href={session.meetUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={`px-3.5 py-2 rounded-lg text-xs font-bold shrink-0 ${
                                joinable
                                  ? 'bg-moss hover:bg-pine text-white'
                                  : 'bg-white border border-mint text-ink hover:bg-mint/40'
                              }`}
                            >
                              {joinable ? 'Join now' : 'Meet link'}
                            </a>
                          ) : (
                            <span className="text-xs text-slate/70 shrink-0">Link pending</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {tab === 'material' && (
              <>
                <h4 className="font-heading font-bold text-sm mb-3">
                  Study material ({materials.length})
                </h4>
                {materials.length === 0 ? (
                  <p className="text-sm text-slate py-10 text-center">
                    Your teacher has not shared any material yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {materials.map((material) => (
                      <div
                        key={material.id}
                        className="flex items-center justify-between gap-3 bg-[#F5FAF7] border border-mint rounded-xl px-4 py-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span>📄</span>
                          <div className="min-w-0">
                            <div className="font-heading font-semibold text-[13px] truncate">
                              {material.title}
                            </div>
                            <div className="text-xs text-slate truncate">
                              {material.fileName} • {formatBytes(material.sizeBytes)}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void openMaterial(material)}
                          className="bg-pine hover:bg-moss text-white px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer shrink-0"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === 'recorded' && (
              <>
                <h4 className="font-heading font-bold text-sm mb-3">
                  Recorded lectures ({videos.length})
                </h4>
                {videos.length === 0 ? (
                  <p className="text-sm text-slate py-10 text-center">
                    No recorded lectures have been published yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {videos.map((video) => (
                      <div
                        key={video.id}
                        className="flex items-center justify-between gap-3 bg-[#F5FAF7] border border-mint rounded-xl px-4 py-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span>🎬</span>
                          <div className="min-w-0">
                            <div className="font-heading font-semibold text-[13px] truncate">
                              {video.title}
                            </div>
                            <div className="text-xs text-slate">
                              {formatDuration(video.durationSeconds)} • {formatBytes(video.sizeBytes)}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPlayingVideoId(video.id)}
                          className="bg-moss hover:bg-pine text-white px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer shrink-0"
                        >
                          Watch
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {playingVideoId && (
        <LecturePlayerPage
          courseTitle={course.title}
          videos={videos}
          initialVideoId={playingVideoId}
          onClose={() => setPlayingVideoId(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
