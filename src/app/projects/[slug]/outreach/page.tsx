/**
 * /projects/[slug]/outreach — Outreach review (tracer).
 *
 * Server-side: load project + journey + OutboundDraft rows (type
 * CANDIDATE_OUTREACH). Render OutreachReviewView with the loaded data.
 *
 * Returns notFound() when the slug doesn't resolve to a Project OR when
 * `loadOutreachView` throws (e.g. DB unreachable). Mirrors the defensive
 * pattern PR #35 added to /projects/[slug].
 *
 * Honesty contract: nothing is sent. The page renders the journey's
 * primaryAction verbatim — when at outreach_awaiting_send the action
 * is disabled with a blockedReason explaining the A2P / kill-switch
 * gate.
 */

import { notFound } from "next/navigation";
import { OutreachReviewView } from "@/components/projects/OutreachReviewView";
import {
  loadOutreachView,
  type OutreachViewData,
} from "@/lib/projectOutreachView";
import { logServerError } from "@/sms-engine/safeLogging";

export const dynamic = "force-dynamic";

export default async function ProjectOutreachPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let data: OutreachViewData | null = null;
  try {
    data = await loadOutreachView(slug);
  } catch (error) {
    logServerError("loadOutreachView", error);
    data = null;
  }

  if (!data) {
    notFound();
  }
  return <OutreachReviewView data={data} />;
}
