"use client";

import { PostComposerModal } from "@/components/PostComposerModal";
import { SagaShell } from "@/components/saga/SagaShell";

/**
 * Outer frame for every consumer page outside the Figma-spec screens
 * (Landing / Chat / Brief / Crew / Candidates). Wraps content in
 * SagaShell so the saga design tokens + cyan-mode + status / session
 * chrome cascade everywhere. The legacy AppChrome top + bottom nav is
 * deliberately not rendered here — the page-toggle delivered by
 * SagaShell is the QA navigator, and the persona-aware nav will be
 * rebuilt against the new design system when the Figma covers it.
 *
 * `chrome` is kept on the signature for callsite compatibility; the
 * value is currently ignored.
 */
export function AppFrame({
  children,
  composer = true,
  sessionState = "ACTIVE",
}: {
  children: React.ReactNode;
  chrome?: boolean;
  composer?: boolean;
  sessionState?: string;
}) {
  return (
    <SagaShell state={sessionState}>
      <div className="relative w-full flex-1">
        {children}
        {composer ? <PostComposerModal /> : null}
      </div>
    </SagaShell>
  );
}
