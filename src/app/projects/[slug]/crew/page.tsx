/**
 * /projects/[slug]/crew — Build my Crew (tracer).
 *
 * Server-side: load project + journey + roles + candidate counts. Auto-advance
 * journey from brief_ready → crew_reviewing on first visit. Render
 * BuildMyCrewView with the loaded data.
 *
 * Returns notFound() when the slug doesn't resolve to a Project — keeps the
 * legacy fixture browsing (/projects/[slug]) from spilling into the tracer
 * URL space.
 */

import { notFound } from "next/navigation";
import { BuildMyCrewView } from "@/components/projects/BuildMyCrewView";
import { loadCrewView } from "@/lib/projectCrewView";

export const dynamic = "force-dynamic";

export default async function ProjectCrewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadCrewView(slug);
  if (!data) {
    notFound();
  }
  return <BuildMyCrewView data={data} />;
}
