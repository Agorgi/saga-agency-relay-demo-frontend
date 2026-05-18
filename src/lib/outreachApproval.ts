/**
 * Outreach approval action — approve drafts for sending.
 *
 * Framework-agnostic. Marks every OutboundDraft for a project as APPROVED
 * (from NEEDS_REVIEW or DRAFT) and advances the project journey from
 * outreach_prep → outreach_awaiting_send.
 *
 * Approval does NOT send. The next step (sending) is intentionally
 * unreachable today: blocked by TWILIO_API_CALLS_FORBIDDEN and unmet
 * A2P approval. The journey's primaryAction at outreach_awaiting_send
 * is already disabled with a blockedReason for that — pages render
 * it verbatim.
 *
 * Idempotent: re-approving when already at outreach_awaiting_send is a
 * no-op (returns { approvedCount: 0, journeyAdvanced: false }).
 */

import { z } from "zod";
import { getDb } from "@/sms-engine/db";
import {
  advanceJourney,
  getOrCreateJourney,
} from "@/lib/journey/service";
import { JourneyTransitionError } from "@/lib/journey/types";
import { logServerError } from "@/sms-engine/safeLogging";

export const outreachApprovalActionSchema = z.enum(["approve_all"]);
export type OutreachApprovalAction = z.infer<typeof outreachApprovalActionSchema>;

export type OutreachApprovalResult = {
  projectId: string;
  approvedCount: number;
  journeyAdvanced: boolean;
};

const APPROVABLE_STATUSES = ["DRAFT", "NEEDS_REVIEW"] as const;

async function markDraftsApproved(projectId: string): Promise<number> {
  const result = await getDb().outboundDraft.updateMany({
    where: {
      projectId,
      type: "CANDIDATE_OUTREACH",
      status: { in: Array.from(APPROVABLE_STATUSES) },
    },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy: "user",
    },
  });
  return result.count;
}

export async function approveProjectOutreach({
  projectId,
  action,
}: {
  projectId: string;
  action: OutreachApprovalAction;
}): Promise<OutreachApprovalResult | null> {
  // Validate the project exists. Without this guard a caller can probe
  // arbitrary cuids — the API route already does string validation, but
  // the lib enforces the data shape too.
  const project = await getDb().project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return null;

  const journey = await getOrCreateJourney(projectId);

  // Only act when the project is in the outreach_prep step. If a caller
  // hits the API at outreach_awaiting_send already, the action is a
  // no-op (idempotent re-approval).
  if (journey.step !== "outreach_prep") {
    return {
      projectId,
      approvedCount: 0,
      journeyAdvanced: false,
    };
  }

  // Action is currently always approve_all; the enum is one value so
  // the switch is degenerate, but leaving the shape in place keeps the
  // API extensible (e.g. "approve_one" with a draftId).
  let approvedCount = 0;
  if (action === "approve_all") {
    approvedCount = await markDraftsApproved(projectId);
  }

  try {
    await advanceJourney(projectId, "approve_outreach");
  } catch (error) {
    if (!(error instanceof JourneyTransitionError)) {
      logServerError("approveProjectOutreach: advanceJourney", error);
      throw error;
    }
    return { projectId, approvedCount, journeyAdvanced: false };
  }

  return { projectId, approvedCount, journeyAdvanced: true };
}
