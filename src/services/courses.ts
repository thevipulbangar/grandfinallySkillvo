import { supabase } from '../lib/supabase';
import type { Course, QuizQuestion } from '../types';
import { toCourse, toQuizQuestion, type CourseWithInstructor } from './mappers';

const COURSE_SELECT = '*, instructor:profiles!courses_instructor_id_fkey (id, name, avatar_url)';

export interface CourseFilter {
  category?: string;
  search?: string;
  instructorId?: string;
}

export async function listCourses(filter: CourseFilter = {}): Promise<Course[]> {
  let query = supabase.from('courses').select(COURSE_SELECT).eq('published', true);

  if (filter.category && filter.category !== 'All') query = query.eq('category', filter.category);
  if (filter.instructorId) query = query.eq('instructor_id', filter.instructorId);
  if (filter.search) {
    const term = `%${filter.search}%`;
    query = query.or(`title.ilike.${term},description.ilike.${term},category.ilike.${term}`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as CourseWithInstructor[]).map(toCourse);
}

export async function getCourse(courseId: string): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_SELECT)
    .eq('id', courseId)
    .maybeSingle();
  if (error) throw error;
  return data ? toCourse(data as unknown as CourseWithInstructor) : null;
}

/** Courses the signed-in user teaches, including unpublished drafts. */
export async function listTaughtCourses(instructorId: string): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select(COURSE_SELECT)
    .eq('instructor_id', instructorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as CourseWithInstructor[]).map(toCourse);
}

export interface NewCourseInput {
  title: string;
  category: string;
  description: string;
  creditFee: number;
  lessonsCount?: number;
  level?: string;
  /** Set when the instructor passed the category skill test. */
  verifiedTeacherTopic?: boolean;
}

export async function publishCourse(instructorId: string, input: NewCourseInput): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .insert({
      instructor_id: instructorId,
      title: input.title.trim(),
      category: input.category,
      description: input.description.trim(),
      credit_fee: input.creditFee,
      lessons_count: input.lessonsCount ?? 0,
      level: input.level ?? 'Beginner',
      verified_teacher_topic: input.verifiedTeacherTopic ?? false,
      published: true,
    })
    .select(COURSE_SELECT)
    .single();
  if (error) throw error;
  return toCourse(data as unknown as CourseWithInstructor);
}

export async function updateCourse(courseId: string, patch: Partial<NewCourseInput>): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .update({
      title: patch.title,
      category: patch.category,
      description: patch.description,
      credit_fee: patch.creditFee,
      lessons_count: patch.lessonsCount,
      level: patch.level,
    })
    .eq('id', courseId)
    .select(COURSE_SELECT)
    .single();
  if (error) throw error;
  return toCourse(data as unknown as CourseWithInstructor);
}

export async function deleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase.from('courses').delete().eq('id', courseId);
  if (error) throw error;
}

export async function listCategories(): Promise<string[]> {
  const { data, error } = await supabase.from('courses').select('category').eq('published', true);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r) => r.category))).sort();
}

// ------------------------------------------------------------------ skill test

export async function getTopicQuiz(category: string): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from('topic_quiz_questions')
    .select('*')
    .eq('category', category)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map(toQuizQuestion);
}

/** Logs the attempt server-side and reports whether the instructor passed. */
export async function recordSkillTest(category: string, score: number, total: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('record_skill_test', {
    p_category: category,
    p_score: score,
    p_total: total,
  });
  if (error) throw error;
  return Boolean(data?.passed);
}
