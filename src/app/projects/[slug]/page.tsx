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
  }

  return (
    <AppFrame>
      <div className="absolute inset-0">
        <ProjectWorkspaceView projectSlug={slug} />
      </div>
    </AppFrame>
  );
}
