"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import {
  DEFAULT_CHAT_PLACEHOLDER,
  DEFAULT_WELCOME_MESSAGE,
  SAGASAN_AVATAR_SRC,
  SAGASAN_DISPLAY_NAME,
  useWebChat,
} from "@/components/web-chat/useWebChat";

type ChatWidgetProps = {
  placeholder?: string;
  welcomeMessage?: string;
};

export function ChatWidget({
  placeholder = DEFAULT_CHAT_PLACEHOLDER,
  welcomeMessage = DEFAULT_WELCOME_MESSAGE,
}: ChatWidgetProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const {
    conversationId,
    draft,
    error,
    isRestoring,
    isSending,
    messages,
    setDraft,
    submitCurrentDraft,
  } = useWebChat({ welcomeMessage });

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [draft]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: isRestoring ? "auto" : "smooth",
    });
  }, [isRestoring, isSending, messages]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitCurrentDraft();
  }

  return (
    <section className="brand-surface-strong overflow-hidden rounded-[32px] border border-[color:var(--surface-border)] shadow-[0_24px_70px_rgba(69,42,149,0.14)]">
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
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">
            {SAGASAN_DISPLAY_NAME}
          </p>
          <p className="truncate text-xs text-ink-light">
            {conversationId ? "Live producer conversation" : "Ready to help shape the brief"}
          </p>
        </div>
        <span className="rounded-pill bg-white/70 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-light">
          {conversationId ? "Live" : "New"}
        </span>
      </div>

      <div className="flex min-h-[560px] flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.58),rgba(247,241,255,0.38))]">
        <div
          ref={viewportRef}
          className="flex flex-1 flex-col justify-end gap-3 overflow-y-auto px-4 py-4"
        >
          {messages.map((entry) => (
            <div
              key={entry.id}
              className={entry.role === "user" ? "flex justify-end" : "flex justify-start"}
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

        <form ref={formRef} onSubmit={handleSubmit} className="border-t border-[color:var(--surface-border)] p-3">
          <label className="sr-only" htmlFor="web-chat-message">
            Message Sagasan
          </label>
          <div className="brand-surface-inset flex items-end gap-3 rounded-[26px] px-3 py-3">
            <textarea
              ref={textareaRef}
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
              rows={1}
              className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent px-1 py-1 text-[15px] leading-6 text-ink outline-none placeholder:text-ink-light/80 disabled:cursor-not-allowed disabled:opacity-70"
            />

            <button
              type="submit"
              disabled={isSending || isRestoring || draft.trim().length === 0}
              className="brand-button-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-60"
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
            {error ?? (isRestoring ? "Restoring your conversation..." : " ")}
          </p>
        </form>
      </div>
    </section>
  );
}
