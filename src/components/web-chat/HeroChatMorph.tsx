"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatThread } from "@/components/web-chat/ChatThread";
import {
  DEFAULT_CHAT_PLACEHOLDER,
  DEFAULT_WELCOME_MESSAGE,
  SAGASAN_AVATAR_SRC,
  SAGASAN_DISPLAY_NAME,
  useWebChat,
} from "@/components/web-chat/useWebChat";
import {
  buildOrganizerProgressLabel,
  evaluateOrganizerBriefReadiness,
  extractOrganizerIntakeFieldsFromMessages,
  formatOrganizerKnownSummary,
  formatOrganizerMissingSummary,
} from "@/lib/sagasanOrganizerIntake";
import { PERSONA_OPTIONS, type Persona } from "@/lib/sagasanPersonas";
import { buildNextStepHref, type WebChatNextStep } from "@/lib/webChatNextStep";

type HeroChatMorphProps = {
  onExpandedChange?: (expanded: boolean) => void;
  fallbackPersona?: Persona | null;
  initialExpanded?: boolean;
  welcomeMessage?: string;
  collapsedPlaceholder?: string;
  /** Hide the internal persona-picker chip row. SagaLanding provides
   *  its own intent-chip row above the launcher, so the duplicate
   *  picker needs to be suppressed there. Default false preserves
   *  legacy behavior for any other caller. */
  hidePersonaPicker?: boolean;
  /** Style the collapsed launcher with the saga cyan-dark surface
   *  instead of the legacy white-glass surface. Used by the Landing
   *  per the Figma. */
  sagaSurface?: boolean;
  contextNote?: {
    title: string;
    lines: string[];
  } | null;
};

