/**
 * /projects/[id] brief review surface.
 *
 * Pure presentational component — all data is passed in as props. The page
 * route shapes data via src/lib/projectBriefView.ts before handing off here.
 *
 * Page contract (see docs/page-briefs.md → "Brief review"):
 * - Primary action: from `journey.primaryAction`. Not computed here.
 * - Secondary action: "Edit with Sagasan" — reopens chat with project loaded.
 * - Renders: project title, brief facts list, "What Saga will do" block,
 *   primary CTA. Nothing else.
 *
 * Intentionally NOT here: talent grids, candidate previews, outreach status,
 * ticketing copy, friend invites, payment, multiple competing CTAs.
 */

import Link from "next/link";
import type { BriefReviewData } from "@/lib/projectBriefView";
import { ProjectArchiveButton } from "@/components/projects/ProjectArchiveButton";

export function BriefReviewView({ data }: { data: BriefReviewData }) {
  const { projectId, title, facts, whatSagaWillDo, journey, editChatHref } = data;
  const action = journey.primaryAction;
  const primaryEnabled = action.enabled && Boolean(action.href);
  const isArchived = journey.step === "archived";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        {isArchived ? (
          <Link
            href="/projects"
            className="self-start text-sm text-zinc-500 underline-offset-4 hover:underline"
          >
            ← Your projects
          </Link>
        ) : (
          <Link
            href={editChatHref}
            className="self-start text-sm text-zinc-500 underline-offset-4 hover:underline"
          >
            ← Edit with Sagasan
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            {title}
          </h1>
          {isArchived ? (
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs uppercase tracking-wider text-zinc-500">
              Archived
            </span>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="brief-facts" className="flex flex-col gap-6">
        <h2 id="brief-facts" className="sr-only">
          Brief facts
        </h2>
        {facts.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Saga doesn&apos;t have details yet. Tap &ldquo;Edit with Sagasan&rdquo; to
            tell me more.
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-y-5 sm:grid-cols-2 sm:gap-x-10">
            {facts.map((fact) => (
              <div key={fact.label} className="flex flex-col gap-1">
                <dt className="text-xs uppercase tracking-wider text-zinc-500">
                  {fact.label}
                </dt>
                <dd className="text-base text-zinc-900">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section aria-labelledby="what-saga-will-do" className="flex flex-col gap-3 border-t border-zinc-200 pt-8">
        <h2
          id="what-saga-will-do"
          className="text-xs uppercase tracking-wider text-zinc-500"
        >
          What Saga will do
        </h2>
        <p className="text-base leading-relaxed text-zinc-700">
          {whatSagaWillDo}
        </p>
      </section>

      <section aria-labelledby="primary-action" className="flex flex-col gap-3 border-t border-zinc-200 pt-8">
        <h2 id="primary-action" className="sr-only">
          Primary action
        </h2>
        {isArchived ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-zinc-600">
              This brief has been discarded. Start a fresh one in chat.
            </p>
            <Link
              href="/chat?fresh=1"
              className="inline-flex items-center justify-center self-start rounded-md bg-zinc-900 px-6 py-3 text-base font-medium text-white transition hover:bg-zinc-800"
            >
              Start a new brief
            </Link>
          </div>
        ) : primaryEnabled ? (
          <Link
            href={action.href!}
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-6 py-3 text-base font-medium text-white transition hover:bg-zinc-800"
          >
            {action.label}
          </Link>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center justify-center rounded-md bg-zinc-200 px-6 py-3 text-base font-medium text-zinc-500"
            >
              {action.label}
            </button>
            {action.blockedReason ? (
              <p className="text-xs text-zinc-500">{action.blockedReason}</p>
            ) : null}
          </div>
        )}
      </section>

      {/*
        The archive control sits below the primary action so it's
        reachable but doesn't compete visually. Hidden once the project
        is already archived — the "Start a new brief" link above is the
        action that matters in that state.
      */}
      {isArchived ? null : (
        <section
          aria-labelledby="archive-control"
          className="flex flex-col gap-3 border-t border-zinc-200 pt-8"
        >
          <h2
            id="archive-control"
            className="text-xs uppercase tracking-wider text-zinc-500"
          >
            Wrong brief?
          </h2>
          <ProjectArchiveButton projectId={projectId} />
        </section>
      )}
    </main>
  );
}
