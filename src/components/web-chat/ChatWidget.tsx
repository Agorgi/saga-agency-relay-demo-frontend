"use client";

import { useEffect, useRef, useState } from "react";

type ChatRole = "user" | "assistant";
type ChatMode = "autonomous" | "holding";

type ChatEntry = {
  id: string;
  content: string;
  role: ChatRole;
  mode?: ChatMode;
};

type WebChatResponse = {
  conversationId: string;
  reply: string;
  turn: number;
  mode: ChatMode;
};

type WebChatHistoryResponse = {
  conversationId: null | string;
  messages: Array<{
    id: string;
    role: ChatRole;
    content: string;
    mode: ChatMode | null;
    turn: number;
    createdAt: string;
  }>;
};

type ChatWidgetProps = {
  eyebrow?: string;
  description?: string;
  placeholder?: string;
  welcomeMessage?: string;
};

const CONVERSATION_STORAGE_KEY = "saga-web-chat-conversation-id";
const DEFAULT_DESCRIPTION =
  "Tell Saga what you're producing, where it's happening, and the creative help you need.";
const DEFAULT_PLACEHOLDER =
  "Tell Saga what you're making, where it's happening, and the kind of help you need...";
const DEFAULT_WELCOME_MESSAGE =
  "Hi - I'm Saga. Tell me what you're producing, where it's happening, and the kind of creative help you need.";

function createInitialMessages(welcomeMessage: string): ChatEntry[] {
  return [
    {
      id: "assistant-welcome",
      role: "assistant",
      content: welcomeMessage,
    },
  ];
}

export function ChatWidget({
  eyebrow = "Project concierge",
  description = DEFAULT_DESCRIPTION,
  placeholder = DEFAULT_PLACEHOLDER,
  welcomeMessage = DEFAULT_WELCOME_MESSAGE,
}: ChatWidgetProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>(() =>
    createInitialMessages(welcomeMessage),
  );

  useEffect(() => {
    let cancelled = false;

    async function restoreConversation(preferredConversationId?: string | null) {
      const query = preferredConversationId
        ? `?conversationId=${encodeURIComponent(preferredConversationId)}`
        : "";
      const response = await fetch(`/api/web-chat${query}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | WebChatHistoryResponse
        | null;

      if (
        !response.ok ||
        !data ||
        typeof data !== "object" ||
        !Array.isArray(data.messages)
      ) {
        return false;
      }

      if (!cancelled) {
        if (data.conversationId) {
          window.localStorage.setItem(CONVERSATION_STORAGE_KEY, data.conversationId);
          setConversationId(data.conversationId);
        } else {
          window.localStorage.removeItem(CONVERSATION_STORAGE_KEY);
          setConversationId(null);
        }

        if (data.messages.length > 0) {
          setMessages(
            data.messages.map((message, index) => ({
              id: `${message.id}-${message.turn}-${message.role}-${index}`,
              role: message.role,
              content: message.content,
              mode: message.role === "assistant" ? message.mode ?? undefined : undefined,
            })),
          );
        } else {
          setMessages(createInitialMessages(welcomeMessage));
        }
      }

      return data.messages.length > 0;
    }

    async function bootstrap() {
      try {
        const storedConversationId = window.localStorage.getItem(
          CONVERSATION_STORAGE_KEY,
        );
        const restoredStoredThread = storedConversationId
          ? await restoreConversation(storedConversationId)
          : false;

        if (!restoredStoredThread) {
          await restoreConversation();
        }
      } catch {
        if (!cancelled) {
          setMessages(createInitialMessages(welcomeMessage));
        }
      } finally {
        if (!cancelled) {
          setIsRestoring(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [welcomeMessage]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = draft.trim();
    if (!message || isSending || isRestoring) {
      return;
    }

    const userMessage: ChatEntry = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };

    setError(null);
    setDraft("");
    setIsSending(true);
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/web-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          message,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | WebChatResponse
        | { error?: string }
        | null;

      if (!response.ok || !data || typeof data !== "object" || !("reply" in data)) {
        setError("Couldn't send - try again.");
        return;
      }

      window.localStorage.setItem(CONVERSATION_STORAGE_KEY, data.conversationId);
      setConversationId(data.conversationId);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${data.turn}-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          mode: data.mode,
        },
      ]);
    } catch {
      setError("Couldn't send - try again.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="brand-surface-strong rounded-[28px] p-4 shadow-[0_20px_60px_rgba(69,42,149,0.12)] sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--surface-border)] pb-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-light">
            {eyebrow}
          </p>
          <p className="mt-1 text-sm text-ink-light">{description}</p>
        </div>
        <span className="rounded-pill bg-canvas px-3 py-1 text-[11px] font-medium text-ink-light">
          {conversationId ? "Live thread" : "New thread"}
        </span>
      </div>

      <div className="mt-4 space-y-3 rounded-[24px] bg-white/45 p-3 sm:p-4">
        <div className="flex max-h-[420px] min-h-[280px] flex-col gap-3 overflow-y-auto pr-1">
          {messages.map((entry) => (
            <div
              key={entry.id}
              className={entry.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  entry.role === "user"
                    ? "max-w-[85%] rounded-[22px] rounded-br-md bg-[color:var(--brand-indigo)] px-4 py-3 text-sm leading-6 text-white shadow-[0_12px_28px_rgba(71,37,255,0.22)]"
                    : "brand-surface-inset max-w-[85%] rounded-[22px] rounded-bl-md px-4 py-3 text-sm leading-6 text-ink"
                }
              >
                <div>{entry.content}</div>
                {entry.role === "assistant" && entry.mode ? (
                  <div className="mt-2">
                    <span className="inline-flex rounded-pill bg-white/70 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-light">
                      {entry.mode}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {isSending ? (
            <div className="flex justify-start">
              <div className="brand-surface-inset rounded-[22px] rounded-bl-md px-4 py-3 text-sm text-ink-light">
                Saga is typing...
              </div>
            </div>
          ) : null}
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-ink" htmlFor="web-chat-message">
            Message
          </label>
          <textarea
            id="web-chat-message"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            placeholder={placeholder}
            disabled={isSending || isRestoring}
            rows={4}
            className="brand-surface-inset min-h-[112px] w-full rounded-[24px] px-4 py-3 text-sm leading-6 text-ink outline-none transition placeholder:text-ink-light/80 disabled:cursor-not-allowed disabled:opacity-70"
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-light" aria-live="polite">
              {error ??
                (isRestoring
                  ? "Restoring your conversation..."
                  : "Press Enter to send. Use Shift+Enter for a new line.")}
            </p>
            <button
              type="submit"
              disabled={isSending || isRestoring || draft.trim().length === 0}
              className="brand-button-primary rounded-pill px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRestoring ? "Loading..." : isSending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
