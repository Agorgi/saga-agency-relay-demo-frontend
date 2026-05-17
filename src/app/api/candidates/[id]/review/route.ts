/**
 * POST /api/candidates/[id]/review
 * Body: { action: "approve" | "pass" | "request_info" }
 *
 * Updates CandidateRecommendation.status and, on approve, maybe advances the
 * project journey from crew_reviewing → outreach_prep if every core role now
 * has at least one approved candidate.
 *
 * Returns { candidateId, newStatus, journeyAdvanced } on success.
 *
 * TODO(auth): no per-user authorization yet. Don't surface this to anonymous
 * clients in production until session-bound auth is wired (see CLAUDE.md
 * portability notes + the journey routes' TODO(auth)).
 */

import {
  candidateReviewActionSchema,
  reviewCandidate,
} from "@/lib/candidateReview";
import { logServerError } from "@/sms-engine/safeLogging";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: candidateId } = await params;

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const body = parsedBody as { action?: unknown };
  const action = candidateReviewActionSchema.safeParse(body?.action);
  if (!action.success) {
    return Response.json(
      {
        error: "invalid_action",
        message: "Body must be { action: 'approve' | 'pass' | 'request_info' }.",
        details: action.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const result = await reviewCandidate({
      candidateId,
      action: action.data,
    });
    if (!result) {
      return Response.json({ error: "candidate_not_found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (error) {
    logServerError("POST /api/candidates/[id]/review", error);
    const message = error instanceof Error ? error.message : "unknown";
    return Response.json({ error: "internal_error", message }, { status: 500 });
  }
}
