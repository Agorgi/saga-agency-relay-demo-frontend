/**
 * GET /api/projects/[id]/journey
 *
 * Returns the journey state for a project. Creates an `intake` row if none
 * exists yet, so callers can rely on a non-null response when the projectId
 * is valid.
 *
 * Thin wrapper around `src/lib/journey/service.ts` — keep route handlers
 * framework-only and let the service hold the business logic, per the
 * portability constraints in CLAUDE.md.
 *
 * TODO(auth): cuid project IDs are unguessable in practice, but this route
 * has no per-user authorization yet. Add session-bound auth when web chat
 * sessions are tied to project ownership (PR #4 territory).
 */

import { getOrCreateJourney } from "@/lib/journey/service";
import { getDb } from "@/sms-engine/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;

  try {
    const project = await getDb().project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return Response.json({ error: "project_not_found" }, { status: 404 });
    }

    const journey = await getOrCreateJourney(projectId);
    return Response.json({ journey });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return Response.json({ error: "internal_error", message }, { status: 500 });
  }
}
