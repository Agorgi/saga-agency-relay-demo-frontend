/**
 * /projects/[slug]/crew/[roleId] — candidate review per role.
 *
 * Server-side: load role + candidates + project journey. Render
 * CandidateReviewView with the loaded data. Returns notFound() when the
 * (slug, roleId) pair doesn't resolve OR when `loadCandidateReview`
 * throws (e.g. DB unreachable). Mirrors the defensive pattern PR #35
 * added to /projects/[slug].
 */

import { notFound } from "next/navigation";
import { CandidateReviewView } from "@/components/projects/CandidateReviewView";
import {
  loadCandidateReview,
  type CandidateReviewData,
} from "@/lib/projectCandidateView";
import { logServerError } from "@/sms-engine/safeLogging";

export const dynamic = "force-dynamic";

export default async function ProjectCandidateReviewPage({
  params,
}: {
  params: Promise<{ slug: string; roleId: string }>;
}) {
  const { slug, roleId } = await params;

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
  return <CandidateReviewView data={data} />;
}
