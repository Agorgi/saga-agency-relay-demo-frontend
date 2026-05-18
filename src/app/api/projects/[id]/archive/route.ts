/**
 * POST /api/projects/[id]/archive
 *
 * Marks the Project's journey as archived and unbinds any WebSession
 * currently pointing at it (so the user's next chat turn starts a
 * fresh brief instead of mutating the archived row). Thin wrapper
 * around `archiveProject` in src/lib/projectArchive.ts.
 *
 * Auth: WebSession-bound. Cookie session must own the project. Same
 * `requireProjectOwnership` contract as the rest of the tracer
 * mutation endpoints.
 *
 * Responses:
 *   200 { journey, sessionsUnbound } — archived successfully
 *   401 { error: "no_session" } — no session cookie
 *   403 { error: "not_project_owner" } — session doesn't own project
 *   404 { error: "project_not_found" } — project id doesn't resolve
 *   409 { error: "already_archived" } — journey already at archived step
 */

import type { NextRequest } from "next/server";
import { archiveProject } from "@/lib/projectArchive";
import { jsonForAuthFailure, requireProjectOwnership } from "@/lib/projectAuth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;

  const auth = await requireProjectOwnership(request, projectId);
  if (!auth.ok) {
    return jsonForAuthFailure(auth);
  }

  const result = await archiveProject(projectId);
  if (!result.ok) {
    const status = result.reason === "already_archived" ? 409 : 404;
    return Response.json({ error: result.reason }, { status });
  }

  return Response.json({
    journey: result.journey,
    sessionsUnbound: result.sessionsUnbound,
  });
}
