"use client";

import { requestWebChatReset } from "@/components/web-chat/useWebChat";
import { useHandoffPrefill } from "@/lib/useHandoffPrefill";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";

export function SpacesView({
  encodedPrefill = null,
}: {
  encodedPrefill?: string | null;
}) {
  const { goHome } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";
  const prefill = useHandoffPrefill({
    encodedPrefill,
    route: "/spaces",
  });
  const handoffLines = [
    typeof prefill?.venueType === "string" && prefill.venueType
      ? `Space: ${prefill.venueType}`
      : null,
    typeof prefill?.city === "string" && prefill.city ? `City: ${prefill.city}` : null,
    typeof prefill?.capacity === "string" && prefill.capacity
      ? `Capacity: ${prefill.capacity}`
      : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <div
      className={`brand-page absolute inset-0 overflow-y-auto px-4 pb-32 pt-24 md:px-6 md:pb-16 md:pt-28 ${
        isDark ? "text-white" : "text-ink"
      }`}
    >
      <div className="mx-auto max-w-[920px] space-y-6">
        <section
          className={`rounded-[30px] p-5 sm:p-7 ${
            isDark ? "brand-surface-deep" : "brand-surface-strong"
          }`}
        >
          <p className={`text-[10px] uppercase tracking-[0.26em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
            Spaces
          </p>
          <h1
            data-copy-lint="header"
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl"
          >
            Your spaces.
          </h1>
          <p
            data-copy-lint="subhead"
            className={`mt-3 text-sm leading-7 ${isDark ? "text-white/62" : "text-ink-light"}`}
          >
            Requests and listings.
          </p>
        </section>

        {handoffLines.length > 0 ? (
          <section
            className={`rounded-[24px] border p-5 ${
              isDark
                ? "border-white/8 bg-white/[0.04]"
                : "border-black/8 bg-white/88 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
            }`}
          >
            <p className={`text-[10px] uppercase tracking-[0.22em] ${isDark ? "text-white/42" : "text-ink-light"}`}>
              Sagasan handoff
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {handoffLines.map((line) => (
                <span
                  key={line}
                  className={`rounded-pill px-3 py-1.5 text-xs font-medium ${
                    isDark ? "bg-white/8 text-white/72" : "bg-canvas text-ink-light"
                  }`}
                >
                  {line}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section
          className={`rounded-[26px] border p-6 ${
            isDark
              ? "border-white/8 bg-white/[0.04]"
              : "border-black/8 bg-white/88 shadow-[0_16px_40px_rgba(17,17,17,0.06)]"
          }`}
        >
          <h2 className={`text-2xl font-semibold tracking-tight ${isDark ? "text-white" : "text-ink"}`}>
            No spaces listed.
          </h2>
          <p className={`mt-3 text-sm leading-7 ${isDark ? "text-white/60" : "text-ink-light"}`}>
            Sagasan can open the venue intake and turn your first details into a live request flow.
          </p>
          <button
            onClick={() => {
              requestWebChatReset("venue");
              goHome();
            }}
            className="brand-button-primary mt-4 rounded-pill px-4 py-2.5 text-sm font-medium"
          >
            List a space
          </button>
        </section>
      </div>
    </div>
  );
}
