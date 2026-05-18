/**
 * /projects/[slug]/outreach — Outreach review (tracer).
 *
 * Server-side: load project + journey + OutboundDraft rows (type
 * CANDIDATE_OUTREACH). Render OutreachReviewView with the loaded data.
 *
 * Returns notFound() when the slug doesn't resolve to a Project — keeps
 * legacy fixture browsing (/projects/[slug]) from spilling into the
 * tracer URL space.
 *
 * Honesty contract: nothing is sent. The page renders the journey's
 * primaryAction verbatim — when at outreach_awaiting_send the action
 * is disabled with a blockedReason explaining the A2P / kill-switch
 * gate.
 */

import { notFound } from "next/navigation";
import { OutreachReviewView } from "@/components/projects/OutreachReviewView";
import { loadOutreachView } from "@/lib/projectOutreachView";

export const dynamic = "force-dynamic";

export default async function ProjectOutreachPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadOutreachView(slug);
  if (!data) {
    notFound();
  }
  return <OutreachReviewView data={data} />;
}