export function HeroChatMorph({
  onExpandedChange,
  fallbackPersona = null,
  initialExpanded = false,
  welcomeMessage = DEFAULT_WELCOME_MESSAGE,
  collapsedPlaceholder = "Tell Sagasan what you need.",
  hidePersonaPicker = false,
  sagaSurface = false,
  contextNote = null,
}: HeroChatMorphProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
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
  } = useWebChat({
    welcomeMessage,
    fallbackPersona,
  });

  const initialMessageCount = welcomeMessage.trim() ? 1 : 0;
  const hasActiveConversation =
    Boolean(conversationId) || messages.length > initialMessageCount;

  useEffect(() => {
    if (initialExpanded && !isRestoring) {
      setIsExpanded(true);
    }
  }, [initialExpanded, isRestoring]);

  useEffect(() => {
    if (!isRestoring && hasActiveConversation) {
      setIsExpanded(true);
    }
  }, [hasActiveConversation, isRestoring]);

  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !isExpanded) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [draft, isExpanded]);

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
    const viewport = viewportRef.current;
    if (!viewport || !isExpanded) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: isRestoring ? "auto" : "smooth",
    });
  }, [isExpanded, isRestoring, isSending, messages]);

  async function handleLauncherSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRestoring || isSending || draft.trim().length === 0) {
      return;
    }

    setIsExpanded(true);
    await submitCurrentDraft({
      persona: fallbackPersona,
    });
  }

  async function handleExpandedSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  function handleNextStep(nextStep: WebChatNextStep) {
    router.push(buildNextStepHref(nextStep));
  }

  const composerStatus = error || (isRestoring ? "Restoring your conversation..." : " ");
  const chipPersona = useMemo(() => fallbackPersona ?? persona, [fallbackPersona, persona]);
  const organizerGuidance = useMemo(() => {
    const effectivePersona = fallbackPersona ?? persona;
    if (effectivePersona !== "host") {
      return null;
    }

    const userMessages = messages
      .filter((message) => message.role === "user")
      .map((message) => message.content);
    if (userMessages.length === 0) {
      return null;
    }

    const fields = extractOrganizerIntakeFieldsFromMessages(userMessages);
    const readiness = evaluateOrganizerBriefReadiness(fields);
    return {
      progress: buildOrganizerProgressLabel(readiness),
      known: formatOrganizerKnownSummary(readiness),
      missing:
        formatOrganizerMissingSummary(readiness) ||
        "enough signal is in place for the next stage",
    };
  }, [fallbackPersona, messages, persona]);

  return (
    <motion.div
      layout
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="mx-auto flex w-full max-w-[720px] flex-col items-center"
    >
      <motion.section
        layout
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        className={`${
          sagaSurface && !isExpanded
            ? "w-full"
            : "brand-surface-strong w-full overflow-hidden rounded-[34px] border border-[color:var(--surface-border)] shadow-[0_24px_70px_rgba(64,44,128,0.14)]"
        } ${isExpanded ? "max-w-[520px]" : ""}`}
      >
        <AnimatePresence initial={false}>
          {isExpanded ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex h-[min(68vh,640px)] min-h-[480px] flex-col"
            >
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
                    {conversationId ? "Routing your next move" : "Ready when you are"}
                  </p>
                </div>
              </div>

              {contextNote ? (
                <div className="border-b border-[color:var(--surface-border)] px-4 py-3 text-left">
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-light">
                    {contextNote.title}
                  </p>
                  <div className="mt-2 space-y-1">
                    {contextNote.lines.map((line) => (
                      <p key={line} className="text-sm leading-6 text-ink-light">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {organizerGuidance ? (
                <div className="border-b border-[color:var(--surface-border)] px-4 py-3 text-left">
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-light">
                    {organizerGuidance.progress}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink-light">
                    Known: {organizerGuidance.known}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-ink-light">
                    Missing: {organizerGuidance.missing}
                  </p>
                </div>
              ) : null}

              <div className="flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.58),rgba(247,241,255,0.38))]">
                <div
                  ref={viewportRef}
                  className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-y-auto px-4 py-4"
                >
                  <ChatThread
                    messages={messages}
                    isSending={isSending}
                    onNextStep={handleNextStep}
                  />
                </div>

                <form
                  onSubmit={handleExpandedSubmit}
                  className="border-t border-[color:var(--surface-border)] p-3"
                >
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

                  <p
                    className="min-h-[18px] px-1 pt-2 text-left text-[11px] text-ink-light"
                    aria-live="polite"
                  >
                    {composerStatus}
                  </p>
                </form>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="px-4 py-4 sm:px-5 sm:py-5"
            >
              <form
                onSubmit={handleLauncherSubmit}
                className={
                  sagaSurface
                    ? "saga-launcher-form flex w-full items-center gap-3 px-4 py-3"
                    : "flex w-full items-center gap-3 rounded-[28px] border border-[color:var(--surface-border)] bg-white/78 px-4 py-3"
                }
              >
                <div className="min-w-0 flex-1">
                  <label className="sr-only" htmlFor="hero-chat-launcher">
                    Start with Sagasan
                  </label>
                  <input
                    id="hero-chat-launcher"
                    type="text"
                    value={draft}
                    placeholder={collapsedPlaceholder}
                    disabled={isRestoring || isSending}
                    onChange={(event) => {
                      setDraft(event.target.value);
                    }}
                    className={
                      sagaSurface
                        ? "w-full bg-transparent text-[15px] leading-7 text-white outline-none placeholder:text-white/45 disabled:cursor-not-allowed disabled:opacity-70"
                        : "w-full bg-transparent text-[15px] leading-7 text-ink outline-none placeholder:text-ink-light/80 disabled:cursor-not-allowed disabled:opacity-70"
                    }
                  />
                </div>

                <button
                  type="submit"
                  disabled={isRestoring || isSending || draft.trim().length === 0}
                  className={
                    sagaSurface
                      ? "saga-launcher-send flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-55"
                      : "brand-button-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-55"
                  }
                  aria-label="Start chat"
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
              </form>

              {hidePersonaPicker ? null : (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {PERSONA_OPTIONS.map((option) => {
                    const isActive = chipPersona === option.persona;
                    return (
                      <button
                        key={option.persona}
                        type="button"
                        onClick={() => void handlePersonaClick(option)}
                        disabled={isRestoring || isSending}
                        className={`rounded-pill px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          isActive
                            ? "bg-[linear-gradient(135deg,rgba(95,69,255,0.16),rgba(255,79,158,0.16))] text-ink shadow-[0_10px_24px_rgba(66,47,145,0.12)]"
                            : "brand-chip text-ink hover:text-ink"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <p
                className="min-h-[18px] px-1 pt-3 text-center text-[11px] text-ink-light"
                aria-live="polite"
              >
                {composerStatus}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
}
