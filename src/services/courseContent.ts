/**
 * Study material and recorded lectures.
 *
 * Both live in *private* Storage buckets keyed `<course_id>/<uuid>-<name>`.
 * That path shape is load-bearing: the storage RLS policies in
 * migrations/0007 read the first path segment as the course id to decide who
 * may read an object. Nothing is served by public URL — readers get a
 * short-lived signed URL, so a copied link stops working and a student who
 * un-enrolls loses access on their next click.
 */
import { supabase } from '../lib/supabase';
import type { CourseVideo, StudyMaterial } from '../types';
import { toCourseVideo, toStudyMaterial } from './mappers';

export const MATERIALS_BUCKET = 'course-materials';
export const VIDEOS_BUCKET = 'course-videos';

/** Matches the bucket limits declared in migrations/0007. */
export const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

/** Matches the bucket's allowed_mime_types in migrations/0008. */
const ALLOWED_MATERIAL_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
const ALLOWED_MATERIAL_EXTENSIONS = new Set(['pdf', 'ppt', 'pptx']);

function isAllowedMaterialFile(file: File): boolean {
  if (file.type && ALLOWED_MATERIAL_MIME_TYPES.has(file.type)) return true;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return Boolean(extension && ALLOWED_MATERIAL_EXTENSIONS.has(extension));
}

/** How long a signed download/stream URL stays valid. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Storage object keys allow a narrow character set. Keeping the original
 * extension matters for content-type sniffing on download, so only the stem is
 * scrubbed.
 */
function storageSafeName(fileName: string): string {
  return fileName
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'file';
}

