import type { ReactNode } from "react";
import Link from "next/link";
import { SagaStarMenu } from "@/components/saga/SagaStarMenu";

type SagaShellProps = {
  state?: string;
  /** Replace the SESSION // state badge with a back link. Used by
   *  Brief / Crew / Candidates per the Figma. */
  back?: { href: string; label: string };
  version?: string;
  /** When true, paint brand halo + sparkle layer behind the content
   *  (matches the Figma Landing). Off by default so wrapped pages keep
   *  their own backgrounds. */
  atmosphere?: boolean;
  /** Status-bar time. Defaults to the canonical 9:41 from the Figma. */
  time?: string;
  /** Render the internal QA navigator (star button + drawer). Default on. */
  pageToggle?: boolean;
  /** Render solid Saga background. Off when wrapping a legacy
   *  AppFrame that brings its own background. */
  bg?: boolean;
  /** Session-status dot color: "cyan" (Landing / Brief / Crew etc.)
   *  or "ember" (Chat / live sessions). */
  dot?: "cyan" | "ember";
  /** Render a 1px hairline divider directly under the app-header.
   *  Used on Chat / Brief / Crew / Candidates per the Figma. */
  underline?: boolean;
  children: ReactNode;
};

export function SagaShell({
  state,
  back,
  version = "v0.1",
  atmosphere = false,
  time = "9:41",
  pageToggle = true,
  bg = true,
  dot = "cyan",
  underline = false,
  children,
}: SagaShellProps) {
  const rootClass = bg
    ? "saga saga-cyan-mode relative min-h-screen w-full overflow-x-hidden bg-[var(--saga-bg-base)]"
    : "saga saga-cyan-mode relative min-h-screen w-full overflow-x-hidden";
  return (
    <div className={rootClass}>
      {atmosphere ? (
        <>
          <div className="saga-brand-halo" aria-hidden="true" />
          <SagaSparkles />
        </>
      ) : null}
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <div className="saga-top-hair" aria-hidden="true" />
        <div className="saga-status-bar">
          <span className="sb-time">{time}</span>
          <span className="sb-mark">saga</span>
        </div>
        <div className="saga-app-header">
          {back ? (
            <Link href={back.href} className="ah-back">
              ← {back.label}
            </Link>
          ) : (
            <span className={`ah-session ah-dot-${dot}`}>
              SESSION // {state}
            </span>
          )}
          <span className="ah-version">{version}</span>
        </div>
        {underline ? <div className="saga-app-underline" aria-hidden="true" /> : null}
        {children}
      </div>
      {pageToggle ? <SagaStarMenu /> : null}
    </div>
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
