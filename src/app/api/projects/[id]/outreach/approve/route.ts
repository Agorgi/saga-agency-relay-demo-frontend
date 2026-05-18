/**
 * POST /api/projects/[id]/outreach/approve
 * Body: { action: "approve_all" }
 *
 * Marks every CANDIDATE_OUTREACH OutboundDraft for the project as
 * APPROVED and advances the journey from outreach_prep →
 * outreach_awaiting_send. Approval does NOT send — sending is held by
 * TWILIO_API_CALLS_FORBIDDEN + A2P approval.
 *
 * Returns { projectId, approvedCount, journeyAdvanced } on success.
 *
 * TODO(auth): no per-user authorization yet. Don't surface this to
 * anonymous clients in production until session-bound auth is wired
 * (see CLAUDE.md portability notes + the journey routes' TODO(auth)
 * and the candidate review route's TODO(auth)).
 */

import {
  approveProjectOutreach,
  outreachApprovalActionSchema,
} from "@/lib/outreachApproval";
import { logServerError } from "@/sms-engine/safeLogging";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const body = parsedBody as { action?: unknown };
  const action = outreachApprovalActionSchema.safeParse(body?.action);
  if (!action.success) {
    return Response.json(
      {
        error: "invalid_action",
        message: "Body must be { action: 'approve_all' }.",
        details: action.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const result = await approveProjectOutreach({
      projectId,
      action: action.data,
    });
    if (!result) {
      return Response.json({ error: "project_not_found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (error) {
    logServerError("POST /api/projects/[id]/outreach/approve", error);
    const message = error instanceof Error ? error.message : "unknown";
    return Response.json({ error: "internal_error", message }, { status: 500 });
  }
}
