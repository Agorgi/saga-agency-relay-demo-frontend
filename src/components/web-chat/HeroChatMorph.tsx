"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_CHAT_DESCRIPTION,
  DEFAULT_CHAT_PLACEHOLDER,
  DEFAULT_WELCOME_MESSAGE,
  useWebChat,
} from "@/components/web-chat/useWebChat";

export function HeroChatMorph() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    conversationId,
    draft,
    error,
    isRestoring,
    isSending,
    messages,
    setDraft,
    submitCurrentDraft,
  } = useWebChat({ welcomeMessage: DEFAULT_WELCOME_MESSAGE });

  useEffect(() => {
    if (!isRestoring && (conversationId || messages.length > 1)) {
      setIsExpanded(true);
    }
  }, [conversationId, isRestoring, messages.length]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isExpanded]);

  async function handleExpandedSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitCurrentDraft();
  }

  const helperText = error
    ? error
    : isRestoring
      ? "Restoring your conversation..."
      : "Start with one sentence. Saga will turn it into a live producer conversation.";

  return (
    <motion.div
      layout
      transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      className="mx-auto flex w-full max-w-[940px] flex-col items-center"
    >
      <AnimatePresence initial={false} mode="wait">
        {isExpanded ? (
          <motion.section
            key="expanded-chat"
            layout
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="brand-surface-strong w-full overflow-hidden rounded-[34px] p-4 shadow-[0_24px_70px_rgba(69,42,149,0.16)] sm:p-5"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--surface-border)] pb-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-light">
                  Project concierge
                </p>
                <p className="mt-1 text-sm text-ink-light">
                  {DEFAULT_CHAT_DESCRIPTION}
                </p>
              </div>
              <span className="rounded-pill bg-canvas px-3 py-1 text-[11px] font-medium text-ink-light">
                {conversationId ? "Live thread" : "New thread"}
              </span>
            </div>

            <div className="mt-4 space-y-3 rounded-[28px] bg-white/45 p-3 sm:p-4">
              <div className="flex max-h-[340px] min-h-[220px] flex-col gap-3 overflow-y-auto pr-1 sm:max-h-[380px]">
                {messages.map((entry) => (
                  <div
                    key={entry.id}
                    className={
                      entry.role === "user" ? "flex justify-end" : "flex justify-start"
                    }
                  >
                    <div
                      className={
                        entry.role === "user"
                          ? "max-w-[88%] rounded-[24px] rounded-br-md bg-[color:var(--brand-indigo)] px-4 py-3 text-sm leading-6 text-white shadow-[0_16px_34px_rgba(71,37,255,0.2)]"
                          : "brand-surface-inset max-w-[88%] rounded-[24px] rounded-bl-md px-4 py-3 text-sm leading-6 text-ink"
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
                    <div className="brand-surface-inset rounded-[24px] rounded-bl-md px-4 py-3 text-sm text-ink-light">
                      Saga is typing...
                    </div>
                  </div>
                ) : null}
              </div>

              <form onSubmit={handleExpandedSubmit} className="space-y-3">
                <label className="sr-only" htmlFor="hero-chat-message">
                  Message
                </label>
                <textarea
                  ref={textareaRef}
                  id="hero-chat-message"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitCurrentDraft();
                    }
                  }}
                  placeholder={DEFAULT_CHAT_PLACEHOLDER}
                  disabled={isSending || isRestoring}
                  rows={4}
                  className="brand-surface-inset min-h-[132px] w-full rounded-[28px] px-5 py-4 text-sm leading-6 text-ink outline-none transition placeholder:text-ink-light/80 disabled:cursor-not-allowed disabled:opacity-70"
                />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-ink-light" aria-live="polite">
                    {helperText}
                  </p>
                  <button
                    type="submit"
                    disabled={isSending || isRestoring || draft.trim().length === 0}
                    className="brand-button-primary rounded-pill px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRestoring ? "Loading..." : isSending ? "Sending..." : "Send message"}
                  </button>
                </div>
              </form>
            </div>
          </motion.section>
        ) : (
          <motion.div
            key="collapsed-chat"
            layout
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
            className="w-full"
          >
            <div className="brand-surface-strong relative flex w-full items-center gap-3 rounded-[30px] px-4 py-3.5 shadow-[0_18px_54px_rgba(64,44,128,0.12)] sm:rounded-pill sm:px-5 sm:py-4">
              <div className="brand-surface-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-11 sm:w-11">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="7.5" cy="7.5" r="5" stroke="#8f8b85" strokeWidth="1.5" />
                  <path
                    d="M11.5 11.5L16 16"
                    stroke="#8f8b85"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <label className="sr-only" htmlFor="hero-chat-launcher">
                  Describe your project
                </label>
                <input
                  id="hero-chat-launcher"
                  type="text"
                  value={draft}
                  placeholder="Describe the project. Saga builds the team."
                  disabled={isRestoring}
                  onFocus={() => setIsExpanded(true)}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    if (!isExpanded) {
                      setIsExpanded(true);
                    }
                  }}
                  className="w-full bg-transparent text-[15px] font-light tracking-tight text-ink outline-none placeholder:text-ink-light sm:text-base"
                />
              </div>

              <button
                type="button"
                disabled={isRestoring}
                onClick={() => setIsExpanded(true)}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition sm:h-11 sm:w-11 ${
                  draft.trim().length > 0 ? "brand-button-primary" : "brand-surface-inset"
                } disabled:cursor-not-allowed disabled:opacity-60`}
                aria-label="Open project chat"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8h10m0 0L9 4m4 4L9 12"
                    stroke={draft.trim().length > 0 ? "#ffffff" : "#8f84ad"}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
