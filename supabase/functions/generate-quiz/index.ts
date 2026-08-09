// Generates a topic qualification quiz with Groq and returns it to the client.
// Deploy: supabase functions deploy generate-quiz
//
// The Groq API key stays server-side (set with `supabase secrets set
// GROQ_API_KEY=...`) — a client-side key would be readable by anyone who
// opens devtools.

import { json, preflight } from '../_shared/cors.ts';
import { requireUser } from '../_shared/supabase.ts';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
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
    const { title, category, description } = await req.json();

    if (!title || typeof title !== 'string') {
      return json({ error: 'A course title is required.' }, 400);
    }

    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) return json({ error: 'Quiz generation is not configured.' }, 500);

    const prompt =
      `You are writing a ${QUESTION_COUNT}-question multiple-choice skill test that verifies whether ` +
      `someone is qualified to TEACH the following course on Skillvo, an online learning platform.\n\n` +
      `Course title: ${title}\n` +
      `Category: ${category || 'General'}\n` +
      `Description: ${description || '(none provided)'}\n\n` +
      `Write questions that test genuine subject-matter expertise, not trivia about the course itself. ` +
      `Each question needs exactly 4 options with exactly one correct answer. ` +
      `Respond with ONLY a JSON object of the shape: ` +
      `{"questions":[{"question":"string","options":["a","b","c","d"],"correctAnswer":0}]}. ` +
      `correctAnswer is the zero-based index of the right option. No markdown, no commentary.`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqRes.ok) {
      console.error('groq request failed', await groqRes.text());
      return json({ error: 'Quiz generation failed.' }, 502);
    }

    const completion = await groqRes.json();
    const raw = completion.choices?.[0]?.message?.content;
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
