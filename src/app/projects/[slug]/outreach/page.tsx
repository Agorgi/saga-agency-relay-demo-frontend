/**
 * /projects/[slug]/outreach — Outreach review (tracer).
 *
 * Server-side: load project + journey + OutboundDraft rows (type
 * CANDIDATE_OUTREACH). Render OutreachReviewView with the loaded data.
 *
 * Auth: read-side session ownership check (PR #48). Only the
 * cookie session that created the Project can view its outreach
 * drafts. Other sessions see notFound().
 *
 * Returns notFound() when the slug doesn't resolve to a Project,
 * when the session doesn't own it, or when `loadOutreachView`
 * throws.
 *
 * Honesty contract: nothing is sent. The page renders the journey's
 * primaryAction verbatim — when at outreach_awaiting_send the action
 * is disabled with a blockedReason explaining the A2P / kill-switch
 * gate.
 */

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { OutreachReviewView } from "@/components/projects/OutreachReviewView";
import { SagaShell } from "@/components/saga/SagaShell";
import {
  loadOutreachView,
  type OutreachViewData,
} from "@/lib/projectOutreachView";
import { sessionOwnsProject } from "@/lib/projectAuth";
import { WEB_SESSION_COOKIE_NAME } from "@/lib/webChatSessionStore";
import { logServerError } from "@/sms-engine/safeLogging";

export const dynamic = "force-dynamic";

export default async function ProjectOutreachPage({
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
  return (
    <SagaShell state="OUTREACH">
      <OutreachReviewView data={data} />
    </SagaShell>
  );
}
