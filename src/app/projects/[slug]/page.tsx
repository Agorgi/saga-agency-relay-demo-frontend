import { notFound } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { ProjectWorkspaceView } from "@/components/ProjectWorkspaceView";
import { BriefReviewView } from "@/components/projects/BriefReviewView";
import { loadBriefReview, looksLikeProjectId } from "@/lib/projectBriefView";

export const dynamic = "force-dynamic";

/**
 * /projects/[slug]
 *
 * Two routes share this URL:
 * - When `slug` is a Prisma Project id (cuid), render the brief review page
 *   (BriefReviewView) backed by the real Project + ProjectJourney rows.
 *   If the cuid doesn't resolve to a Project, return notFound() — a
 *   stale link is honestly broken, not rendered as empty chrome.
 * - Otherwise, fall back to the legacy fixture-based ProjectWorkspaceView
 *   that powers local-data demos. Existing internal links keep working.
 *
 * The cuid check (looksLikeProjectId) saves a DB round trip for legacy slugs.
 */
export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (looksLikeProjectId(slug)) {
    const briefReview = await loadBriefReview(slug);
    if (briefReview) {
      return <BriefReviewView data={briefReview} />;
    }
    // Cuid-shaped slug that doesn't resolve to a Project row. This
    // was the second Cowork P2 finding on PR #33 / PR #34 — the page
    // used to render blank chrome here. Honest 404 is the right move:
    // a stale or malformed cuid link should look broken, not look
    // half-loaded.
    notFound();
  }

  return (
    <AppFrame>
      <div className="absolute inset-0">
        <ProjectWorkspaceView projectSlug={slug} />
      </div>
    </AppFrame>
  );
}
