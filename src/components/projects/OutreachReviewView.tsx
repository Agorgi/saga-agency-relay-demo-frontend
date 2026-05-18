/**
 * /projects/[slug]/outreach Outreach review surface.
 *
 * Pure presentational. Data from src/lib/projectOutreachView.ts; primary
 * action from journey.primaryAction. See docs/page-briefs.md when that
 * doc is updated alongside this PR.
 *
 * What's on the page:
 * - Back link to /projects/[id]/crew
 * - Project snapshot bar (facts already gathered)
 * - Persistent "nothing has been sent" disclaimer
 * - Draft cards: candidate name, role, why-fit, message body, status
 * - Page-level primary action (from journey)
 *
 * What's NOT on the page (yet): per-draft edit-in-place, per-draft
 * approve/reject buttons, SMS phone numbers, "send now" affordance,
 * outreach analytics. v1 is read-and-approve-all.
 *
 * Honesty contract: outreachStatus is type-pinned to "not_prepared" |
 * "draft" | "approved_to_send" | "sent". The "sent" value is
 * structurally unreachable today (Twilio kill switch + A2P gate). The
 * page never says "sent" or "contacted" outside what the data
 * literally reports.
 */

import Link from "next/link";
import type {
  OutreachDraftPresentation,
  OutreachStatusForUI,
  OutreachViewData,
} from "@/lib/projectOutreachView";

const STATUS_LABELS: Record<OutreachStatusForUI, string> = {
  not_prepared: "Not prepared",
  draft: "Draft — awaiting your review",
  approved_to_send: "Approved · send is gated",
  sent: "Sent",
};

const STATUS_TONES: Record<OutreachStatusForUI, string> = {
  not_prepared: "bg-zinc-100 text-zinc-700",
  draft: "bg-amber-50 text-amber-800",
  approved_to_send: "bg-emerald-50 text-emerald-800",
  sent: "bg-blue-50 text-blue-800",
};

function DraftCard({ draft }: { draft: OutreachDraftPresentation }) {
  const statusLabel = STATUS_LABELS[draft.outreachStatus];
  const statusTone = STATUS_TONES[draft.outreachStatus];

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-medium text-zinc-900">{draft.candidateName}</h3>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs uppercase tracking-wide text-zinc-700">
            {draft.role}
          </span>
        </div>
        <p className="text-sm text-zinc-600">{draft.matchRationale}</p>
      </header>

      <section className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Draft message
        </p>
        <p className="whitespace-pre-line rounded-md bg-zinc-50 p-4 text-sm text-zinc-800">
          {draft.body}
        </p>
      </section>

      <p className="text-xs text-zinc-500">
        <span
          className={`mr-2 inline-block rounded px-2 py-0.5 text-[11px] font-medium ${statusTone}`}
        >
          {statusLabel}
        </span>
        · not contacted · not confirmed
      </p>

      {draft.blocked && draft.blockReason ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">
          Producer safety gate held this draft: {draft.blockReason}
        </p>
      ) : null}
    </article>
  );
}

export function OutreachReviewView({ data }: { data: OutreachViewData }) {
  const { briefSnapshot, drafts, state, journey, editCrewHref, projectId, honestyDisclaimer } =
    data;
  const action = journey.primaryAction;
  const primaryEnabled = action.enabled && Boolean(action.href);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href={editCrewHref}
          className="self-start text-sm text-zinc-500 underline-offset-4 hover:underline"
        >
          ← Back to crew
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          {briefSnapshot.title}
        </h1>
        {briefSnapshot.facts.length > 0 ? (
          <p className="text-sm text-zinc-600">
            {briefSnapshot.facts.map((fact) => fact.value).join(" · ")}
          </p>
        ) : null}
        <p className="mt-3 rounded-md bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          {honestyDisclaimer}
        </p>
      </header>

      <section
        aria-labelledby="drafts-heading"
        className="flex flex-col gap-6 border-t border-zinc-200 pt-8"
      >
        <h2
          id="drafts-heading"
          className="text-xs uppercase tracking-wider text-zinc-500"
        >
          Outreach drafts
        </h2>

        {state === "ready_for_review" || state === "awaiting_send" || state === "approved" ? (
          <ul className="flex flex-col gap-4">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <DraftCard draft={draft} />
              </li>
            ))}
          </ul>
        ) : state === "preparing" ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center">
            <p className="text-base text-zinc-700">
              Saga is preparing outreach drafts for your approved candidates.
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Refresh in a moment, or head back to crew if you want to keep
              reviewing while drafts are written.
            </p>
          </div>
        ) : state === "before_outreach_prep" ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center">
            <p className="text-base text-zinc-700">
              Outreach drafts unlock after you approve at least one candidate
              per core role.
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Head back to crew to finish your approvals.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center">
            <p className="text-base text-zinc-700">
              No drafts available yet.
            </p>
          </div>
        )}
      </section>

      <section
        aria-labelledby="primary-action-heading"
        className="flex flex-col gap-3 border-t border-zinc-200 pt-8"
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
        ) : state === "ready_for_review" ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-6 py-3 text-base font-medium text-white transition hover:bg-zinc-800"
              data-project-id={projectId}
              data-action="approve_all"
            >
              Approve all drafts
            </button>
            <p className="text-xs text-zinc-500">
              Approval queues the drafts for sending. Sending itself is held
              until Saga&apos;s A2P approval and Twilio kill switch are lifted.
            </p>
          </div>
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