function objectPath(courseId: string, fileName: string): string {
  return `${courseId}/${crypto.randomUUID()}-${storageSafeName(fileName)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Reads the duration of a video file in the browser, so the card can show a
 * runtime without a server-side probe. Best-effort: an unreadable file just
 * yields 0 rather than blocking the upload.
 */
export function probeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';

    const done = (seconds: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(seconds) ? Math.round(seconds) : 0);
    };

    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => done(0);
    video.src = url;
  });
}

// ------------------------------------------------------------------ study material

export interface UploadMaterialInput {
  courseId: string;
  instructorId: string;
  title: string;
  description?: string;
  file: File;
  /** Notify enrolled students. Defaults to true. */
  notify?: boolean;
}

export async function listStudyMaterials(courseId: string): Promise<StudyMaterial[]> {
  const { data, error } = await supabase
    .from('study_materials')
    .select('*')
    .eq('course_id', courseId)
    .order('position')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toStudyMaterial);
}

export async function uploadStudyMaterial(input: UploadMaterialInput): Promise<StudyMaterial> {
  if (input.file.size > MAX_MATERIAL_BYTES) {
    throw new Error(`Study material must be ${formatBytes(MAX_MATERIAL_BYTES)} or smaller.`);
  }
  if (!isAllowedMaterialFile(input.file)) {
    throw new Error('Study material must be a PDF or PowerPoint (.pdf, .ppt, .pptx) file.');
  }

  const path = objectPath(input.courseId, input.file.name);
  const { error: uploadError } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .upload(path, input.file, { contentType: input.file.type || undefined, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('study_materials')
    .insert({
      course_id: input.courseId,
      instructor_id: input.instructorId,
      title: input.title.trim() || input.file.name,
      description: input.description?.trim() ?? '',
      storage_path: path,
      file_name: input.file.name,
      mime_type: input.file.type || 'application/octet-stream',
      size_bytes: input.file.size,
    })
    .select('*')
    .single();

  // Never leave an orphan object behind: without its row nothing can list or
  // delete it, and it still counts against storage.
  if (error) {
    await supabase.storage.from(MATERIALS_BUCKET).remove([path]);
    throw error;
  }

  const material = toStudyMaterial(data);

  if (input.notify !== false) {
    await notifyStudents(input.courseId, 'material_published', `📚 New study material: ${material.title}`, {
      course_id: input.courseId,
      material_id: material.id,
    });
  }

  return material;
}

export async function deleteStudyMaterial(material: StudyMaterial): Promise<void> {
  const { error } = await supabase.from('study_materials').delete().eq('id', material.id);
  if (error) throw error;
  await supabase.storage.from(MATERIALS_BUCKET).remove([material.storagePath]);
}

// ------------------------------------------------------------------ recorded lectures

export interface UploadVideoInput {
  courseId: string;
  instructorId: string;
  title: string;
  description?: string;
  file: File;
  /** Upload now, release later. Defaults to true (visible immediately). */
  published?: boolean;
  notify?: boolean;
  onProgress?: (percent: number) => void;
}

export async function listCourseVideos(courseId: string): Promise<CourseVideo[]> {
  const { data, error } = await supabase
    .from('course_videos')
    .select('*')
    .eq('course_id', courseId)
    .order('position')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toCourseVideo);
}

export async function uploadCourseVideo(input: UploadVideoInput): Promise<CourseVideo> {
  if (input.file.size > MAX_VIDEO_BYTES) {
    throw new Error(`Lecture videos must be ${formatBytes(MAX_VIDEO_BYTES)} or smaller.`);
  }

  const durationSeconds = await probeVideoDuration(input.file);
  const path = objectPath(input.courseId, input.file.name);
  const published = input.published !== false;

  const { error: uploadError } = await supabase.storage
    .from(VIDEOS_BUCKET)
    .upload(path, input.file, { contentType: input.file.type || 'video/mp4', upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('course_videos')
    .insert({
      course_id: input.courseId,
      instructor_id: input.instructorId,
      title: input.title.trim() || input.file.name,
      description: input.description?.trim() ?? '',
      storage_path: path,
      file_name: input.file.name,
      mime_type: input.file.type || 'video/mp4',
      size_bytes: input.file.size,
      duration_seconds: durationSeconds,
      published,
    })
    .select('*')
    .single();

  if (error) {
    await supabase.storage.from(VIDEOS_BUCKET).remove([path]);
    throw error;
  }

  const video = toCourseVideo(data);

  if (published && input.notify !== false) {
    await notifyStudents(input.courseId, 'lecture_published', `🎬 New recorded lecture: ${video.title}`, {
      course_id: input.courseId,
      video_id: video.id,
    });
  }

  return video;
}

/** Flips visibility. Students only ever see published lectures (RLS). */
export async function setVideoPublished(videoId: string, published: boolean): Promise<CourseVideo> {
  const { data, error } = await supabase
    .from('course_videos')
    .update({ published })
    .eq('id', videoId)
    .select('*')
    .single();
  if (error) throw error;
  return toCourseVideo(data);
}

export async function deleteCourseVideo(video: CourseVideo): Promise<void> {
  const { error } = await supabase.from('course_videos').delete().eq('id', video.id);
  if (error) throw error;
  await supabase.storage.from(VIDEOS_BUCKET).remove([video.storagePath]);
}

// ------------------------------------------------------------------ access

/**
 * A time-limited URL for reading one object. Storage RLS runs when the URL is
 * signed, so a student without an approved enrollment simply gets an error.
 */
export async function signedUrl(bucket: string, storagePath: string, download = false): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, download ? { download: true } : undefined);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Could not open that file.');
  return data.signedUrl;
}

export function materialUrl(material: StudyMaterial, download = true): Promise<string> {
  return signedUrl(MATERIALS_BUCKET, material.storagePath, download);
}

export function videoStreamUrl(video: CourseVideo): Promise<string> {
  return signedUrl(VIDEOS_BUCKET, video.storagePath, false);
}

async function notifyStudents(
  courseId: string,
  type: 'material_published' | 'lecture_published',
  message: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  // A failed notification must not fail the upload — the file is already
  // safely stored and listed by then.
  const { error } = await supabase.rpc('notify_course_students', {
    p_course_id: courseId,
    p_type: type,
    p_message: message,
    p_metadata: metadata,
  });
  if (error) console.warn('[skillvo] could not notify students', error);
}
