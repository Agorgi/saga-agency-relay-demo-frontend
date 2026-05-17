/**
 * /projects/[id]/crew Build my Crew surface.
 *
 * Pure presentational. Data from src/lib/projectCrewView.ts; primary action
 * from journey.primaryAction. See docs/page-briefs.md → "Build my Crew".
 *
 * What's on the page:
 * - Back link to brief
 * - Project snapshot bar (5 facts max)
 * - Roles list (title, why-needed, candidate count, "no one contacted")
 * - Page-level primary action (from journey)
 *
 * What's NOT on the page: per-candidate previews, candidate avatars, outreach
 * drafts, cross-role browsing, "Add another role manually" affordance.
 */

import Link from "next/link";
import type { CrewViewData } from "@/lib/projectCrewView";

export function BuildMyCrewView({ data }: { data: CrewViewData }) {
  const { briefSnapshot, roles, state, journey, editBriefHref } = data;
  const action = journey.primaryAction;
  const primaryEnabled = action.enabled && Boolean(action.href);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href={editBriefHref}
          className="self-start text-sm text-zinc-500 underline-offset-4 hover:underline"
        >
          ← Edit brief
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {briefSnapshot.title}
        </h1>
        {briefSnapshot.facts.length > 0 ? (
          <p className="text-sm text-zinc-600">
            {briefSnapshot.facts
              .map((fact) => fact.value)
              .join(" · ")}
          </p>
        ) : null}
      </header>

      <section aria-labelledby="roles-heading" className="flex flex-col gap-6 border-t border-zinc-200 pt-8">
        <h2 id="roles-heading" className="text-xs uppercase tracking-wider text-zinc-500">
          Roles for your team
        </h2>

        {state === "ready" ? (
          <ul className="flex flex-col gap-4">
            {roles.map((role) => (
              <li
                key={role.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium text-zinc-900">
                      {role.title}
                    </h3>
                    <span
                      className={
                        role.priority === "core"
                          ? "rounded bg-zinc-100 px-2 py-0.5 text-xs uppercase tracking-wide text-zinc-700"
                          : "rounded bg-amber-50 px-2 py-0.5 text-xs uppercase tracking-wide text-amber-700"
                      }
                    >
                      {role.priority === "core" ? "Core" : "Nice to have"}
                    </span>
                  </div>
                  {role.description ? (
                    <p className="text-sm text-zinc-600">{role.description}</p>
                  ) : null}
                  <p className="text-xs text-zinc-500">
                    {role.candidateCount} candidate
                    {role.candidateCount === 1 ? "" : "s"} · {role.approvedCount} approved · no one contacted
                  </p>
                </div>
                <Link
                  href={role.reviewHref}
                  className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 sm:self-center"
                >
                  Review →
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center">
            <p className="text-base text-zinc-700">
              {state === "researching"
                ? "Saga is researching the roles your brief needs."
                : "Your brief is still being shaped. Add a bit more, and the team will appear here."}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {state === "researching"
                ? "Come back in a few minutes."
                : "Tap \"Edit brief\" to continue."}
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="primary-action-heading" className="flex flex-col gap-3 border-t border-zinc-200 pt-8">
        <h2 id="primary-action-heading" className="sr-only">
          Primary action
        </h2>
        {primaryEnabled ? (
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
    </main>
  );
}
