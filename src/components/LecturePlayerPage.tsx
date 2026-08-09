/**
 * Full-screen recorded-lecture player for students: a lesson sidebar (mirrors
 * the "Skillvo Lecture Player" mockup's layout) next to a real <video>,
 * streamed from a signed URL that is re-requested whenever the active lecture
 * changes — URLs are short-lived, so nothing is pre-fetched for the whole list.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Loader2, PanelLeftClose, PanelLeftOpen, PlayCircle, X } from 'lucide-react';

import type { CourseVideo } from '../types';
import { toFriendlyError } from '../lib/supabase';
import { formatDuration, videoStreamUrl } from '../services/courseContent';

interface Props {
  courseTitle: string;
  videos: CourseVideo[];
  initialVideoId: string;
  onClose: () => void;
  showToast: (message: string) => void;
}

export default function LecturePlayerPage({ courseTitle, videos, initialVideoId, onClose, showToast }: Props) {
  const [activeId, setActiveId] = useState(initialVideoId);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [url, setUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(true);

  const activeIndex = videos.findIndex((v) => v.id === activeId);
  const activeVideo = videos[activeIndex] ?? videos[0];

  const load = useCallback(
    async (video: CourseVideo) => {
      setLoadingUrl(true);
      setUrl(null);
      try {
        setUrl(await videoStreamUrl(video));
      } catch (err) {
        showToast(toFriendlyError(err));
      } finally {
        setLoadingUrl(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    if (activeVideo) void load(activeVideo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideo?.id]);

  if (!activeVideo) return null;

  const atStart = activeIndex <= 0;
  const atEnd = activeIndex >= videos.length - 1;
  const goPrev = () => !atStart && setActiveId(videos[activeIndex - 1].id);
  const goNext = () => !atEnd && setActiveId(videos[activeIndex + 1].id);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-3 sm:p-6"
    >
      <div className="w-full h-full max-w-7xl max-h-[92vh] bg-white rounded-3xl overflow-hidden shadow-2xl grid grid-cols-[auto_1fr]">
        {/* Sidebar — lesson list */}
        <aside
          className={`bg-pine text-white overflow-y-auto transition-[width] duration-200 ${
            sidebarOpen ? 'w-[280px]' : 'w-[52px]'
          }`}
        >
          {sidebarOpen ? (
            <>
              <div className="p-4.5 border-b border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="font-heading font-semibold text-xs text-mint/90 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    ← Back to classroom
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Collapse sidebar"
                    className="text-mint/80 hover:text-white p-1 rounded cursor-pointer"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </div>
                <h2 className="font-heading font-bold text-lg mt-3 truncate">{courseTitle}</h2>
                <p className="text-xs text-mint/70 mt-1">
                  {activeIndex + 1} of {videos.length} lectures
                </p>
              </div>

              <div>
                {videos.map((video, i) => {
                  const active = video.id === activeVideo.id;
                  return (
                    <button
                      key={video.id}
                      type="button"
                      onClick={() => setActiveId(video.id)}
                      className={`w-full flex items-start gap-2.5 text-left px-4.5 py-3 border-b border-white/5 cursor-pointer transition-colors ${
                        active ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <PlayCircle
                        className={`w-4 h-4 mt-0.5 shrink-0 ${active ? 'text-mint' : 'text-white/40'}`}
                      />
                      <span className="min-w-0">
                        <span
                          className={`block text-[13px] truncate ${
                            active ? 'font-bold text-white' : 'text-white/80'
                          }`}
                        >
                          {i + 1}. {video.title}
                        </span>
                        <span className="block text-[11px] text-mint/60 mt-0.5">
                          {formatDuration(video.durationSeconds)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Expand sidebar"
              className="w-full py-4.5 flex justify-center text-mint/80 hover:text-white cursor-pointer"
            >
              <PanelLeftOpen className="w-4.5 h-4.5" />
            </button>
          )}
        </aside>

        {/* Main — player */}
        <div className="flex flex-col bg-[#051F20] min-w-0">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-pine/95 border-b border-white/10">
            <button
              type="button"
              onClick={goPrev}
              disabled={atStart}
              className="font-heading font-semibold text-xs text-white flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="text-xs text-white/70 truncate text-center flex-1">{activeVideo.title}</span>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={goNext}
                disabled={atEnd}
                className="font-heading font-semibold text-xs text-white flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close player"
                className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center min-h-0 p-4">
            {loadingUrl || !url ? (
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading lecture…
              </div>
            ) : (
              <video
                key={activeVideo.id}
                src={url}
                controls
                autoPlay
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                onEnded={goNext}
                className="w-full h-full max-h-full rounded-xl bg-black"
              />
            )}
          </div>

          {activeVideo.description && (
            <div className="px-5 py-3 bg-pine/40 border-t border-white/10 text-xs text-white/70 line-clamp-2">
              {activeVideo.description}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
