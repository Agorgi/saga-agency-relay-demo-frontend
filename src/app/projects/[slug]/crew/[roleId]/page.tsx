/**
 * /projects/[slug]/crew/[roleId] — candidate review per role.
 *
 * Server-side: load role + candidates + project journey. Render
 * CandidateReviewView with the loaded data. Returns notFound() when the
 * (slug, roleId) pair doesn't resolve.
 */

import { notFound } from "next/navigation";
import { CandidateReviewView } from "@/components/projects/CandidateReviewView";
import { loadCandidateReview } from "@/lib/projectCandidateView";

export const dynamic = "force-dynamic";

export default async function ProjectCandidateReviewPage({
  params,
}: {
  params: Promise<{ slug: string; roleId: string }>;
}) {
  const { slug, roleId } = await params;
  const data = await loadCandidateReview({ projectId: slug, roleId });
  if (!data) {
    notFound();
  }
  return <CandidateReviewView data={data} />;
}
