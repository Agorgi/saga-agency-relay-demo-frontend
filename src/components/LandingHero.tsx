"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { HeroChatMorph } from "@/components/web-chat/HeroChatMorph";
import {
  requestWebChatReset,
  WEB_CHAT_RESET_EVENT,
} from "@/components/web-chat/useWebChat";
import { decodePrefillPayload } from "@/lib/webChatNextStep";

export function LandingHero() {
  const searchParams = useSearchParams();
  const [isConversationOpen, setIsConversationOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [hostIntentActive, setHostIntentActive] = useState(false);

  const hostIntent = searchParams.get("intent") === "host";
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

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-4 pt-24 sm:px-6 sm:pt-20 lg:px-8">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[45vw] bg-[radial-gradient(circle_at_left_center,rgba(255,79,158,0.1),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[50vw] bg-[radial-gradient(circle_at_right_center,rgba(126,164,255,0.14),transparent_60%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-[920px] flex-col items-center gap-8 text-center">
        {!isConversationOpen ? (
          <div className="flex w-full max-w-[780px] flex-col items-center gap-4">
            <h1
              data-copy-lint="header"
              className="brand-display text-[2.9rem] leading-[0.92] font-semibold tracking-[-0.04em] text-ink sm:text-5xl md:text-6xl lg:text-[4.6rem] xl:text-[5rem]"
            >
              Your personal creative
              <br className="hidden md:block" />
              producer.
            </h1>
            <p
              data-copy-lint="subhead"
              className="max-w-[620px] text-[15px] font-light leading-7 text-ink-light sm:text-base md:text-lg"
            >
              What brings you here?
            </p>
          </div>
        ) : null}

        <HeroChatMorph
          key={resetKey}
          fallbackPersona={hostIntentActive ? "host" : null}
          initialExpanded={hostIntentActive}
          welcomeMessage={hostIntentActive ? "Tell me what you're planning." : ""}
          contextNote={contextNote}
          onExpandedChange={(expanded) => {
            setIsConversationOpen(expanded);
          }}
        />
      </div>
    </div>
  );
}
