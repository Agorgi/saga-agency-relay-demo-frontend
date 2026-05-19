/**
 * /projects/[slug]/crew/[roleId] — candidate review per role.
 *
 * Server-side: load role + candidates + project journey. Render
 * CandidateReviewView with the loaded data.
 *
 * Auth: read-side session ownership check (PR #48). Only the
 * cookie session that created the Project can view its candidates.
 * Other sessions see notFound().
 *
 * Returns notFound() when the (slug, roleId) pair doesn't resolve,
 * when the session doesn't own the project, or when
 * `loadCandidateReview` throws.
 */

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CandidateReviewView } from "@/components/projects/CandidateReviewView";
import { SagaShell } from "@/components/saga/SagaShell";
import {
  loadCandidateReview,
  type CandidateReviewData,
} from "@/lib/projectCandidateView";
import { sessionOwnsProject } from "@/lib/projectAuth";
import { WEB_SESSION_COOKIE_NAME } from "@/lib/webChatSessionStore";
import { logServerError } from "@/sms-engine/safeLogging";

export const dynamic = "force-dynamic";

export default async function ProjectCandidateReviewPage({
  params,
}: {
  params: Promise<{ slug: string; roleId: string }>;
}) {
  const { slug, roleId } = await params;

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(WEB_SESSION_COOKIE_NAME)?.value;
  if (!(await sessionOwnsProject(sessionId, slug))) {
    notFound();
  }

  let data: CandidateReviewData | null = null;
  try {
    data = await loadCandidateReview({ projectId: slug, roleId });
  } catch (error) {
    logServerError("loadCandidateReview", error);
    data = null;
  }

  if (!data) {
    notFound();
  }
  return (
    <SagaShell state="CANDIDATES">
      <CandidateReviewView data={data} />
    </SagaShell>
  );
}
