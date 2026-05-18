/**
 * Sagasan → Project + ProjectJourney persistence.
 *
 * Framework-agnostic. Called from the chat API (or any other surface that
 * extracts a brief). Replaces the previous URL-prefill handoff — the brief
 * now lives as a real Project row, not as base64 in a query string.
 *
 * Behaviour:
 * - persona != "host" or no projectIdea → no-op, returns nulls.
 * - First time we see a brief on a session → creates Project + Journey at
 *   `intake`, links WebSession.projectId.
 * - Subsequent turns → updates the same Project with the latest extracted
 *   fields.
 * - When the organizer brief reaches `production_plan_ready` or
 *   `talent_search_ready` AND the journey is still at `intake`, advances
 *   the journey to `brief_ready`.
 *
 * Honors the legacy / no-DB code paths: if WebChatMessage isn't using the
 * DB (preview / fallback mode), we no-op silently. This keeps demo behavior
 * working when Neon is unreachable.
 */

import { NetworkProjectSource } from "@prisma/client";
import {
  evaluateOrganizerBriefReadiness,
  type OrganizerIntakeFields,
} from "@/lib/sagasanOrganizerIntake";
import { advanceJourney, getOrCreateJourney } from "@/lib/journey/service";
import type { ProjectJourney } from "@/lib/journey/types";
import { JourneyTransitionError } from "@/lib/journey/types";
import { hasWebChatDatabase } from "@/lib/webChatSessionStore";
import type { Persona } from "@/lib/sagasanPersonas";
import { getDb } from "@/sms-engine/db";

export type ProjectUpsertResult = {
  projectId: string | null;
  journey: ProjectJourney | null;
  briefReadinessStage:
    | "seed_idea"
    | "intake_in_progress"
    | "draft_brief_ready"
    | "production_plan_ready"
    | "talent_search_ready"
    | null;
};

export type ProjectUpsertInput = {
  sessionId: string;
  persona: Persona | null;
  organizerFields: OrganizerIntakeFields | null;
};

/**
 * Stages that signal the brief is complete enough to leave intake. Keep this
 * conservative — the user can always come back and refine via "Edit with
 * Sagasan," which soft-reverts the journey to `intake`.
 */
const BRIEF_READY_STAGES = new Set([
  "production_plan_ready",
  "talent_search_ready",
]);

function pickBriefFields(fields: OrganizerIntakeFields) {
  return {
    title: fields.projectIdea?.slice(0, 200) || null,
    description:
      [fields.themeVibe, fields.scopeFormat, fields.helpNeeded]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 500) || null,
    city: fields.locationMarket?.slice(0, 120) || null,
    targetDate: fields.timing?.slice(0, 120) || null,
    budgetRange: fields.budget?.slice(0, 120) || null,
    audience: fields.audience?.slice(0, 200) || null,
    fandoms: fields.inspirationReferences.slice(0, 10),
  };
}

export async function upsertProjectFromBrief({
  sessionId,
  persona,
  organizerFields,
}: ProjectUpsertInput): Promise<ProjectUpsertResult> {
  const empty: ProjectUpsertResult = {
    projectId: null,
    journey: null,
    briefReadinessStage: null,
  };

  if (persona !== "host" || !organizerFields?.projectIdea) {
    return empty;
  }
  if (!hasWebChatDatabase()) {
    return empty;
  }

  const readiness = evaluateOrganizerBriefReadiness(organizerFields);
  const briefFields = pickBriefFields(organizerFields);
  const db = getDb();

  const session = await db.webSession.findUnique({
    where: { id: sessionId },
    select: { id: true, projectId: true, personId: true },
  });
  if (!session) {
    // The web chat session may not have been persisted yet (legacy/in-memory
    // store paths) — surfacing an error here would crash the chat reply.
    return empty;
  }

  let projectId = session.projectId;

  if (projectId) {
    // PR #68: backfill `organizerPersonId` when the session now has a
    // personId but the Project was created earlier (PR #63/64 races
    // where the Person row appeared after the Project). This makes the
    // identity-graph → producer-scoring boost work on already-existing
    // projects, not just new ones.
    const updateData: Parameters<typeof db.project.update>[0]["data"] = {
      ...briefFields,
    };
    if (session.personId) {
      const existing = await db.project.findUnique({
        where: { id: projectId },
        select: { organizerPersonId: true },
      });
      if (existing && !existing.organizerPersonId) {
        updateData.organizerPersonId = session.personId;
      }
    }
    await db.project.update({
      where: { id: projectId },
      data: updateData,
    });
  } else {
    // PR #68: link the Project to the session's anchor Person at create
    // time. This is the bridge that lets `generateCrewForProject` pull
    // the owner's accumulated `Person.fandoms` (PRs #63–67) into the
    // ProjectUnderstanding before scoring candidates.
    const created = await db.project.create({
      data: {
        ...briefFields,
        source: NetworkProjectSource.WEB_APP,
        organizerPersonId: session.personId ?? null,
      },
      select: { id: true },
    });
    projectId = created.id;
    await db.webSession.update({
      where: { id: sessionId },
      data: { projectId },
    });
  }

  // Idempotent: returns existing journey if present, otherwise creates one
  // at `intake`. Reading via the service keeps the contract identical for
  // future callers (PR #4 chat hook today; iOS client / admin tomorrow).
  let journey = await getOrCreateJourney(projectId);

  if (
    journey.step === "intake" &&
    BRIEF_READY_STAGES.has(readiness.stage)
  ) {
    try {
      journey = await advanceJourney(projectId, "brief_ready");
    } catch (error) {
      // The only way this should throw is if some other writer raced us
      // past `intake`. In that case the journey is already at brief_ready
      // (or beyond), and we can swallow the error and return the latest.
      if (!(error instanceof JourneyTransitionError)) {
        throw error;
      }
      journey = (await getOrCreateJourney(projectId)) ?? journey;
    }
  }

  return {
    projectId,
    journey,
    briefReadinessStage: readiness.stage,
  };
}
