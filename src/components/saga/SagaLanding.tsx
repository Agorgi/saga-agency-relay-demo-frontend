"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SagaShell } from "@/components/saga/SagaShell";

type IntentChip = {
  label: string;
  persona: "host" | "creative" | "venue" | "fan";
  wide?: boolean;
};

const INTENT_CHIPS: IntentChip[] = [
  { label: "host something", persona: "host" },
  { label: "find work", persona: "creative" },
  { label: "I run a venue", persona: "venue" },
  {
    label: "let Saga plan your next day/night out",
    persona: "fan",
    wide: true,
  },
];

export function SagaLanding() {
  return (
    <SagaShell state="NEW" atmosphere>
      <SagaRhizomeLanding />
      <SagaLandingBody />
    </SagaShell>
  );
}

function SagaLandingBody() {
  const router = useRouter();
  const [draft, setDraft] = useState("");

  function goToChat(persona?: string, prefill?: string) {
    const params = new URLSearchParams();
    if (persona) params.set("persona", persona);
    if (prefill) params.set("prefill", prefill);
    const query = params.toString();
    router.push(query ? `/chat?${query}` : "/chat");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    goToChat(undefined, text || undefined);
  }

  const narrowChips = INTENT_CHIPS.filter((chip) => !chip.wide);
  const wideChips = INTENT_CHIPS.filter((chip) => chip.wide);

  return (
    <section className="flex flex-1 flex-col items-center justify-center px-5 pb-24 pt-8 sm:px-8 sm:pt-10">
      <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-6 text-center">
        <h1 data-copy-lint="header" className="saga-display-hero">
          <span className="hero-word">tribal</span>
          <span className="serif-it">by nature</span>
        </h1>
        <p data-copy-lint="subhead" className="saga-hero-subtitle">
          Tell us what you&apos;re making.
        </p>

        <form
          onSubmit={handleSubmit}
          className="saga-launcher-form flex w-full items-center gap-3"
        >
          <label className="sr-only" htmlFor="saga-launcher">
            Start with Sagasan
          </label>
          <input
            id="saga-launcher"
            type="text"
            value={draft}
            placeholder="tell us what to make..."
            onChange={(event) => setDraft(event.target.value)}
            className="bg-transparent min-w-0 flex-1 text-[15px] leading-7 text-white outline-none placeholder:text-white/45"
          />
          <button
            type="submit"
            aria-label="Start chat"
            className="saga-launcher-send flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path
                d="M3.75 9H14.25M14.25 9L9.5 4.25M14.25 9L9.5 13.75"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>

        <div className="mt-2 flex w-full flex-col items-center gap-2">
          <div className="saga-intent-row">
            {narrowChips.map((chip) => (
              <button
                key={chip.persona}
                type="button"
                className="saga-intent-chip"
                onClick={() => goToChat(chip.persona)}
              >
                {chip.label}
              </button>
            ))}
          </div>
          {wideChips.length > 0 ? (
            <div className="saga-intent-row">
              {wideChips.map((chip) => (
                <button
                  key={chip.persona}
                  type="button"
                  className="saga-intent-chip saga-intent-chip-wide"
                  onClick={() => goToChat(chip.persona)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
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
      <path className="rline-soft" d="M30 540 Q160 470 320 560" />
      <path className="rline-soft" d="M60 620 Q230 580 380 660" />
      <path className="rline" d="M40 700 Q200 660 360 740" />
      <path className="rline-soft" d="M90 770 Q230 720 370 790" />
      <path className="rline-soft" d="M20 660 Q140 700 260 660" />
      <path className="rline-soft" d="M260 540 Q300 620 340 700" />
      <path className="rline" d="M70 580 Q140 620 200 580" />
      <path className="rline-soft" d="M180 730 Q240 780 320 760" />

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

      <circle className="rnode-glow-e" cx="200" cy="710" r="3.2" />
      <text className="rlabel-hi" x="210" y="713">
        YOU
      </text>
    </svg>
  );
}
