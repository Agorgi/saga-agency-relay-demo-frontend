/**
 * /projects/[id]/crew/[roleId] — Candidate review per role.
 *
 * Pure presentational. Data from src/lib/projectCandidateView.ts; primary
 * action from journey.primaryAction. See docs/page-briefs.md → "Candidate
 * review (per role)".
 *
 * What's on the page:
 * - Back link to /projects/[id]/crew
 * - Role context: title, why-needed, persistent "no one has been contacted"
 * - 3-5 candidate cards (when available). Each card carries:
 *   - Name (real or "Demo candidate · Composite from public sources")
 *   - Location and role
 *   - Why-fit (brief-specific, no generic copy)
 *   - Evidence row (2-3 links with domain shown)
 *   - Status row (contactability + review status + not contacted + not
 *     confirmed) — surfaced inline, never collapsed under disclosure UI
 *   - Three review buttons (Approve / Pass / Need more info)
 * - Page-level primary action (from journey)
 *
 * What's NOT on the page: candidate avatars (deferred), profile-page links,
 * outreach drafts, SMS/phone numbers, "favorite" / engagement actions,
 * cross-role browsing.
 */

import Link from "next/link";
import type {
  CandidateCardData,
  CandidateReviewData,
} from "@/lib/projectCandidateView";

function sourceModeLabel(mode: CandidateCardData["display"]["sourceMode"]) {
  if (mode === "demo_composite") return "Demo candidate · Composite from public sources";
  if (mode === "researched_unverified") return "Researched · Not yet verified";
  return null;
}

function CandidateCard({ candidate }: { candidate: CandidateCardData }) {
  const sourceLabel = sourceModeLabel(candidate.display.sourceMode);
  const reviewLabel = {
    pending: "pending review",
    approved: "approved",
    rejected: "passed",
    needs_info: "needs more info",
  }[candidate.reviewStatus];

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-6">
      <header className="flex flex-col gap-1">
        <h3 className="text-lg font-medium text-zinc-900">
          {candidate.display.name}
        </h3>
        {sourceLabel ? (
          <p className="text-xs text-amber-700">{sourceLabel}</p>
        ) : null}
        <p className="text-sm text-zinc-600">
          {[
            candidate.display.location,
            candidate.display.primaryRole,
            ...candidate.display.secondaryRoles,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <section className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wider text-zinc-500">Why she fits</p>
        <p className="text-sm text-zinc-700">{candidate.whyFit}</p>
      </section>

      {candidate.evidence.length > 0 ? (
        <section className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Evidence</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {candidate.evidence.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm text-zinc-700 underline-offset-4 hover:underline"
                >
                  {item.label}
                  <span className="ml-1 text-xs text-zinc-500">({item.domain})</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-zinc-500">
        Contactability · {candidate.contactability.replace(/_/g, " ")} ·{" "}
        Status · {reviewLabel} · not contacted · not confirmed
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
          data-candidate-id={candidate.id}
          data-action="approve"
        >
          Approve
        </button>
        <button
          type="button"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
          data-candidate-id={candidate.id}
          data-action="pass"
        >
          Pass
        </button>
        <button
          type="button"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
          data-candidate-id={candidate.id}
          data-action="request_info"
        >
          Need more info
        </button>
      </div>
    </article>
  );
}

export function CandidateReviewView({ data }: { data: CandidateReviewData }) {
  const { role, candidates, state, journey, backHref } = data;
  const action = journey.primaryAction;
  const primaryEnabled = action.enabled && Boolean(action.href);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href={backHref}
          className="self-start text-sm text-zinc-500 underline-offset-4 hover:underline"
        >
          ← Back to crew
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {role.title}
        </h1>
        {role.whyNeeded ? (
          <p className="text-sm text-zinc-600">{role.whyNeeded}</p>
        ) : null}
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          No one has been contacted.
        </p>
      </header>

      <section
        aria-labelledby="candidates-heading"
        className="flex flex-col gap-4 border-t border-zinc-200 pt-6"
      >
        <h2 id="candidates-heading" className="sr-only">
          Candidates
        </h2>
        {state === "ready" ? (
          candidates.map((candidate) => (
            <CandidateCard key={candidate.id} candidate={candidate} />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center">
            <p className="text-base text-zinc-700">
              {state === "researching"
                ? "Saga is sourcing candidates for this role."
                : "No candidates to show on this role yet."}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Come back in a few minutes — research takes a moment.
            </p>
          </div>
        )}
      </section>

      <section
        aria-labelledby="primary-action-heading"
        className="flex flex-col gap-3 border-t border-zinc-200 pt-6"
      >
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
