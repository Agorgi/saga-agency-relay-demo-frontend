/**
 * Server-side helpers for the /projects/[slug] brief review page.
 *
 * Loads a Project row by id, builds the view contract per docs/page-briefs.md.
 * Framework-agnostic data shaping; the page component renders the result.
 *
 * Returns null if `slug` doesn't match a Prisma Project, so the caller can
 * fall back to the legacy fixture-based ProjectWorkspaceView.
 */

import { getDb } from "@/sms-engine/db";
import {
  getOrCreateJourney,
} from "@/lib/journey/service";
import type { ProjectJourney } from "@/lib/journey/types";

export type BriefReviewFact = {
  label: string;
  value: string;
};

export type BriefReviewData = {
  projectId: string;
  title: string;
  facts: BriefReviewFact[];
  whatSagaWillDo: string;
  journey: ProjectJourney;
  /** Where "Edit with Sagasan" goes — reopens chat with this project loaded. */
  editChatHref: string;
};

const PROJECT_ID_PATTERN = /^c[a-z0-9]{20,}$/i;

/**
 * Lightweight check before hitting the DB: a Prisma cuid starts with 'c' and
 * is 24+ characters. Legacy fixture slugs (kebab-case event names) won't
 * match this pattern, so we save a round trip in the common path.
 */
export function looksLikeProjectId(slug: string): boolean {
  return PROJECT_ID_PATTERN.test(slug);
}

export async function loadBriefReview(projectId: string): Promise<BriefReviewData | null> {
  if (!looksLikeProjectId(projectId)) {
    return null;
  }

  const project = await getDb().project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      description: true,
      city: true,
      targetDate: true,
      budgetRange: true,
      audience: true,
      fandoms: true,
    },
  });

  if (!project) {
    return null;
  }

  const journey = await getOrCreateJourney(projectId);

  const facts: BriefReviewFact[] = [];
  if (project.city) facts.push({ label: "Location", value: project.city });
  if (project.targetDate) facts.push({ label: "When", value: project.targetDate });
  if (project.budgetRange) facts.push({ label: "Budget", value: project.budgetRange });
  if (project.audience) facts.push({ label: "Audience", value: project.audience });
  if (project.fandoms.length > 0) {
    facts.push({
      label: "References",
      value: project.fandoms.slice(0, 5).join(", "),
    });
  }
  if (project.description) {
    facts.push({ label: "Vibe", value: project.description });
  }

  return {
    projectId,
    title: project.title || "Your project",
    facts,
    whatSagaWillDo:
      "Find the roles your brief needs. Suggest 3–5 candidates per role with rationale. Prepare outreach drafts — you review before anything sends.",
    journey,
    editChatHref: `/chat?projectId=${projectId}`,
  };
}
