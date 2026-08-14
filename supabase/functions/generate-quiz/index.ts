// Generates a topic qualification quiz with Gemini and returns it to the client.
// Deploy: supabase functions deploy generate-quiz
//
// The Gemini API key stays server-side (set with `supabase secrets set
// GEMINI_API_KEY=...`) — a client-side key would be readable by anyone who
// opens devtools.

import { json, preflight } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

const GEMINI_MODEL = 'gemini-2.0-flash';
const QUESTION_COUNT = 5;

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    await requireUser(req);
    const { title, category, description, avoidQuestions } = await req.json();

    if (!title || typeof title !== 'string') {
      return json({ error: 'A course title is required.' }, 400);
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'Quiz generation is not configured.' }, 500);

    const avoidList: string[] = Array.isArray(avoidQuestions)
      ? avoidQuestions.filter((q: unknown) => typeof q === 'string').slice(0, 50)
      : [];

    const prompt =
      `You are writing a ${QUESTION_COUNT}-question multiple-choice skill test that verifies whether ` +
      `someone is qualified to TEACH the following course on Skillvo, an online learning platform.\n\n` +
      `Course title: ${title}\n` +
      `Category: ${category || 'General'}\n` +
      `Description: ${description || '(none provided)'}\n\n` +
      `Write questions that test genuine subject-matter expertise, not trivia about the course itself. ` +
      `Each question needs exactly 4 options with exactly one correct answer.` +
      (avoidList.length > 0
        ? ` Do not reuse or closely rephrase any of these previously-asked questions:\n` +
          avoidList.map((q) => `- ${q}`).join('\n') +
          `\n`
        : '') +
      `\n\nRespond with ONLY a JSON object of the shape: ` +
      `{"questions":[{"question":"string","options":["a","b","c","d"],"correctAnswer":0}]}. ` +
      `correctAnswer is the zero-based index of the right option. No markdown, no commentary.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      console.error('gemini request failed', await geminiRes.text());
      return json({ error: 'Quiz generation failed.' }, 502);
    }

    const completion = await geminiRes.json();
    const raw = completion.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return json({ error: 'Quiz generation returned no content.' }, 502);

    let parsed: { questions?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json({ error: 'Quiz generation returned malformed JSON.' }, 502);
    }

    if (!Array.isArray(parsed.questions)) {
      return json({ error: 'Quiz generation returned no questions.' }, 502);
    }

    const questions: QuizQuestion[] = parsed.questions
      .filter(
        (q: any) =>
          q &&
          typeof q.question === 'string' &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every((o: unknown) => typeof o === 'string') &&
          Number.isInteger(q.correctAnswer) &&
          q.correctAnswer >= 0 &&
          q.correctAnswer < 4,
      )
      .slice(0, QUESTION_COUNT)
      .map((q: any, index: number) => ({
        id: `ai-${index}`,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
      }));

    if (questions.length === 0) {
      return json({ error: 'Quiz generation returned no valid questions.' }, 502);
    }

    return json({ questions });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return json({ error: 'Could not generate the quiz.' }, 500);
  }
});
