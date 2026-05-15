"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { PERSONA_OPTIONS } from "@/lib/sagasanPersonas";
import {
  DEFAULT_CHAT_PLACEHOLDER,
  DEFAULT_WELCOME_MESSAGE,
  SAGASAN_AVATAR_SRC,
  SAGASAN_DISPLAY_NAME,
  useWebChat,
} from "@/components/web-chat/useWebChat";

type HeroChatMorphProps = {
  onExpandedChange?: (expanded: boolean) => void;
};

export function HeroChatMorph({ onExpandedChange }: HeroChatMorphProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    conversationId,
    draft,
    error,
    isRestoring,
    isSending,
    messages,
    persona,
    setDraft,
    submitCurrentDraft,
  } = useWebChat({ welcomeMessage: DEFAULT_WELCOME_MESSAGE });

  useEffect(() => {
    if (!isRestoring && (conversationId || messages.length > 1)) {
      setIsExpanded(true);
    }
  }, [conversationId, isRestoring, messages.length]);

  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);

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

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !isExpanded) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [draft, isExpanded]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !isExpanded) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: isRestoring ? "auto" : "smooth",
    });
  }, [isExpanded, isRestoring, isSending, messages]);

  async function handleExpandedSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitCurrentDraft();
  }

  async function handleCollapsedSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRestoring || isSending || draft.trim().length === 0) {
      return;
    }

    setIsExpanded(true);
    await submitCurrentDraft();
  }

  async function handlePersonaClick(option: (typeof PERSONA_OPTIONS)[number]) {
    if (isRestoring || isSending) {
      return;
    }

    setIsExpanded(true);
    await submitCurrentDraft({
      message: option.firstTurn,
      persona: option.persona,
    });
  }

  const composerStatus = error || (isRestoring ? "Restoring your conversation..." : " ");

  return (
    <motion.div
      layout
      transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
      className="mx-auto flex w-full flex-col items-center"
    >
      <AnimatePresence initial={false} mode="wait">
        {isExpanded ? (
          <motion.section
            key="expanded-chat"
            layout
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.985 }}
            transition={{ duration: 0.34, ease: [0.23, 1, 0.32, 1] }}
            className="brand-surface-strong w-full max-w-[440px] overflow-hidden rounded-[38px] border border-[color:var(--surface-border-strong)] shadow-[0_28px_90px_rgba(55,32,118,0.18)]"
            style={{ height: "min(66vh, 610px)" }}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-center gap-3 border-b border-[color:var(--surface-border)] px-4 py-3.5">
                <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/60 bg-white/70 shadow-[0_10px_28px_rgba(75,46,150,0.15)]">
                  <Image
                    src={SAGASAN_AVATAR_SRC}
                    alt={SAGASAN_DISPLAY_NAME}
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">
                    {SAGASAN_DISPLAY_NAME}
                  </p>
                  <p className="truncate text-xs text-ink-light">
                    {conversationId ? "Live Saga chat" : "Ready when you are"}
                  </p>
                </div>
                <span className="rounded-pill bg-white/70 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-light">
                  {conversationId ? "Live" : "New"}
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.58),rgba(247,241,255,0.38))]">
                <div
                  ref={viewportRef}
                  className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-y-auto px-4 py-4"
                >
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
                            ? "max-w-[82%] rounded-[22px] rounded-br-md bg-[linear-gradient(135deg,#5f45ff,#6ea4ff)] px-4 py-2.5 text-left text-[14px] leading-6 text-white shadow-[0_14px_28px_rgba(71,37,255,0.22)]"
                            : "max-w-[82%] rounded-[22px] rounded-bl-md border border-white/65 bg-white/88 px-4 py-2.5 text-left text-[14px] leading-6 text-ink shadow-[0_10px_20px_rgba(58,35,123,0.08)]"
                        }
                      >
                        <div>{entry.content}</div>
                      </div>
                    </div>
                  ))}

                  {isSending ? (
                    <div className="flex justify-start">
                      <div className="max-w-[82%] rounded-[22px] rounded-bl-md border border-white/65 bg-white/88 px-4 py-2.5 text-left text-[14px] text-ink-light shadow-[0_10px_20px_rgba(58,35,123,0.08)]">
                        Sagasan is typing…
                      </div>
                    </div>
                  ) : null}
                </div>

                <form onSubmit={handleExpandedSubmit} className="border-t border-[color:var(--surface-border)] p-3">
                  <label className="sr-only" htmlFor="hero-chat-message">
                    Message Sagasan
                  </label>
                  <div className="brand-surface-inset flex items-end gap-3 rounded-[26px] px-3 py-3">
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
                      rows={1}
                      className="max-h-36 min-h-[24px] flex-1 resize-none bg-transparent px-1 py-1 text-[15px] leading-6 text-ink outline-none placeholder:text-ink-light/80 disabled:cursor-not-allowed disabled:opacity-70"
                    />

                    <button
                      type="submit"
                      disabled={isSending || isRestoring || draft.trim().length === 0}
                      className="brand-button-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-55"
                      aria-label="Send message"
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path
                          d="M3.75 9H14.25M14.25 9L9.5 4.25M14.25 9L9.5 13.75"
                          stroke="white"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>

                  <p className="min-h-[18px] px-1 pt-2 text-left text-[11px] text-ink-light" aria-live="polite">
                    {composerStatus}
                  </p>
                </form>
              </div>
            </div>
          </motion.section>
        ) : (
          <motion.div
            key="collapsed-chat"
            layout
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="w-full"
          >
            <div className="mx-auto flex w-full max-w-[720px] flex-col items-center gap-4">
              <form
                onSubmit={handleCollapsedSubmit}
                className="brand-surface-strong flex w-full items-center gap-3 rounded-[28px] border border-[color:var(--surface-border)] px-4 py-3 shadow-[0_20px_60px_rgba(64,44,128,0.12)]"
              >
                <div className="min-w-0 flex-1">
                  <label className="sr-only" htmlFor="hero-chat-launcher">
                    Start with Sagasan
                  </label>
                  <input
                    id="hero-chat-launcher"
                    type="text"
                    value={draft}
                    placeholder="Tell Sagasan what you need."
                    disabled={isRestoring || isSending}
                    onChange={(event) => {
                      setDraft(event.target.value);
                    }}
                    className="w-full bg-transparent text-[15px] font-light tracking-tight text-ink outline-none placeholder:text-ink-light sm:text-base disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isRestoring || isSending || draft.trim().length === 0}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
                    draft.trim().length > 0 ? "brand-button-primary" : "brand-surface-inset"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                  aria-label="Start project chat"
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
              </form>

              {!persona ? (
                <div className="flex w-full flex-wrap items-center justify-center gap-2">
                  {PERSONA_OPTIONS.map((option) => (
                    <button
                      key={option.persona}
                      type="button"
                      onClick={() => {
                        void handlePersonaClick(option);
                      }}
                      className="brand-chip rounded-pill px-4 py-2 text-sm font-medium text-ink-light transition hover:text-ink"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
