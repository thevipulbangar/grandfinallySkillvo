import { supabase } from '../lib/supabase';
import type { QuizQuestion } from '../types';

interface GenerateQuizInput {
  title: string;
  category: string;
  description: string;
  avoidQuestions?: string[];
}

/** Asks the `generate-quiz` edge function (Groq) for an AI-written skill test. */
export async function generateQuiz(input: GenerateQuizInput): Promise<QuizQuestion[]> {
  const { data, error } = await supabase.functions.invoke<{ questions: QuizQuestion[] }>('generate-quiz', {
    body: input,
  });
  if (error) throw error;
  if (!data?.questions?.length) throw new Error('The AI did not return any questions.');
  return data.questions;
}
