/**
 * Crew generation for tracer projects — wires the producer engine to the
 * chat-created `Project` model.
 *
 * The producer engine in `src/sms-engine/producer/*` was originally built
 * for the admin-only `ProjectBrief` model: `persistInternalCandidateRecommendations`
 * keys on `projectBriefId` and routes through `ensureProjectForProjectBrief`.
 * Chat-created tracer projects don't have a `ProjectBrief` row, so that
 * entry point can't see them.
 *
 * This module is a thin parallel orchestrator that:
 *   1. Loads the Project row (chat-created, `legacyProjectBriefId` null).
 *   2. Builds a `ProjectUnderstanding` from the Project fields. The
 *      pipeline's `buildProjectUnderstanding` already accepts a `project`
 *      input shape — we just need to ensure `sourceKind` lands on
 *      "organizer_project" since the chat flow already classified the
 *      persona as host before persisting the Project.
 *   3. Runs the deterministic `generateRoleMap` + `buildSourcingPlan`.
 *   4. Persists `RoleOpening` + `Opportunity` rows for every role.
 *   5. Pulls the internal `CreatorProfile` pool, runs the deterministic
 *      `recommendInternalCandidates` scorer, and writes the resulting
 *      `CandidateRecommendation` rows. Today the pool is sparse in
 *      staging Neon — that's fine, fewer rows is honest. Future PRs
 *      can layer in OpenAI web research from
 *      `src/sms-engine/sourcing/openaiWebResearchProvider.ts`.
 *
 * Idempotent. If the Project already has any `RoleOpening` rows, we
 * short-circuit and report `skipped: "already_generated"`. Safe to call
 * from every load of `/projects/[id]/crew` — `loadCrewView` will fire it
 * before reading the role list.
 *
 * Framework-agnostic; liftable into `apps/app-server` during Phase 2
 * with no contract changes.
 */

import type { PrismaClient, ProximityTier } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";
import { buildProjectUnderstanding } from "@/sms-engine/producer/projectUnderstanding";
import { generateRoleMap } from "@/sms-engine/producer/roleMap";
import { buildSourcingPlan } from "@/sms-engine/producer/sourcingPlan";
import { recommendInternalCandidates } from "@/sms-engine/producer/candidateRecommendations";
import type {
  CandidatePoolItem,
  ProjectUnderstanding,
  RoleMap,
} from "@/sms-engine/producer/producerAgentTypes";

export type CrewGenerationResult =
  | {
      projectId: string;
      skipped: "already_generated";
      rolesCreated: 0;
      candidatesCreated: 0;
    }
  | {
      projectId: string;
      skipped: "no_organizer_project";
      rolesCreated: 0;
      candidatesCreated: 0;
    }
  | {
      projectId: string;
      skipped?: undefined;
      rolesCreated: number;
      candidatesCreated: number;
    };

/**
 * Run the producer engine end-to-end on a chat-created Project.
 *
 * Idempotent on RoleOpening: if any roles already exist for this project,
 * the function returns immediately without re-running understanding or
 * touching CandidateRecommendation rows. Generation is meant to fire
 * once per Project (on the first /crew visit) and stay stable across
 * subsequent visits — the user reviews + approves what's been suggested,
 * they don't expect the role list to shuffle on every page load.
 */
