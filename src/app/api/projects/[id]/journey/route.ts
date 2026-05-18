/**
 * GET /api/projects/[id]/journey
 *
 * Returns the journey state for a project. Creates an `intake` row if none
 * exists yet, so callers can rely on a non-null response when the projectId
 * is valid AND the session owns the project.
 *
 * Thin wrapper around `src/lib/journey/service.ts` — keep route handlers
 * framework-only and let the service hold the business logic, per the
 * portability constraints in CLAUDE.md.
 *
 * Auth: WebSession-bound. The cookie session must own the project (link via
 * WebSession.projectId set during `upsertProjectFromBrief`). Returns 401
 * for no session and 403 when the session doesn't own this project.
 */

import type { NextRequest } from "next/server";
import { getOrCreateJourney } from "@/lib/journey/service";
import { jsonForAuthFailure, requireProjectOwnership } from "@/lib/projectAuth";
import { getDb } from "@/sms-engine/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;

  const auth = await requireProjectOwnership(request, projectId);
  if (!auth.ok) {
    return jsonForAuthFailure(auth);
  }

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
