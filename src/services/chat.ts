import { supabase } from '../lib/supabase';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Asks the `chat-assistant` edge function (Groq) for the next assistant reply. */
export async function sendChatMessage(history: ChatMessage[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ reply: string }>('chat-assistant', {
    body: { messages: history },
  });
  if (error) throw error;
  if (!data?.reply) throw new Error('The assistant did not reply.');
  return data.reply;
}
