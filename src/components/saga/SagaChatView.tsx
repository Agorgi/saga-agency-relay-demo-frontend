"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { PersonaBadge } from "@/components/saga/PersonaBadge";
import { useWebChat } from "@/components/web-chat/useWebChat";
import type { Persona } from "@/lib/sagasanPersonas";

const BRIEF_FIELDS = [
  "Idea",
  "Where",
  "When",
  "Attendance",
  "Vibe",
  "Budget",
  "Help needed",
  "Existing crew",
];

const PERSONA_PARAM_TO_PERSONA: Record<string, Persona> = {
  host: "host",
  creative: "creative",
  venue: "venue",
  fan: "fan",
};

export function SagaChatView() {
  return (
    <Suspense fallback={null}>
      <SagaChatViewBody />
    </Suspense>
  );
}

function SagaChatViewBody() {
  const searchParams = useSearchParams();
  const personaParam = searchParams.get("persona") ?? "";
  const fallbackPersona: Persona | null =
    PERSONA_PARAM_TO_PERSONA[personaParam] ?? null;

  const {
    draft,
    error,
    isRestoring,
    isSending,
    messages,
    setDraft,
    submitCurrentDraft,
  } = useWebChat({ fallbackPersona });

  const threadRef = useRef<HTMLDivElement | null>(null);
  const prefillApplied = useRef(false);

  // Hydrate the draft from `?prefill=...` once on mount. Don't auto-submit
  // — the user can review what they typed and hit send themselves.
  useEffect(() => {
    if (prefillApplied.current) return;
    const prefill = searchParams.get("prefill");
    if (prefill && !draft) {
      setDraft(prefill);
      prefillApplied.current = true;
    }
  }, [searchParams, draft, setDraft]);

  // Keep the thread scrolled to the bottom as new turns arrive.
  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    await submitCurrentDraft();
  }

  const visibleMessages = messages.filter((entry) => entry.content.trim().length > 0);
  const hasMessages = visibleMessages.length > 0;
  const userTurnCount = visibleMessages.filter((m) => m.role === "user").length;
  const briefCount = Math.min(userTurnCount * 2, 8);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <SagaRhizomeChat />
      <PersonaBadge persona={fallbackPersona} />
      <div className="saga-chat-thread" ref={threadRef}>
        {visibleMessages.map((entry) => (
          <div
            key={entry.id}
            className={`saga-chat-row ${entry.role === "user" ? "is-user" : "is-saga"}`}
          >
            {entry.role === "assistant" ? (
              <div className="saga-chat-avatar" aria-hidden="true" />
            ) : null}
            <div
              className={`saga-chat-bubble ${entry.role === "user" ? "is-user" : "is-saga"}`}
            >
              {entry.content}
            </div>
          </div>
        ))}

        {isSending ? (
          <div className="saga-chat-row is-saga">
            <div className="saga-chat-avatar" aria-hidden="true" />
            <div className="saga-chat-bubble is-saga saga-chat-typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}

        {hasMessages && !isSending ? (
          <>
            <div className="saga-brief-card">
              <div className="bc-header">
                <span>Brief — what we have</span>
                <span className="bc-count">{briefCount} of 8</span>
              </div>
              <div className="bc-grid">
                {BRIEF_FIELDS.map((field) => (
                  <span key={field} className="bc-field">
                    {field}
                  </span>
                ))}
              </div>
            </div>

            <Link href="/projects" className="saga-cta-outline">
              view your project <span className="arrow">→</span>
            </Link>
          </>
        ) : null}

        {error ? <div className="saga-chat-error">{error}</div> : null}
      </div>

      <form className="saga-chat-composer" onSubmit={handleSubmit}>
        <div className="saga-chat-composer-row">
          <input
            type="text"
            placeholder={hasMessages ? "reply to Sagasan…" : "tell Sagasan what you're making…"}
            aria-label="Message Sagasan"
            value={draft}
            disabled={isRestoring}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={isRestoring || isSending || draft.trim().length === 0}
          >
            ↑
          </button>
        </div>
      </form>
    </div>
  );
}

function SagaRhizomeChat() {
  return (
    <div className="saga-rhizome-labels" aria-hidden="true">
      <svg
        className="rhizome-bg"
        viewBox="0 0 400 832"
        preserveAspectRatio="xMidYMax slice"
      >
        <path className="rline-soft" d="M-30 540 Q200 470 430 560" />
        <path className="rline-soft" d="M-30 620 Q230 580 430 660" />
        <path className="rline" d="M40 700 Q200 660 360 740" />
        <path className="rline-soft" d="M90 770 Q230 720 370 790" />
        <path className="rline-soft" d="M-30 666 Q200 700 380 720" />
        <path className="rline-soft" d="M260 540 Q300 620 340 700" />

        <circle className="rnode-d" cx="40" cy="540" r="1.5" />
        <circle className="rnode-d" cx="200" cy="500" r="1.5" />
        <circle className="rnode-d" cx="360" cy="560" r="1.5" />
        <circle className="rnode-d" cx="80" cy="640" r="1.5" />
        <circle className="rnode-d" cx="220" cy="660" r="1.5" />
        <circle className="rnode-d" cx="380" cy="640" r="1.5" />
        <circle className="rnode-d" cx="60" cy="720" r="1.5" />
        <circle className="rnode-d" cx="180" cy="720" r="1.5" />
        <circle className="rnode-d" cx="340" cy="680" r="1.5" />
        <circle className="rnode-d" cx="120" cy="780" r="1.5" />
        <circle className="rnode-d" cx="280" cy="780" r="1.5" />
        <circle className="rnode-d" cx="380" cy="770" r="1.5" />
      </svg>
      <span
        className="label label-you"
        style={{ left: "29%", top: "64%" }}
      >
        you
      </span>
      <span
        className="label label-saga"
        style={{ left: "60%", top: "74%" }}
      >
        sagasan
      </span>
    </div>
  );
}
