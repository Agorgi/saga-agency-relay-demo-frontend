import Link from "next/link";
import { AlertTriangle, CheckCircle2, Save, ShieldCheck } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  approveOutboundDraftAction,
  editOutboundDraftAction,
  evaluateOutboundDraftSendReadinessAction,
  rejectOutboundDraftAction,
} from "@/app/admin/(dashboard)/actions";
import { getDb } from "@/lib/db";
import { briefTitle } from "@/lib/workflow";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const labelClass = "block text-sm font-medium text-zinc-300";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

function projectPath(projectBriefId: string | null) {
  return projectBriefId ? `/admin/projects/${projectBriefId}` : "/admin/outbound-drafts";
}

function objectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readinessMetadata(value: unknown) {
  const metadata = objectRecord(value);
  const check = objectRecord(metadata.lastReadinessCheck);
  const safety = objectRecord(check.safetySnapshot);
  const recipient = objectRecord(check.recipientSummary);
  const status =
    typeof check.readinessStatus === "string" ? check.readinessStatus : null;

  if (!status) return null;

  return {
    status,
    eligible: check.eligible === true,
    dryRunOnly: check.dryRunOnly === true,
    blockers: stringList(check.blockers),
    warnings: stringList(check.warnings),
    requiredActions: stringList(check.requiredActions),
    providerMode: typeof safety.providerMode === "string" ? safety.providerMode : null,
    sendsDisabled: safety.sendsDisabled === true,
    allowlistRequired: safety.allowlistRequired === true,
    allowedNumbersCount:
      typeof safety.allowedNumbersCount === "number"
        ? safety.allowedNumbersCount
        : null,
    recipient:
      typeof recipient.redactedPhone === "string"
        ? recipient.redactedPhone
        : null,
    isAllowlisted: recipient.isAllowlisted === true,
    optedOut: recipient.optedOut === true,
  };
}

export default async function OutboundDraftsPage() {
  const drafts = await getDb().outboundDraft.findMany({
    include: {
      projectBrief: true,
      shortlistPacket: true,
      candidateRecommendation: {
        include: {
          person: { include: { creatorProfile: true } },
          opportunity: { include: { roleOpening: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 200,
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Producer Agent drafts"
        title="Outreach Drafts"
        description="Review-only organizer shortlist and candidate outreach drafts."
        helpText="Approving a draft does not send SMS, create outreach, contact anyone, or create a group chat."
      />
      <section className="space-y-4">
        {drafts.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-black p-4 text-sm text-zinc-500">
            No outreach drafts yet. Approved candidates and shortlist drafts
            will appear here for review.
          </p>
        ) : null}
        {drafts.map((draft) => {
          const projectIdForAction = draft.projectBriefId || "outbound-drafts";
          const editAction = editOutboundDraftAction.bind(
            null,
            projectIdForAction,
            draft.id,
          );
          const approveAction = approveOutboundDraftAction.bind(
            null,
            projectIdForAction,
            draft.id,
          );
          const rejectAction = rejectOutboundDraftAction.bind(
            null,
            projectIdForAction,
            draft.id,
          );
          const evaluateAction = evaluateOutboundDraftSendReadinessAction.bind(
            null,
            projectIdForAction,
            draft.id,
          );
          const readiness = readinessMetadata(draft.metadata);
          const candidateName =
            draft.candidateRecommendation?.person.creatorProfile?.displayName ||
            draft.candidateRecommendation?.person.name ||
            null;

          return (
            <div
              key={draft.id}
              className="rounded-lg border border-zinc-800 bg-black p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">
                    {draft.type.replaceAll("_", " ").toLowerCase()}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {draft.projectBrief ? (
                      <Link
                        href={projectPath(draft.projectBriefId)}
                        className="hover:text-white"
                      >
                        {briefTitle(draft.projectBrief)}
                      </Link>
                    ) : (
                      "No linked legacy brief"
                    )}
                    {candidateName ? ` | ${candidateName}` : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={draft.status} />
                  <StatusBadge status={draft.recipientKind} />
                </div>
              </div>
              {draft.blockReason ? (
                <p className="mt-3 rounded-md border border-amber-400/30 bg-amber-400/10 p-2 text-xs leading-5 text-amber-100">
                  Blocked: {draft.blockReason}
                </p>
              ) : null}
              <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Send readiness</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      Dry run only — evaluating readiness never sends SMS or
                      calls Twilio.
                    </p>
                  </div>
                  {readiness ? <StatusBadge status={readiness.status} /> : null}
                </div>
                {readiness ? (
                  <div className="mt-3 grid gap-3 text-xs leading-5 text-zinc-500 md:grid-cols-2">
                    <p>Eligible: {readiness.eligible ? "yes" : "no"}</p>
                    <p>Recipient: {readiness.recipient || "missing"}</p>
                    <p>Provider: {readiness.providerMode || "unknown"}</p>
                    <p>Sends disabled: {readiness.sendsDisabled ? "true" : "false"}</p>
                    <p>Allowlist required: {readiness.allowlistRequired ? "true" : "false"}</p>
                    <p>Allowed count: {readiness.allowedNumbersCount ?? "unknown"}</p>
                    <p>Allowlisted: {readiness.isAllowlisted ? "true" : "false"}</p>
                    <p>Opted out: {readiness.optedOut ? "true" : "false"}</p>
                    {readiness.blockers.length > 0 ? (
                      <div className="md:col-span-2">
                        <p className="font-medium text-zinc-300">Blockers</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {readiness.blockers.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {readiness.requiredActions.length > 0 ? (
                      <div className="md:col-span-2">
                        <p className="font-medium text-zinc-300">Required actions</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {readiness.requiredActions.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500">
                    No readiness check has been run for this draft yet.
                  </p>
                )}
                <form action={evaluateAction} className="mt-3">
                  <button className={buttonClass}>
                    <ShieldCheck aria-hidden className="h-4 w-4" />
                    Evaluate send readiness
                  </button>
                </form>
              </div>
              <form action={editAction} className="mt-4 space-y-3">
                <label className={labelClass}>
                  Draft body
                  <textarea
                    name="editedBody"
                    rows={5}
                    defaultValue={draft.editedBody || draft.body}
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Admin notes
                  <textarea
                    name="adminNotes"
                    rows={2}
                    defaultValue={draft.adminNotes || ""}
                    className={inputClass}
                    placeholder="Internal notes; never sent"
                  />
                </label>
                <button className={buttonClass}>
                  <Save aria-hidden className="h-4 w-4" />
                  Save draft
                </button>
              </form>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <form action={approveAction}>
                  <button className={buttonClass}>
                    <CheckCircle2 aria-hidden className="h-4 w-4" />
                    Approve draft
                  </button>
                </form>
                <form action={rejectAction}>
                  <button className={buttonClass}>
                    <AlertTriangle aria-hidden className="h-4 w-4" />
                    Reject draft
                  </button>
                </form>
              </div>
            </div>
          );
        })}
        {drafts.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-black p-4 text-sm text-zinc-500">
            No outbound drafts yet. Prepare drafts from a project detail page
            after shortlist packets and candidates have been reviewed.
          </p>
        ) : null}
      </section>
    </div>
  );
}
