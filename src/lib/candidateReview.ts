/**
 * Candidate review actions — approve / pass / request_info.
 *
 * Framework-agnostic. The action mutates CandidateRecommendation.status and
 * may advance the project journey from crew_reviewing → outreach_prep when
 * every visible role has at least one approved candidate.
 *
 * Approval is the gate to outreach_prep — there is no separate "prepare
 * outreach" button. The product principle: once you've okayed someone for
 * every role, drafts kick off in the background, but nothing is sent until
 * the user reviews the outreach page (a future surface).
 */

import { z } from "zod";
import { getDb } from "@/sms-engine/db";
import {
  advanceJourney,
  getOrCreateJourney,
} from "@/lib/journey/service";
import { JourneyTransitionError } from "@/lib/journey/types";
import { logServerError } from "@/sms-engine/safeLogging";

export const candidateReviewActionSchema = z.enum([
  "approve",
  "pass",
  "request_info",
]);

export type CandidateReviewAction = z.infer<typeof candidateReviewActionSchema>;

export type CandidateReviewResult = {
  candidateId: string;
  newStatus: string;
  journeyAdvanced: boolean;
};

const APPROVED_STATUS = "APPROVED_FOR_SHORTLIST";
const PASSED_STATUS = "REJECTED";
const NEEDS_INFO_STATUS = "NEEDS_MORE_INFO";

const APPROVED_DB_STATUSES = new Set([
  "APPROVED",
  "APPROVED_FOR_SHORTLIST",
  "SHORTLISTED",
]);

// Until the producer agent emits priority signals, treat every user-visible
// role as core for the "all roles approved → outreach_prep" check.
const CORE_ROLE_STATUSES = new Set(["OPEN", "RECOMMENDING", "OUTREACHING"]);

function statusForAction(action: CandidateReviewAction): string {
  switch (action) {
    case "approve":
      return APPROVED_STATUS;
    case "pass":
      return PASSED_STATUS;
    case "request_info":
      return NEEDS_INFO_STATUS;
  }
}

async function allCoreRolesHaveApproved(projectId: string): Promise<boolean> {
  const db = getDb();
  const roles = await db.roleOpening.findMany({
    where: {
      projectId,
      status: { in: Array.from(CORE_ROLE_STATUSES) as ("OPEN" | "RECOMMENDING" | "OUTREACHING")[] },
    },
    select: {
      id: true,
      opportunities: {
        select: {
          recommendations: { select: { status: true } },
        },
      },
    },
  });

  if (roles.length === 0) return false;

  return roles.every((role) =>
    role.opportunities
      .flatMap((opp) => opp.recommendations)
      .some((rec) => APPROVED_DB_STATUSES.has(rec.status as string)),
  );
}

async function maybeAdvanceToOutreachPrep(projectId: string): Promise<boolean> {
  const journey = await getOrCreateJourney(projectId);
  if (journey.step !== "crew_reviewing") return false;
  const ready = await allCoreRolesHaveApproved(projectId);
  if (!ready) return false;
  try {
    await advanceJourney(projectId, "approve_candidates");
    return true;
  } catch (error) {
    if (!(error instanceof JourneyTransitionError)) {
      logServerError("maybeAdvanceToOutreachPrep", error);
      throw error;
    }
    return false;
  }
}

export async function reviewCandidate({
  candidateId,
  action,
}: {
  candidateId: string;
  action: CandidateReviewAction;
}): Promise<CandidateReviewResult | null> {
  const db = getDb();

  const candidate = await db.candidateRecommendation.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      opportunity: {
        select: { roleOpening: { select: { projectId: true } } },
      },
    },
  });
  if (!candidate) return null;

  const projectId = candidate.opportunity.roleOpening.projectId;
  const newStatus = statusForAction(action);

  await db.candidateRecommendation.update({
    where: { id: candidateId },
    data: {
      status: newStatus as "APPROVED_FOR_SHORTLIST" | "REJECTED" | "NEEDS_MORE_INFO",
      reviewedAt: new Date(),
    },
  });

  const journeyAdvanced =
    action === "approve" ? await maybeAdvanceToOutreachPrep(projectId) : false;

  return { candidateId, newStatus, journeyAdvanced };
}
