/**
 * POST /api/projects/[id]/journey/advance
 * Body: { intent: AdvanceIntent }
 *
 * Validates the requested transition against `JOURNEY_TRANSITIONS` in
 * src/lib/journey/types.ts. Returns the updated journey on success, or 422
 * with the disallowed-transition reason on failure.
 *
 * Thin wrapper around `advanceJourney` in src/lib/journey/service.ts.
 *
 * TODO(auth): see the GET route — no per-user authorization yet. Don't surface
 * this endpoint to anonymous clients until session-bound auth is wired.
 */

import { advanceJourney } from "@/lib/journey/service";
import {
  advanceIntentSchema,
  JourneyTransitionError,
} from "@/lib/journey/types";
import { getDb } from "@/sms-engine/db";

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

  const body = parsedBody as { intent?: unknown };
  const intent = advanceIntentSchema.safeParse(body?.intent);
  if (!intent.success) {
    return Response.json(
      {
        error: "invalid_intent",
        message: "Body must be { intent: AdvanceIntent }.",
        details: intent.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const project = await getDb().project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return Response.json({ error: "project_not_found" }, { status: 404 });
    }

    const journey = await advanceJourney(projectId, intent.data);
    return Response.json({ journey });
  } catch (error) {
    if (error instanceof JourneyTransitionError) {
      return Response.json(
        {
          error: "invalid_transition",
          from: error.from,
          intent: error.intent,
          message: error.reason,
        },
        { status: 422 },
      );
    }
    const message = error instanceof Error ? error.message : "unknown";
    return Response.json({ error: "internal_error", message }, { status: 500 });
  }
}
