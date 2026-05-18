/**
 * /projects/[slug]/crew — Build my Crew (tracer).
 *
 * Server-side: load project + journey + roles + candidate counts. Auto-advance
 * journey from brief_ready → crew_reviewing on first visit. Render
 * BuildMyCrewView with the loaded data.
 *
 * Returns notFound() when the slug doesn't resolve to a Project — and now
 * also when `loadCrewView` throws (e.g. DB unreachable). Mirrors the
 * defensive pattern PR #35 added to /projects/[slug]; closes the rest of
 * Cowork's P1 finding about blank chrome on env-misconfig.
 */

import { notFound } from "next/navigation";
import { BuildMyCrewView } from "@/components/projects/BuildMyCrewView";
import { loadCrewView, type CrewViewData } from "@/lib/projectCrewView";
import { logServerError } from "@/sms-engine/safeLogging";

export const dynamic = "force-dynamic";

export default async function ProjectCrewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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
  return <BuildMyCrewView data={data} />;
}
