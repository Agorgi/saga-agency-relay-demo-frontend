/**
 * Per-user authorization for project-mutating API routes.
 *
 * The Saga web app uses cookie-bound WebSessions, not JWT bearer
 * tokens. Each WebSession is created on the user's first request, has
 * a unique id stored in an httpOnly cookie, and optionally links to a
 * Project once the chat-driven brief upserts it via
 * `upsertProjectFromBrief`. The link is `WebSession.projectId`.
 *
 * "Ownership" for the tracer is straightforward: the session that
 * created the Project owns it. Any other session attempting to mutate
 * the journey, approve candidates, or approve outreach gets 403'd.
 *
 * Returns a discriminated result so callers can branch with full type
 * safety:
 *   { ok: true, sessionId }   — request authorized
 *   { ok: false, status, error } — return Response.json(...) directly
 *
 * This is the canonical auth check for /api/projects/[id]/* and
 * /api/candidates/[id]/* writes. Read endpoints (GET) currently use
 * the same check so listing journey state is also session-bound — if
 * we later need public read for sharing flows we can split the helper
 * into read/write variants.
 */

import type { NextRequest } from "next/server";
import { getDb } from "@/sms-engine/db";
import { getExistingSession } from "@/lib/webChatSessionStore";

export type ProjectAuthFail = {
  ok: false;
  status: 401 | 403 | 404;
  error: "no_session" | "not_project_owner" | "candidate_not_found";
};

export type ProjectAuthOk = {
  ok: true;
  sessionId: string;
};

export type ProjectAuthResult = ProjectAuthOk | ProjectAuthFail;

export type CandidateAuthOk = {
  ok: true;
  sessionId: string;
  projectId: string;
};

export type CandidateAuthResult = CandidateAuthOk | ProjectAuthFail;

/**
 * Verify the request's WebSession owns the requested project.
 *
 * Used by /api/projects/[id]/journey (GET), /journey/advance (POST),
 * /outreach/approve (POST), and any other route whose URL identifies
 * a project directly.
 */
export async function requireProjectOwnership(
  req: NextRequest,
  projectId: string,
): Promise<ProjectAuthResult> {
  const session = await getExistingSession(req);
  if (!session) {
    return { ok: false, status: 401, error: "no_session" };
  }
  if (session.projectId !== projectId) {
    return { ok: false, status: 403, error: "not_project_owner" };
  }
  return { ok: true, sessionId: session.id };
}

/**
 * Verify the request's WebSession owns the project a CandidateRecommendation
 * belongs to.
 *
 * Used by /api/candidates/[id]/review. The candidate doesn't expose its
 * project in the URL, so we look it up via
 * candidate → opportunity → roleOpening → projectId.
 *
 * Returns 404 when the candidate doesn't exist so the caller can return
 * the same 404 it would have returned for a missing-row case anyway.
 */
export async function requireCandidateOwnership(
  req: NextRequest,
  candidateId: string,
): Promise<CandidateAuthResult> {
  const session = await getExistingSession(req);
  if (!session) {
    return { ok: false, status: 401, error: "no_session" };
  }

  const candidate = await getDb().candidateRecommendation.findUnique({
    where: { id: candidateId },
    select: {
      opportunity: {
        select: { roleOpening: { select: { projectId: true } } },
      },
    },
  });
  if (!candidate) {
    return { ok: false, status: 404, error: "candidate_not_found" };
  }

  const projectId = candidate.opportunity.roleOpening.projectId;
  if (session.projectId !== projectId) {
    return { ok: false, status: 403, error: "not_project_owner" };
  }

  return { ok: true, sessionId: session.id, projectId };
}

/**
 * Convenience: build a Response.json(...) for a failed auth check.
 * Lets route handlers do `if (!auth.ok) return jsonForAuthFailure(auth);`.
 */
export function jsonForAuthFailure(failure: ProjectAuthFail): Response {
  return Response.json({ error: failure.error }, { status: failure.status });
}

/**
 * Check whether a given WebSession id owns the requested project.
 *
 * Pure-data variant of `requireProjectOwnership` — takes the session
 * id directly instead of a NextRequest, so server components can use
 * it after reading the session cookie via `next/headers`.
 *
 * Returns:
 * - true: the session exists and `session.projectId === projectId`
 * - false: no session, missing session row, OR session owns a
 *   different project. Caller decides whether that means notFound()
 *   (page handlers) or 401/403 (API routes).
 *
 * Defensive: any database error is treated as "not authorized" so
 * misconfigured deploys can't accidentally bypass the check.
 */
export async function sessionOwnsProject(
  sessionId: string | null | undefined,
  projectId: string,
): Promise<boolean> {
  if (!sessionId) {
    return false;
  }
  try {
    const session = await getDb().webSession.findUnique({
      where: { id: sessionId },
      select: { projectId: true },
    });
    return session?.projectId === projectId;
  } catch {
    return false;
  }
}
