/**
 * Server-side loader for the /projects/[id]/crew page.
 *
 * Loads project snapshot + journey + roles + candidate counts. Pure data
 * shaping — the page component renders the result.
 *
 * Returns null when the slug isn't a Prisma Project id or no Project exists.
 * The page route falls back to the legacy ProjectWorkspaceView in that case.
 *
 * Auto-advances the journey from brief_ready → crew_reviewing on first
 * load. The advance is a side-effect (a journey row is updated) but
 * idempotent — calling it twice yields the same crew_reviewing state.
 */

import { getDb } from "@/sms-engine/db";
import { advanceJourney, getOrCreateJourney } from "@/lib/journey/service";
import { looksLikeProjectId } from "@/lib/projectBriefView";
import {
  JourneyTransitionError,
  type ProjectJourney,
} from "@/lib/journey/types";
import { generateCrewForProject } from "@/lib/projectCrewGeneration";
import { logServerError } from "@/sms-engine/safeLogging";

export type CrewRolePresentation = {
  id: string;
  title: string;
  description: string | null;
  priority: "core" | "nice-to-have";
  candidateCount: number;
  approvedCount: number;
  reviewHref: string;
};

export type CrewViewData = {
  projectId: string;
  briefSnapshot: {
    title: string;
    facts: Array<{ label: string; value: string }>;
  };
  roles: CrewRolePresentation[];
  /**
   * Honest summary of the candidate pool. When `roles.length === 0` we
   * surface "researching" copy — never invent fake roles to fill the page.
   */
  state: "researching" | "ready" | "empty_brief";
  journey: ProjectJourney;
  editBriefHref: string;
};

// RoleOpening statuses we consider "shown to the user" on the crew page.
// Drafts haven't been promoted by the producer agent yet; archived/filled
// shouldn't appear in the user-facing review surface.
const USER_VISIBLE_ROLE_STATUSES = new Set([
  "OPEN",
  "RECOMMENDING",
  "OUTREACHING",
]);

// CandidateRecommendation statuses that count as "approved for outreach"
// in the page-level primary-action gate.
const APPROVED_CANDIDATE_STATUSES = new Set([
  "APPROVED",
  "APPROVED_FOR_SHORTLIST",
  "SHORTLISTED",
]);

function briefFacts(project: {
  city: string | null;
  targetDate: string | null;
  budgetRange: string | null;
  audience: string | null;
  fandoms: string[];
}) {
  const facts: Array<{ label: string; value: string }> = [];
  if (project.city) facts.push({ label: "Where", value: project.city });
  if (project.targetDate) facts.push({ label: "When", value: project.targetDate });
  if (project.budgetRange) facts.push({ label: "Budget", value: project.budgetRange });
  if (project.audience) facts.push({ label: "For", value: project.audience });
  if (project.fandoms.length > 0) {
    facts.push({ label: "References", value: project.fandoms.slice(0, 3).join(", ") });
  }
  return facts;
}

async function ensureCrewReviewingStep(
  projectId: string,
  journey: ProjectJourney,
): Promise<ProjectJourney> {
  if (journey.step !== "brief_ready") return journey;
  try {
    return await advanceJourney(projectId, "build_crew");
  } catch (error) {
    if (!(error instanceof JourneyTransitionError)) {
      logServerError("ensureCrewReviewingStep", error);
      throw error;
    }
    return journey;
  }
}

export async function loadCrewView(projectId: string): Promise<CrewViewData | null> {
  if (!looksLikeProjectId(projectId)) {
    return null;
  }

  const db = getDb();

  // Verify the project exists before doing anything else. Generation +
  // the view-data read both assume the row exists; fail fast for the
  // notFound() path.
  const exists = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!exists) return null;

  const baseJourney = await getOrCreateJourney(projectId);
  const journey = await ensureCrewReviewingStep(projectId, baseJourney);

  // First-visit crew generation. Fires the producer engine on a fresh
  // tracer project so RoleOpening + Opportunity + CandidateRecommendation
  // rows exist before the view reads them. Idempotent: if roles already
  // exist for this project (a return visit, or admin pre-seed), the call
  // short-circuits. Failures are logged and swallowed so a producer-side
  // outage falls through to the existing "researching..." empty state
  // rather than blowing up the page.
  try {
    await generateCrewForProject(projectId);
  } catch (error) {
    logServerError("generateCrewForProject", error);
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      city: true,
      targetDate: true,
      budgetRange: true,
      audience: true,
      fandoms: true,
      roleOpenings: {
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          opportunities: {
            select: {
              recommendations: {
                select: { status: true },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return null;

  const visibleRoles = project.roleOpenings.filter((role) =>
    USER_VISIBLE_ROLE_STATUSES.has(role.status as string),
  );

  const roles: CrewRolePresentation[] = visibleRoles.map((role) => {
    const candidates = role.opportunities.flatMap(
      (opp) => opp.recommendations,
    );
    const approved = candidates.filter((c) =>
      APPROVED_CANDIDATE_STATUSES.has(c.status as string),
    );
    return {
      id: role.id,
      title: role.title,
      description: role.description,
      // Until the producer agent emits priority signals, treat every
      // surfaced role as "core" so the page contract still works. The
      // candidate review page (PR #7) will refine this.
      priority: "core",
      candidateCount: candidates.length,
      approvedCount: approved.length,
      reviewHref: `/projects/${projectId}/crew/${role.id}`,
    };
  });

  return {
    projectId,
    briefSnapshot: {
      title: project.title || "Your project",
      facts: briefFacts(project),
    },
    roles,
    state:
      roles.length === 0
        ? project.title
          ? "researching"
          : "empty_brief"
        : "ready",
    journey,
    editBriefHref: `/projects/${projectId}`,
  };
}
