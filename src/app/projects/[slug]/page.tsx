import { notFound } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { ProjectWorkspaceView } from "@/components/ProjectWorkspaceView";
import { BriefReviewView } from "@/components/projects/BriefReviewView";
import { getProjectBySlug } from "@/data/sagaAgencyData";
import { loadBriefReview, looksLikeProjectId } from "@/lib/projectBriefView";
import { logServerError } from "@/sms-engine/safeLogging";

export const dynamic = "force-dynamic";

/**
 * /projects/[slug]
 *
 * Two routes share this URL:
 * - When `slug` is a Prisma Project id (cuid), render the brief review page
 *   (BriefReviewView) backed by the real Project + ProjectJourney rows.
 *   If the cuid doesn't resolve to a Project — OR if the DB lookup
 *   throws (e.g. preview env without DATABASE_URL) — return notFound()
 *   so the user sees the honest "Project not found" page rather than
 *   blank chrome.
 * - Otherwise (non-cuid slug): look up the legacy fixture project. If
 *   no fixture matches the slug, also notFound(). Only when a real
 *   fixture exists do we render ProjectWorkspaceView. This closes the
 *   "blank chrome on bogus slug" Cowork finding from PR #33 / #34 QA.
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
    let briefReview: Awaited<ReturnType<typeof loadBriefReview>> | null = null;
    try {
      briefReview = await loadBriefReview(slug);
    } catch (error) {
      // DB unreachable, Prisma error, env misconfig (Cowork's P1
      // finding from the PR #34 re-test). Fall through to
      // notFound() rather than letting the error escape to a blank
      // screen.
      logServerError("loadBriefReview", error);
      briefReview = null;
    }
    if (briefReview) {
      return <BriefReviewView data={briefReview} />;
    }
    notFound();
  }

  // Non-cuid slug: must match a fixture project, otherwise 404. Before
  // this guard the page rendered empty ProjectWorkspaceView chrome
  // for any unrecognised slug.
  const fixture = getProjectBySlug(slug);
  if (!fixture) {
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
