/**
 * The floating "Skillvo Assistant" bubble + panel used on the signed-in
 * chrome and on stand-alone sub-pages (Credits Wallet, Profile, ...) that
 * render outside AppShell and so don't get it for free.
 *
 * Backed by the `chat-assistant` Edge Function (Groq) — see services/chat.ts.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { sendChatMessage, type ChatMessage } from '../services/chat';
import { toFriendlyError } from '../lib/supabase';

const GREETING: ChatMessage = {
  role: 'assistant',
  content: "👋 Hi! Ask me anything about credits, courses, or getting started.",
};

export default function ChatWidget() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([GREETING]);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [open, messages, sending]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;

    const next = [...messages, { role: 'user', content } as ChatMessage];
    setMessages(next);
    setDraft('');
    setSending(true);
    try {
      // The system prompt is injected server-side; only the conversation goes over the wire.
      const reply = await sendChatMessage(next.slice(-16));
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${toFriendlyError(err)}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed z-40 bottom-24 right-6 w-80 max-w-[calc(100vw-3rem)] bg-white rounded-[18px] shadow-[0_24px_60px_rgba(5,31,32,.22)] overflow-hidden font-body flex flex-col">
          <div className="bg-[#163832] px-4.5 py-4 flex items-center justify-between shrink-0">
            <span className="font-heading font-bold text-sm text-white">Skillvo Assistant</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="bg-transparent border-0 text-mint text-base cursor-pointer"
            >
              ×
            </button>
          </div>

          <div
            ref={scrollRef}
            className="p-3.5 h-80 max-h-[50vh] overflow-y-auto bg-[#F5FAF7] flex flex-col gap-2.5"
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={`max-w-[85%] text-[13px] leading-relaxed px-3.5 py-2.5 rounded-[14px] whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'self-end bg-moss text-white rounded-br-[4px]'
                    : 'self-start bg-white text-[#4A544C] border border-mint rounded-bl-[4px]'
                }`}
              >
                {message.content}
              </div>
            ))}
            {sending && (
              <div className="self-start flex items-center gap-1.5 text-xs text-slate px-3.5 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex gap-2 p-3 border-t border-mint shrink-0"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              disabled={sending}
              className="flex-1 text-[13px] px-3 py-2.5 rounded-[10px] border border-mint outline-none bg-white disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="font-heading font-bold text-[13px] text-white bg-moss border-0 rounded-[10px] px-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Toggle AI chatbot"
        className="fixed z-40 bottom-6 right-6 w-14 h-14 rounded-full bg-moss border-0 shadow-[0_10px_26px_rgba(5,31,32,.35)] cursor-pointer flex items-center justify-center transition-transform duration-250 hover:scale-108"
      >
        <span className="text-2xl">{open ? '×' : '💬'}</span>
      </button>
    </>
  );
}
