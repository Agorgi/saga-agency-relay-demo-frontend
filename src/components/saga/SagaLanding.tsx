"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { HeroChatMorph } from "@/components/web-chat/HeroChatMorph";
import {
  requestWebChatReset,
  WEB_CHAT_RESET_EVENT,
} from "@/components/web-chat/useWebChat";
import { decodePrefillPayload } from "@/lib/webChatNextStep";
import type { Persona } from "@/lib/sagasanPersonas";

type IntentChip = {
  label: string;
  persona: Persona;
  hint: string;
};

const INTENT_CHIPS: IntentChip[] = [
  { label: "I'm hosting", persona: "host", hint: "host" },
  { label: "I'm a creative", persona: "creative", hint: "creative" },
  { label: "I run a space", persona: "venue", hint: "venue" },
  { label: "I'm a fan", persona: "fan", hint: "fan" },
];

export function SagaLanding() {
  return (
    <main className="saga saga-cyan-mode relative min-h-screen w-full overflow-x-hidden bg-[var(--saga-bg-base)]">
      <div className="saga-brand-halo" aria-hidden="true" />
      <SagaSparkles />
      <SagaRhizomeLanding />
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <SagaTopBar />
        <Suspense fallback={null}>
          <SagaLandingBody />
        </Suspense>
      </div>
    </main>
  );
}

function SagaTopBar() {
  return (
    <header className="flex items-center justify-between px-5 pt-5 sm:px-8 sm:pt-7">
      <div
        className="font-display text-[15px] uppercase"
        style={{
          fontFamily: "var(--saga-font-mono)",
          letterSpacing: "0.18em",
          color: "var(--saga-fg-primary)",
        }}
      >
        Saga
      </div>
      <div
        className="text-[10px] uppercase"
        style={{
          fontFamily: "var(--saga-font-mono)",
          letterSpacing: "0.16em",
          color: "var(--saga-fg-tertiary)",
        }}
      >
        Mobile demo
      </div>
    </header>
  );
}

function SagaLandingBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hostIntent = searchParams.get("intent") === "host";
  const [hostIntentActive, setHostIntentActive] = useState(false);
  const [isConversationOpen, setIsConversationOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const decodedPrefill = useMemo(
    () => decodePrefillPayload(searchParams.get("prefill")),
    [searchParams],
  );

  useEffect(() => {
    function handleReset() {
      setIsConversationOpen(false);
      setResetKey((current) => current + 1);
    }
    window.addEventListener(WEB_CHAT_RESET_EVENT, handleReset);
    return () => {
      window.removeEventListener(WEB_CHAT_RESET_EVENT, handleReset);
    };
  }, []);

  useEffect(() => {
    if (!hostIntent) {
      setHostIntentActive(false);
      return;
    }
    requestWebChatReset("host");
    setHostIntentActive(true);
    setIsConversationOpen(true);
    setResetKey((current) => current + 1);
  }, [hostIntent]);

  const contextNote = decodedPrefill
    ? {
        title: "Editing your brief",
        lines: Object.entries(decodedPrefill)
          .slice(0, 4)
          .map(([key, value]) => {
            const label = key
              .replace(/([A-Z])/g, " $1")
              .replace(/^./, (char) => char.toUpperCase());
            const rendered = Array.isArray(value) ? value.join(", ") : value;
            return `${label}: ${rendered}`;
          }),
      }
    : null;

  function handleIntent(chip: IntentChip) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("intent", chip.hint);
    router.push(`/?${params.toString()}`);
  }

  return (
    <section className="flex flex-1 flex-col items-center justify-center px-5 pb-16 pt-8 sm:px-8 sm:pt-10">
      <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-6 text-center">
        {!isConversationOpen ? (
          <>
            <h1
              data-copy-lint="header"
              className="saga-display-hero"
            >
              Lined up <span className="serif-it">by nature.</span>
            </h1>
            <p data-copy-lint="subhead" className="saga-hero-subtitle">
              Tell us what you want to make and we line up your team.
            </p>
          </>
        ) : null}

        <div className="w-full">
          <HeroChatMorph
            key={resetKey}
            fallbackPersona={hostIntentActive ? "host" : null}
            initialExpanded={hostIntentActive}
            welcomeMessage={
              hostIntentActive ? "Tell me what you're planning." : ""
            }
            contextNote={contextNote}
            onExpandedChange={(expanded) => {
              setIsConversationOpen(expanded);
            }}
          />
        </div>

        {!isConversationOpen ? (
          <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-2">
            {INTENT_CHIPS.map((chip) => (
              <button
                key={chip.persona}
                type="button"
                className="saga-intent-chip"
                onClick={() => handleIntent(chip)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SagaSparkles() {
  return (
    <div className="saga-sparkles" aria-hidden="true">
      <span className="sp lg" style={{ top: "12%", left: "18%" }} />
      <span className="sp" style={{ top: "22%", right: "16%" }} />
      <span className="sp" style={{ top: "34%", left: "9%" }} />
      <span className="sp lg" style={{ top: "30%", right: "22%" }} />
      <span className="sp" style={{ top: "16%", left: "62%" }} />
      <span className="sp" style={{ top: "44%", right: "10%" }} />
      <span className="sp" style={{ top: "8%", left: "44%" }} />
    </div>
  );
}

/**
 * Rhizome for Landing (HANDOFF § 4 — step 1 of 5):
 *   only YOU glows ember. Faint curves + tiny dim dots in the lower half
 *   suggest a network the user hasn't connected to yet. No role labels.
 */
function SagaRhizomeLanding() {
  return (
    <svg
      className="rhizome-bg"
      viewBox="0 0 400 832"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      {/* curves — lower half only, sporadic */}
      <path className="rline-soft" d="M30 540 Q160 470 320 560" />
      <path className="rline-soft" d="M60 620 Q230 580 380 660" />
      <path className="rline" d="M40 700 Q200 660 360 740" />
      <path className="rline-soft" d="M90 770 Q230 720 370 790" />
      <path className="rline-soft" d="M20 660 Q140 700 260 660" />
      <path className="rline-soft" d="M260 540 Q300 620 340 700" />
      <path className="rline" d="M70 580 Q140 620 200 580" />
      <path className="rline-soft" d="M180 730 Q240 780 320 760" />

      {/* dim dots — ambient "wider world out there" */}
      <circle className="rnode-d" cx="60" cy="620" r="1.4" />
      <circle className="rnode-d" cx="120" cy="560" r="1.4" />
      <circle className="rnode-d" cx="160" cy="680" r="1.6" />
      <circle className="rnode-d" cx="220" cy="600" r="1.4" />
      <circle className="rnode-d" cx="240" cy="740" r="1.4" />
      <circle className="rnode-d" cx="280" cy="640" r="1.6" />
      <circle className="rnode-d" cx="320" cy="700" r="1.4" />
      <circle className="rnode-d" cx="350" cy="600" r="1.4" />
      <circle className="rnode-d" cx="100" cy="780" r="1.4" />
      <circle className="rnode-d" cx="200" cy="780" r="1.4" />
      <circle className="rnode-d" cx="340" cy="780" r="1.4" />

      {/* YOU — sole ember glow */}
      <circle className="rnode-glow-e" cx="200" cy="710" r="3.2" />
      <text className="rlabel-hi" x="210" y="713">
        YOU
      </text>
    </svg>
  );
}
