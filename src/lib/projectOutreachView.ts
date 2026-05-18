/**
 * Server-side loader for /projects/[slug]/outreach.
 *
 * Loads project snapshot + journey + outreach drafts (OutboundDraft rows
 * with type=CANDIDATE_OUTREACH joined to candidate + role). Pure data
 * shaping — the page component renders the result.
 *
 * Returns null when the slug isn't a Prisma Project id or no Project
 * exists. The page falls through to notFound() in that case (legacy
 * fixture slugs don't get a tracer-flow outreach view).
 *
 * Reads journey from ProjectJourney. Does NOT auto-advance — outreach
 * approval is an explicit user action that advances
 * outreach_prep → outreach_awaiting_send via outreachApproval.ts.
 *
 * Honesty contract: outreachStatus in the view type is pinned to
 * "not_prepared" | "draft" | "approved_to_send" | "sent". The "sent"
 * value is structurally unreachable today (Twilio kill switch + A2P
 * gate), but the renderer must handle it without disclaimers.
 */

import { getDb } from "@/sms-engine/db";
import { getOrCreateJourney } from "@/lib/journey/service";
import { looksLikeProjectId } from "@/lib/projectBriefView";
import type { ProjectJourney } from "@/lib/journey/types";

export type OutreachStatusForUI =
  | "not_prepared"
  | "draft"
  | "approved_to_send"
  | "sent";

export type OutreachDraftPresentation = {
  id: string;
  candidateName: string;
  role: string;
  body: string;
  /** Type-pinned status. "sent" is structurally unreachable today. */
  outreachStatus: OutreachStatusForUI;
  /** Why this person was matched — sourced from CandidateRecommendation. */
  matchRationale: string;
  /** True when the draft was flagged by the producer safety gate. */
  blocked: boolean;
  blockReason: string | null;
};

export type OutreachViewState =
  | "before_outreach_prep"
  | "preparing"
  | "ready_for_review"
  | "approved"
  | "awaiting_send"
  | "empty";

export type OutreachViewData = {
  projectId: string;
  briefSnapshot: {
    title: string;
    facts: Array<{ label: string; value: string }>;
  };
  drafts: OutreachDraftPresentation[];
  state: OutreachViewState;
  journey: ProjectJourney;
  editCrewHref: string;
  /**
   * Honest summary line for the page header. Never says "sent" or
   * "contacted" since we haven't done either.
   */
  honestyDisclaimer: string;
};

// Project-row select shape we want for both the brief snapshot and the
// drafts join. Keeping it inline so changes here don't ripple.
const PROJECT_FIELDS = {
  id: true,
  title: true,
  city: true,
  targetDate: true,
  budgetRange: true,
  audience: true,
  fandoms: true,
} as const;

function briefFacts(project: {
  city: string | null;
  targetDate: string | null;
  budgetRange: string | null;
  audience: string | null;
  fandoms: string[];
}) {
  const facts: Array<{ label: string; value: string }> = [];
  if (project.city) facts.push({ label: "Where", value: project.city });
  if (project.targetDate) facts.push({ label: "When", value: project.targetDate });
  if (project.budgetRange) facts.push({ label: "Budget", value: project.budgetRange });
  if (project.audience) facts.push({ label: "For", value: project.audience });
  if (project.fandoms.length > 0) {
    facts.push({ label: "References", value: project.fandoms.slice(0, 3).join(", ") });
  }
  return facts;
}

function deriveOutreachStatus(
  status: string,
  sentAt: Date | null,
): OutreachStatusForUI {
  if (sentAt) return "sent";
  switch (status) {
    case "APPROVED":
      return "approved_to_send";
    case "DRAFT":
    case "NEEDS_REVIEW":
      return "draft";
    case "SENT":
      // Defensive: if the row's status is SENT but sentAt is null,
      // honour the explicit status. Shouldn't happen — Outreach send
      // is currently unreachable — but we never lie either direction.
      return "sent";
    case "REJECTED":
    case "BLOCKED":
    default:
      return "not_prepared";
  }
}

/**
 * Compute the page-level state from the journey step + draft set.
 *
 * Decoupled from `journey.primaryAction` because the primary action is
 * derived purely from the journey step and doesn't know whether drafts
 * actually exist yet. The view state captures the additional
 * "preparing" condition: journey says outreach_prep but generator hasn't
 * produced drafts yet.
 */
function deriveViewState(
  journey: ProjectJourney,
  drafts: OutreachDraftPresentation[],
): OutreachViewState {
  if (journey.step === "intake" || journey.step === "brief_ready" || journey.step === "crew_reviewing") {
    return "before_outreach_prep";
  }
  if (journey.step === "outreach_prep") {
    if (drafts.length === 0) return "preparing";
    return "ready_for_review";
  }
  if (journey.step === "outreach_awaiting_send") {
    if (drafts.length === 0) return "empty";
    return "awaiting_send";
  }
  if (journey.step === "outreach_sent") {
    return "approved";
  }
  // archived / unknown — treat as empty so the page never crashes.
  return "empty";
}

export async function loadOutreachView(
  projectId: string,
): Promise<OutreachViewData | null> {
  if (!looksLikeProjectId(projectId)) {
    return null;
  }

  const db = getDb();

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: PROJECT_FIELDS,
  });
  if (!project) return null;

  const journey = await getOrCreateJourney(projectId);

  const draftRows = await db.outboundDraft.findMany({
    where: {
      projectId,
      type: "CANDIDATE_OUTREACH",
    },
    select: {
      id: true,
      body: true,
      editedBody: true,
      status: true,
      sentAt: true,
      blockReason: true,
      candidateRecommendation: {
        select: {
          id: true,
          matchingReasons: true,
          person: {
            select: {
              name: true,
              creatorProfile: { select: { displayName: true } },
            },
          },
          opportunity: {
            select: {
              roleOpening: { select: { title: true } },
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const drafts: OutreachDraftPresentation[] = draftRows.map((row) => {
    const candidate = row.candidateRecommendation;
    const profile = candidate?.person?.creatorProfile;
    const name = profile?.displayName || candidate?.person?.name || "Candidate";
    const role = candidate?.opportunity?.roleOpening?.title || "Crew";
    const matchRationale =
      (candidate?.matchingReasons || []).find(Boolean) ||
      "Producer agent matched this candidate to the brief.";
    return {
      id: row.id,
      candidateName: name,
      role,
      body: row.editedBody || row.body,
      outreachStatus: deriveOutreachStatus(row.status as string, row.sentAt),
      matchRationale,
      blocked: row.status === "BLOCKED",
      blockReason: row.blockReason,
    };
  });

  const state = deriveViewState(journey, drafts);

  return {
    projectId,
    briefSnapshot: {
      title: project.title || "Your project",
      facts: briefFacts(project),
    },
    drafts,
    state,
    journey,
    editCrewHref: `/projects/${projectId}/crew`,
    honestyDisclaimer:
      "Nothing has been sent. Saga prepares the messages; a human approves and a human delivers.",
  };
}
