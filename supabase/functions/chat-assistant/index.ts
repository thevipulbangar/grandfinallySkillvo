// Powers the floating "Skillvo Assistant" chat widget with Groq.
// Deploy: supabase functions deploy chat-assistant
//
// The Groq API key stays server-side (set with `supabase secrets set
// GROQ_API_KEY=...`) — a client-side key would be readable by anyone who
// opens devtools.

import { json, preflight } from '../_shared/cors.ts';
import { requireUser, userClient } from '../_shared/supabase.ts';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

// Cheap abuse guards: a chat widget has no other rate limiting in front of it.
const MAX_MESSAGES = 16;
const MAX_MESSAGE_LENGTH = 2000;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function isValidHistory(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_MESSAGES &&
    value.every(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.length > 0 &&
        m.content.length <= MAX_MESSAGE_LENGTH,
    )
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();

  try {
    const user = await requireUser(req);
    const { messages } = await req.json();

    if (!isValidHistory(messages)) {
      return json({ error: 'Send 1–16 messages, each 2000 characters or fewer.' }, 400);
    }

    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) return json({ error: 'The assistant is not configured.' }, 500);

    // Best-effort personalization — the widget still works if this lookup
    // fails, it just falls back to a generic greeting.
    const db = userClient(req);
    const { data: profile } = await db
      .from('profiles')
      .select('name, credits, role')
      .eq('id', user.id)
      .maybeSingle();

    const systemPrompt =
      `You are the Skillvo Assistant, a friendly in-app helper for Skillvo — an online learning ` +
      `marketplace where students spend credits to enroll in courses, and teachers publish courses to ` +
      `earn credits. You help with: how credits work (buying packs, earning them from teaching or ` +
      `completing courses), enrolling in or publishing courses, live sessions / Meet links, study ` +
      `material and recorded lectures, and general navigation of the app (Explore, My Learning, ` +
      `Teaching, Credits Wallet, Leaderboard, Settings).\n\n` +
      (profile
        ? `You're talking to ${profile.name || 'a user'}, a ${profile.role || 'member'} with ${profile.credits ?? 0} credits.\n\n`
        : '') +
      `Keep replies short — 2-4 sentences, no markdown headers or long lists unless the user asks for ` +
      `steps. If asked something outside Skillvo (general knowledge, coding help unrelated to the ` +
      `platform, etc.), answer briefly but steer back to how Skillvo can help. Never invent specific ` +
      `numbers (prices, credit amounts) you were not given above — speak in general terms instead.`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.6,
        max_tokens: 400,
      }),
    });

    if (!groqRes.ok) {
      console.error('groq request failed', await groqRes.text());
      return json({ error: 'The assistant is having trouble right now.' }, 502);
    }

    const completion = await groqRes.json();
    const reply = completion.choices?.[0]?.message?.content;
    if (!reply) return json({ error: 'The assistant returned no reply.' }, 502);

    return json({ reply });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return json({ error: 'Could not reach the assistant.' }, 500);
  }
});