export async function generateCrewForProject(
  projectId: string,
): Promise<CrewGenerationResult> {
  const db = getDb();

  // Idempotency: if any role already exists, skip.
  const existingRoleCount = await db.roleOpening.count({
    where: { projectId },
  });
  if (existingRoleCount > 0) {
    return {
      projectId,
      skipped: "already_generated",
      rolesCreated: 0,
      candidatesCreated: 0,
    };
  }

  const project = await db.project.findUnique({
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
      organizerPersonId: true,
    },
  });
  if (!project) {
    throw new Error(`generateCrewForProject: project ${projectId} not found`);
  }

  const baseUnderstanding = buildUnderstandingForTracerProject(project);

  // PR #68: enrich `understanding.fandoms` with the project owner's
  // accumulated `Person.fandoms` (built up across chat turns by PRs
  // #63–67). The producer's `scoreCandidateForRole` already weights
  // fandom overlap; by widening the "project fandom" set with the
  // owner's identity-graph signal, candidates who share a fandom
  // with the owner — even if it didn't appear in the brief itself —
  // get the existing boost. Same scoring code, more signal in.
  //
  // De-duped case-insensitively against project fandoms so a fandom
  // mentioned in both places doesn't double-count.
  const { understanding, ownerOnlyFandoms } = await enrichUnderstandingWithOwnerFandoms({
    db,
    baseUnderstanding,
    organizerPersonId: project.organizerPersonId,
  });

  // sourceKind="unknown" or non-organizer would bail out of generateRoleMap.
  // We've forced "organizer_project" above when the project has any brief
  // signal at all — the only case that legitimately returns no roles is a
  // completely empty project (no title, no description, no fandoms). Treat
  // that as "no_organizer_project" and skip generation.
  if (understanding.sourceKind !== "organizer_project") {
    return {
      projectId,
      skipped: "no_organizer_project",
      rolesCreated: 0,
      candidatesCreated: 0,
    };
  }

  const roleMap = generateRoleMap(understanding);
  const sourcingPlan = buildSourcingPlan(understanding, roleMap);

  const allRoles = [...roleMap.requiredRoles, ...roleMap.optionalRoles];
  if (allRoles.length === 0) {
    await logCrewGenerated({
      projectId,
      rolesCreated: 0,
      candidatesCreated: 0,
      confidence: understanding.confidence,
      note: "role_map_empty",
    });
    return {
      projectId,
      rolesCreated: 0,
      candidatesCreated: 0,
    };
  }

  // Persist RoleOpening + Opportunity per role.
  //
  // Race-safety: the `RoleOpening @@unique([projectId, roleType])` constraint
  // (migration 20260518010000) guarantees only one row per project/role
  // combination at the database level. The count-check above optimises
  // the common-case (no work needed), but it's a TOCTOU window — two
  // concurrent /crew loads on a fresh project can both see count=0
  // and race into creation. When that happens, the second `create`
  // throws Prisma P2002 (unique violation). We catch it, fetch the
  // existing row + its Opportunity, and continue — the role list ends
  // up identical regardless of which generator "won" any individual
  // role, and no duplicates land in the DB.
  const roleOpeningByType = new Map<string, { id: string; opportunityId: string }>();
  for (const role of allRoles) {
    try {
      const roleOpening = await db.roleOpening.create({
        data: {
          projectId,
          roleType: role.roleType,
          title: role.title,
          description: role.description,
          requiredSkills: role.requiredSkills,
          preferredFandoms: role.preferredFandoms,
          locationRequirement: role.localRequired ? understanding.city : null,
          compensationType: "UNKNOWN",
          status: "OPEN",
        },
        select: { id: true },
      });
      const opportunity = await db.opportunity.create({
        data: {
          roleOpeningId: roleOpening.id,
          visibility: "PRIVATE",
          applicationMode: "INVITE_ONLY",
          status: "ACTIVE",
        },
        select: { id: true },
      });
      roleOpeningByType.set(role.roleType, {
        id: roleOpening.id,
        opportunityId: opportunity.id,
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Another concurrent generator beat us to this role — adopt
      // its existing row + opportunity so candidate scoring still
      // hangs off the same Opportunity id.
      const existing = await db.roleOpening.findUnique({
        where: {
          projectId_roleType: { projectId, roleType: role.roleType },
        },
        select: {
          id: true,
          opportunities: { select: { id: true }, take: 1 },
        },
      });
      if (existing?.opportunities[0]) {
        roleOpeningByType.set(role.roleType, {
          id: existing.id,
          opportunityId: existing.opportunities[0].id,
        });
      }
    }
  }

  // If the racing generator finished every role before we got here,
  // there's nothing left for us to score against. Report as the
  // idempotent skip outcome so callers don't double-log creation.
  if (roleOpeningByType.size === 0) {
    return {
      projectId,
      skipped: "already_generated",
      rolesCreated: 0,
      candidatesCreated: 0,
    };
  }

  // Score CreatorProfile pool against roles. `ownerOnlyFandoms` is the
  // subset of owner's `Person.fandoms` that's NOT in the brief — used
  // by scoring (PR #69) to emit a distinct "Shared fandom with you"
  // matching reason instead of blurring it into the brief-driven one.
  const candidatePool = await loadCreatorPool(project.organizerPersonId);
  const recommendations = recommendInternalCandidates(
    understanding,
    roleMap,
    sourcingPlan,
    candidatePool,
    { ownerOnlyFandoms },
  );

  // Batch candidate persistence (PR #60). Previously this was a per-row
  // upsert loop — ~50 sequential round-trips for a real CreatorProfile
  // pool. `createMany({ skipDuplicates: true })` collapses the inserts
  // into one round-trip and the `@@unique([opportunityId, personId])`
  // constraint on CandidateRecommendation cleanly skips any rows a
  // racing generator (or a partial prior run) already wrote.
  //
  // What we lose vs the old upsert:
  //   - The old `update` branch refreshed score / matchingReasons /
  //     risks on existing rows. In practice this was a no-op for the
  //     common path: the producer's `recommendInternalCandidates` is
  //     deterministic given identical inputs, so re-running on the
  //     same brief produces identical scores. The race path is
  //     short-circuited above by the `existingRoleCount > 0` fast
  //     path (PR #50 + #53), so we only reach here when persisting a
  //     fresh set of recommendations.
  //
  // What we keep:
  //   - Skip-on-no-personId — recommendations without a person are
  //     non-actionable and not worth persisting.
  //   - Identical column shape: status defaults to SUGGESTED on
  //     create, plus score / scoreBreakdown / proximityTier /
  //     matchingReasons / risks pass through.
  const candidateRowsToInsert = allRoles.flatMap((role) => {
    const opportunity = roleOpeningByType.get(role.roleType);
    if (!opportunity) return [];
    const recsForRole = recommendations.filter(
      (rec) => rec.recommendedRole === role.roleType,
    );
    return recsForRole
      .filter((rec) => rec.personId)
      .map((rec) => ({
        opportunityId: opportunity.opportunityId,
        personId: rec.personId!,
        score: rec.score,
        scoreBreakdown: rec.scoreBreakdown,
        proximityTier: rec.proximityTier,
        matchingReasons: rec.matchingReasons,
        risks: rec.risks,
        status: "SUGGESTED" as const,
      }));
  });

  const candidatesCreated =
    candidateRowsToInsert.length === 0
      ? 0
      : (
          await db.candidateRecommendation.createMany({
            data: candidateRowsToInsert,
            skipDuplicates: true,
          })
        ).count;

  await logCrewGenerated({
    projectId,
    rolesCreated: allRoles.length,
    candidatesCreated,
    confidence: understanding.confidence,
  });

  return {
    projectId,
    rolesCreated: allRoles.length,
    candidatesCreated,
  };
}

/**
 * Build a producer `ProjectUnderstanding` from a tracer Project row.
 *
 * The chat flow has already classified the persona as `host` before
 * persisting the Project, so we know structurally that this is an
 * organizer project. The deterministic classifier in
 * `inferSourceKind` scans free-text for "I want to throw/host/produce"
 * patterns; brief-derived titles like "Formal ball in LA" don't trip
 * those patterns and would default to "unknown", which would in turn
 * cause `generateRoleMap` to bail out. We patch `sourceKind` to
 * `organizer_project` to keep the role-map producer running on tracer
 * projects.
 *
 * Patch is justified: the chat flow's persona gate is a stricter check
 * than the regex-based classifier, and we only reach this code from a
 * Project that the chat flow has persisted as a host's brief.
 */
function buildUnderstandingForTracerProject(project: {
  title: string | null;
  description: string | null;
  city: string | null;
  targetDate: string | null;
  budgetRange: string | null;
  audience: string | null;
  fandoms: string[];
}): ProjectUnderstanding {
  const understanding = buildProjectUnderstanding({
    project: {
      title: project.title,
      description: project.description,
      city: project.city,
      targetDate: project.targetDate,
      budgetRange: project.budgetRange,
      audience: project.audience,
      fandoms: project.fandoms,
    },
  });

  // If the classifier could already see organizer signal (e.g. the title
  // contained "I want to throw..."), keep it. Otherwise force the tag.
  // A project with no title AND no description AND no fandoms produces
  // no useful understanding — the caller will catch that and skip.
  const hasAnyBriefSignal = Boolean(
    project.title || project.description || project.fandoms.length > 0,
  );
  if (!hasAnyBriefSignal) {
    return { ...understanding, sourceKind: "unknown" };
  }
  return { ...understanding, sourceKind: "organizer_project" };
}

/**
 * PR #68: pull the project owner's `Person.fandoms` and merge them
 * into `understanding.fandoms` so the producer's existing fandom-
 * weighted scoring picks up signals captured outside the brief
 * itself (e.g. a fandom mentioned in an earlier chat turn but not
 * carried into the project's `fandoms` column).
 *
 * Case-insensitive union — preserves the existing capitalization on
 * the project side (so the brief's "Love and Deepspace" stays
 * canonical even if the Person row has "love and deepspace").
 *
 * Returns BOTH the enriched understanding AND the subset of owner
 * fandoms that were NEW (didn't already exist on the brief). PR #69
 * uses `ownerOnlyFandoms` to surface those as a distinct matching
 * reason ("Shared fandom with you: X") rather than blurring them
 * into the brief-driven "Fandom/community fit: X" line.
 *
 * No-op when there's no `organizerPersonId` (legacy chat-created
 * projects pre-PR #68) or when the owner's Person has no fandoms.
 * Defensive: a DB error here must not break crew generation — log
 * and return the unenriched understanding with empty owner list.
 */
async function enrichUnderstandingWithOwnerFandoms({
  db,
  baseUnderstanding,
  organizerPersonId,
}: {
  db: PrismaClient;
  baseUnderstanding: ProjectUnderstanding;
  organizerPersonId: string | null;
}): Promise<{
  understanding: ProjectUnderstanding;
  ownerOnlyFandoms: string[];
}> {
  if (!organizerPersonId) {
    return { understanding: baseUnderstanding, ownerOnlyFandoms: [] };
  }

  let ownerFandoms: string[] = [];
  try {
    const owner = await db.person.findUnique({
      where: { id: organizerPersonId },
      select: { fandoms: true },
    });
    ownerFandoms = owner?.fandoms ?? [];
  } catch (error) {
    console.warn(
      "[crew-generation] failed to read owner fandoms; continuing without identity-graph boost",
      error,
    );
    return { understanding: baseUnderstanding, ownerOnlyFandoms: [] };
  }
  if (ownerFandoms.length === 0) {
    return { understanding: baseUnderstanding, ownerOnlyFandoms: [] };
  }

  const projectFandoms = baseUnderstanding.fandoms ?? [];
  const seen = new Set(projectFandoms.map((f) => f.toLowerCase()));
  const merged = [...projectFandoms];
  const ownerOnlyFandoms: string[] = [];
  for (const fandom of ownerFandoms) {
    const trimmed = fandom.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(trimmed);
    ownerOnlyFandoms.push(trimmed);
  }
  return {
    understanding: { ...baseUnderstanding, fandoms: merged },
    ownerOnlyFandoms,
  };
}

async function loadCreatorPool(
  organizerPersonId: string | null,
): Promise<CandidatePoolItem[]> {
  const db = getDb();
  const [profiles, relationshipEdges] = await Promise.all([
    db.creatorProfile.findMany({
      include: {
        person: {
          include: { legacyContact: { select: { id: true } } },
        },
      },
    }),
    organizerPersonId
      ? db.relationshipEdge.findMany({
          where: {
            OR: [
              { fromPersonId: organizerPersonId },
              { toPersonId: organizerPersonId },
            ],
          },
        })
      : Promise.resolve([]),
  ]);

  return profiles.map((profile) => {
    const tier = proximityFor(
      organizerPersonId,
      profile.personId,
      relationshipEdges,
    );
    return {
      personId: profile.personId,
      contactId: profile.person.legacyContact?.id || null,
      creatorProfileId: profile.id,
      displayName:
        profile.displayName || profile.person.name || "Internal candidate",
      city: profile.city || profile.person.city,
      roles: profile.roles,
      skills: profile.skills,
      fandoms: profile.fandoms,
      communities: profile.communities,
      portfolioUrls: profile.portfolioUrls,
      socialUrls: profile.socialUrls,
      reviewStatus: profile.reviewStatus,
      optedOut: profile.person.optedOut,
      consentStatus: profile.person.consentStatus,
      proximityTier: tier.tier,
      relationshipStrength: tier.strength,
      privateNotes: profile.internalNotes,
    } satisfies CandidatePoolItem;
  });
}

function proximityFor(
  organizerPersonId: string | null,
  personId: string,
  edges: Array<{
    fromPersonId: string;
    toPersonId: string;
    relationshipType: string;
    strength: number;
  }>,
): { tier: ProximityTier; strength: number } {
  if (!organizerPersonId) return { tier: "UNKNOWN", strength: 1 };
  const edge = edges.find(
    (item) =>
      (item.fromPersonId === organizerPersonId && item.toPersonId === personId) ||
      (item.toPersonId === organizerPersonId && item.fromPersonId === personId),
  );
  if (!edge) return { tier: "UNKNOWN", strength: 1 };
  const tierByType: Record<string, ProximityTier> = {
    FRIEND: "FRIEND",
    MUTUAL: "MUTUAL",
    SAME_COMMUNITY: "COMMUNITY",
    ATTENDED_SAME_EVENT: "COMMUNITY",
    COLLABORATED: "COMMUNITY",
    FOLLOWING: "EXTENDED",
    IMPORTED_CONNECTION: "EXTENDED",
  };
  return {
    tier: tierByType[edge.relationshipType] || "UNKNOWN",
    strength: edge.strength,
  };
}

/**
 * Detect a Prisma unique-constraint violation (P2002). We catch this
 * narrowly so unrelated DB errors still propagate.
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

async function logCrewGenerated(metadata: {
  projectId: string;
  rolesCreated: number;
  candidatesCreated: number;
  confidence: number;
  note?: string;
}): Promise<void> {
  await logAudit({
    actorType: "SYSTEM",
    action: "producer.tracer_crew_generated",
    entityType: "Project",
    entityId: metadata.projectId,
    metadata,
  });
}

// Re-export so callers can keep the RoleMap shape clear without
// reaching into sms-engine internals. Not strictly necessary today;
// included so a future migration to apps/app-server has one boundary.
export type { ProjectUnderstanding, RoleMap };
