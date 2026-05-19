/**
 * /projects/[slug]/crew — Build my Crew (tracer).
 *
 * Server-side: load project + journey + roles + candidate counts. Auto-advance
 * journey from brief_ready → crew_reviewing on first visit. Render
 * BuildMyCrewView with the loaded data.
 *
 * Auth: read-side session ownership check (PR #48). Only the
 * cookie session that created the Project can view its crew.
 * Other sessions see notFound() — same UX as a stale cuid.
 *
 * Returns notFound() when the slug doesn't resolve to a Project,
 * when the session doesn't own it, or when `loadCrewView` throws.
 * Mirrors the defensive pattern PR #35 added to /projects/[slug].
 */

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { BuildMyCrewView } from "@/components/projects/BuildMyCrewView";
import { SagaShell } from "@/components/saga/SagaShell";
import { loadCrewView, type CrewViewData } from "@/lib/projectCrewView";
import { sessionOwnsProject } from "@/lib/projectAuth";
import { WEB_SESSION_COOKIE_NAME } from "@/lib/webChatSessionStore";
import { logServerError } from "@/sms-engine/safeLogging";

export const dynamic = "force-dynamic";

export default async function ProjectCrewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(WEB_SESSION_COOKIE_NAME)?.value;
  if (!(await sessionOwnsProject(sessionId, slug))) {
    notFound();
  }

  let data: CrewViewData | null = null;
  try {
    data = await loadCrewView(slug);
  } catch (error) {
    // DB unreachable / Prisma throw — surface as 404 rather than
    // letting the error escape to a blank screen.
    logServerError("loadCrewView", error);
    data = null;
  }

  if (!data) {
    notFound();
  }
  return (
    <SagaShell state="CREW">
      <BuildMyCrewView data={data} />
    </SagaShell>
  );
}
