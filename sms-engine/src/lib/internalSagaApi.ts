import { z } from "zod";
import type {
  CandidateRecommendation,
  CreatorProfile,
  Opportunity,
  Person,
  Prisma,
  Project,
  RoleOpening,
} from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { addInterestToCheck, convertInterestCheckToProject } from "@/lib/networkCore";
import { runCandidateRecommendations } from "@/lib/networkMatching";
import { normalizePhone } from "@/lib/phone";
import { InternalApiError } from "@/lib/internalRoute";

const stringArray = z.array(z.string().trim().min(1)).default([]);
const optionalStringArray = z.array(z.string().trim().min(1)).optional();

const profileInputSchema = z
  .object({
    displayName: z.string().optional(),
    bio: z.string().optional(),
    city: z.string().optional(),
    roles: optionalStringArray,
    skills: optionalStringArray,
    fandoms: optionalStringArray,
    communities: optionalStringArray,
    portfolioUrls: optionalStringArray,
    socialUrls: optionalStringArray,
    availabilityNotes: z.string().optional(),
    rateNotes: z.string().optional(),
    preferredOpportunityTypes: optionalStringArray,
  })
  .optional();

export const upsertSagaUserSchema = z.object({
  sagaUserId: z.string().trim().min(1),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  city: z.string().optional(),
  communities: optionalStringArray,
  profile: profileInputSchema,
  roles: optionalStringArray,
  skills: optionalStringArray,
  fandoms: optionalStringArray,
  portfolioUrls: optionalStringArray,
  socialUrls: optionalStringArray,
});

export const importSagaEventSchema = z.object({
  existingSagaEventId: z.string().trim().min(1),
  organizerSagaUserId: z.string().optional(),
  existingSagaCommunityId: z.string().optional(),
  source: z.enum(["MOBILE_APP", "WEB_APP", "IMPORT"]).default("IMPORT"),
  title: z.string().trim().min(1),
  description: z.string().optional(),
  city: z.string().optional(),
  targetDate: z.string().optional(),
  fandoms: stringArray,
  ticketingEnabled: z.boolean().optional(),
  rsvpEnabled: z.boolean().optional(),
});

export const roleOpeningInputSchema = z.object({
  id: z.string().optional(),
  roleType: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().optional(),
  skills: optionalStringArray,
  requiredSkills: optionalStringArray,
  fandoms: optionalStringArray,
  preferredFandoms: optionalStringArray,
  compensationType: z
    .enum(["UNKNOWN", "PAID", "VOLUNTEER", "COLLAB", "TRADE"])
    .default("UNKNOWN"),
  budgetRange: z.string().optional(),
  quantityNeeded: z.number().int().positive().default(1),
  remoteAllowed: z.boolean().default(false),
  locationRequirement: z.string().optional(),
  publish: z.boolean().optional(),
});

export const roleOpeningsRequestSchema = z.object({
  publish: z.boolean().default(false),
  roleOpenings: z.array(roleOpeningInputSchema).min(1),
});

export const opportunityInterestSchema = z
  .object({
    sagaUserId: z.string().optional(),
    personId: z.string().optional(),
    message: z.string().optional(),
    availability: z.string().optional(),
  })
  .refine((value) => value.sagaUserId || value.personId, {
    message: "Provide sagaUserId or personId.",
  });

export const importRelationshipsSchema = z.object({
  edges: z
    .array(
      z.object({
        fromSagaUserId: z.string().trim().min(1),
        toSagaUserId: z.string().trim().min(1),
        relationshipType: z.enum([
          "FRIEND",
          "MUTUAL",
          "SAME_COMMUNITY",
          "ATTENDED_SAME_EVENT",
          "COLLABORATED",
          "FOLLOWING",
          "IMPORTED_CONNECTION",
        ]),
        strength: z.number().positive().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1),
});

export const createInterestCheckSchema = z.object({
  creatorSagaUserId: z.string().optional(),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  city: z.string().optional(),
  fandoms: stringArray,
  proposedTiming: z.string().optional(),
  thresholdType: z
    .enum(["INTERESTED_COUNT", "TICKET_PLEDGE", "ADMIN_APPROVAL"])
    .default("INTERESTED_COUNT"),
  thresholdValue: z.number().int().positive().optional(),
});

export const interestCheckInterestSchema = z.object({
  sagaUserId: z.string().optional(),
  personId: z.string().optional(),
  autoConvert: z.boolean().default(false),
});

function clean<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

export function safePerson(
  person: Person & { creatorProfile?: CreatorProfile | null },
) {
  return {
    id: person.id,
    sagaUserId: person.sagaUserId,
    name: person.name,
    phoneConfigured: Boolean(person.phone),
    emailConfigured: Boolean(person.email),
    city: person.city,
    source: person.source,
    consentStatus: person.consentStatus,
    optedOut: person.optedOut,
    creatorProfile: person.creatorProfile
      ? {
          id: person.creatorProfile.id,
          displayName: person.creatorProfile.displayName,
          city: person.creatorProfile.city,
          roles: person.creatorProfile.roles,
          skills: person.creatorProfile.skills,
          fandoms: person.creatorProfile.fandoms,
          communities: person.creatorProfile.communities,
          portfolioUrls: person.creatorProfile.portfolioUrls,
          socialUrls: person.creatorProfile.socialUrls,
          preferredOpportunityTypes:
            person.creatorProfile.preferredOpportunityTypes,
          reviewStatus: person.creatorProfile.reviewStatus,
        }
      : null,
  };
}

export function safeProject(project: Project) {
  return {
    id: project.id,
    source: project.source,
    existingSagaEventId: project.existingSagaEventId,
    existingSagaCommunityId: project.existingSagaCommunityId,
    organizerPersonId: project.organizerPersonId,
    title: project.title,
    description: project.description,
    city: project.city,
    targetDate: project.targetDate,
    budgetRange: project.budgetRange,
    audience: project.audience,
    fandoms: project.fandoms,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function safeOpportunity(
  opportunity: Opportunity & {
    roleOpening: RoleOpening & { project: Project };
    recommendations?: CandidateRecommendation[];
  },
) {
  return {
    id: opportunity.id,
    status: opportunity.status,
    visibility: opportunity.visibility,
    applicationMode: opportunity.applicationMode,
    roleOpening: {
      id: opportunity.roleOpening.id,
      roleType: opportunity.roleOpening.roleType,
      title: opportunity.roleOpening.title,
      description: opportunity.roleOpening.description,
      requiredSkills: opportunity.roleOpening.requiredSkills,
      preferredFandoms: opportunity.roleOpening.preferredFandoms,
      compensationType: opportunity.roleOpening.compensationType,
      budgetRange: opportunity.roleOpening.budgetRange,
      quantityNeeded: opportunity.roleOpening.quantityNeeded,
      remoteAllowed: opportunity.roleOpening.remoteAllowed,
      locationRequirement: opportunity.roleOpening.locationRequirement,
    },
    project: safeProject(opportunity.roleOpening.project),
    interestStatus: opportunity.recommendations?.[0]?.status,
  };
}

export function safeRecommendation(
  recommendation: CandidateRecommendation & {
    person: Person & { creatorProfile: CreatorProfile | null };
    opportunity: Opportunity & { roleOpening: RoleOpening };
  },
) {
  return {
    id: recommendation.id,
    opportunityId: recommendation.opportunityId,
    personId: recommendation.personId,
    score: recommendation.score,
    scoreBreakdown: recommendation.scoreBreakdown,
    proximityTier: recommendation.proximityTier,
    matchingReasons: recommendation.matchingReasons,
    risks: recommendation.risks,
    status: recommendation.status,
    candidate: safePerson(recommendation.person),
    roleOpening: {
      id: recommendation.opportunity.roleOpening.id,
      roleType: recommendation.opportunity.roleOpening.roleType,
      title: recommendation.opportunity.roleOpening.title,
    },
  };
}

export async function upsertSagaUser(input: z.infer<typeof upsertSagaUserSchema>) {
  const db = getDb();
  const data = upsertSagaUserSchema.parse(input);
  const profileInput = data.profile || {};
  const person = await db.person.upsert({
    where: { sagaUserId: data.sagaUserId },
    update: clean({
      name: data.name,
      phone: data.phone ? normalizePhone(data.phone) : undefined,
      email: data.email,
      city: data.city,
      source: "APP",
    }),
    create: {
      sagaUserId: data.sagaUserId,
      name: data.name,
      phone: data.phone ? normalizePhone(data.phone) : undefined,
      email: data.email,
      city: data.city,
      source: "APP",
      consentStatus: data.phone ? "IMPLIED" : "UNKNOWN",
    },
  });

  const profileFields = {
    displayName: profileInput.displayName || data.name,
    bio: profileInput.bio,
    city: profileInput.city || data.city,
    roles: profileInput.roles || data.roles || [],
    skills: profileInput.skills || data.skills || data.roles || [],
    fandoms: profileInput.fandoms || data.fandoms || [],
    communities: profileInput.communities || data.communities || [],
    portfolioUrls: profileInput.portfolioUrls || data.portfolioUrls || [],
    socialUrls: profileInput.socialUrls || data.socialUrls || [],
    availabilityNotes: profileInput.availabilityNotes,
    rateNotes: profileInput.rateNotes,
    preferredOpportunityTypes: profileInput.preferredOpportunityTypes || [],
  };

  const shouldCreateProfile =
    Object.values(profileFields).some((value) =>
      Array.isArray(value) ? value.length > 0 : Boolean(value),
    );

  if (shouldCreateProfile) {
    await db.creatorProfile.upsert({
      where: { personId: person.id },
      update: profileFields,
      create: {
        personId: person.id,
        ...profileFields,
        reviewStatus: "PENDING_REVIEW",
      },
    });
  }

  const full = await db.person.findUniqueOrThrow({
    where: { id: person.id },
    include: { creatorProfile: true },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: "internal_api.user_upserted",
    entityType: "Person",
    entityId: person.id,
    metadata: { sagaUserId: data.sagaUserId },
  });

  return safePerson(full);
}

export async function importSagaEvent(input: z.infer<typeof importSagaEventSchema>) {
  const db = getDb();
  const data = importSagaEventSchema.parse(input);
  const organizer = data.organizerSagaUserId
    ? await db.person.upsert({
        where: { sagaUserId: data.organizerSagaUserId },
        update: { source: "APP" },
        create: {
          sagaUserId: data.organizerSagaUserId,
          source: "APP",
          consentStatus: "UNKNOWN",
        },
      })
    : null;

  const project = await db.project.upsert({
    where: { existingSagaEventId: data.existingSagaEventId },
    update: {
      source: data.source,
      existingSagaCommunityId: data.existingSagaCommunityId,
      organizerPersonId: organizer?.id,
      title: data.title,
      description: data.description,
      city: data.city,
      targetDate: data.targetDate,
      fandoms: data.fandoms,
      status: "BRIEF_READY",
    },
    create: {
      existingSagaEventId: data.existingSagaEventId,
      source: data.source,
      existingSagaCommunityId: data.existingSagaCommunityId,
      organizerPersonId: organizer?.id,
      title: data.title,
      description: data.description,
      city: data.city,
      targetDate: data.targetDate,
      fandoms: data.fandoms,
      status: "BRIEF_READY",
    },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: "internal_api.event_imported",
    entityType: "Project",
    entityId: project.id,
    metadata: {
      existingSagaEventId: data.existingSagaEventId,
      ticketingEnabled: data.ticketingEnabled,
      rsvpEnabled: data.rsvpEnabled,
    },
  });

  return safeProject(project);
}

export async function createOrUpdateRoleOpenings(
  projectId: string,
  input: z.infer<typeof roleOpeningsRequestSchema>,
) {
  const db = getDb();
  const data = roleOpeningsRequestSchema.parse(input);
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new InternalApiError(404, "Project not found.");
  }
  const roleOpenings = [];

  for (const opening of data.roleOpenings) {
    const requiredSkills = opening.requiredSkills || opening.skills || [];
    const preferredFandoms = opening.preferredFandoms || opening.fandoms || project.fandoms;
    const existing =
      (opening.id
        ? await db.roleOpening.findFirst({
            where: { id: opening.id, projectId },
          })
        : null) ||
      (await db.roleOpening.findFirst({
        where: { projectId, roleType: opening.roleType },
      }));

    const saved = existing
      ? await db.roleOpening.update({
          where: { id: existing.id },
          data: {
            roleType: opening.roleType,
            title: opening.title,
            description: opening.description,
            requiredSkills,
            preferredFandoms,
            compensationType: opening.compensationType,
            budgetRange: opening.budgetRange,
            quantityNeeded: opening.quantityNeeded,
            remoteAllowed: opening.remoteAllowed,
            locationRequirement: opening.locationRequirement,
            status: data.publish || opening.publish ? "OPEN" : existing.status,
          },
        })
      : await db.roleOpening.create({
          data: {
            projectId,
            roleType: opening.roleType,
            title: opening.title,
            description: opening.description,
            requiredSkills,
            preferredFandoms,
            compensationType: opening.compensationType,
            budgetRange: opening.budgetRange,
            quantityNeeded: opening.quantityNeeded,
            remoteAllowed: opening.remoteAllowed,
            locationRequirement: opening.locationRequirement,
            status: data.publish || opening.publish ? "OPEN" : "DRAFT",
          },
        });

    if (data.publish || opening.publish) {
      const opportunity = await db.opportunity.findFirst({
        where: { roleOpeningId: saved.id },
      });
      if (opportunity) {
        await db.opportunity.update({
          where: { id: opportunity.id },
          data: { status: "ACTIVE", applicationMode: "INVITE_AND_APPLY" },
        });
      } else {
        await db.opportunity.create({
          data: {
            roleOpeningId: saved.id,
            visibility: "COMMUNITY",
            applicationMode: "INVITE_AND_APPLY",
            status: "ACTIVE",
          },
        });
      }
    }

    roleOpenings.push(saved);
  }

  await db.project.update({
    where: { id: projectId },
    data: { status: data.publish ? "RECRUITING" : "ROLE_MAPPING" },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: "internal_api.role_openings_upserted",
    entityType: "Project",
    entityId: projectId,
    metadata: { count: roleOpenings.length, publish: data.publish },
  });

  return roleOpenings;
}

export async function recommendationsForProject(projectId: string) {
  const db = getDb();
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { roleOpenings: { include: { opportunities: true } } },
  });
  if (!project) {
    throw new InternalApiError(404, "Project not found.");
  }
  const groups = [];

  for (const roleOpening of project.roleOpenings) {
    let opportunity = roleOpening.opportunities[0];
    if (!opportunity) {
      opportunity = await db.opportunity.create({
        data: {
          roleOpeningId: roleOpening.id,
          visibility: "PRIVATE",
          applicationMode: "INVITE_AND_APPLY",
          status: "ACTIVE",
        },
      });
    }
    await runCandidateRecommendations(opportunity.id);
    const recommendations = await db.candidateRecommendation.findMany({
      where: { opportunityId: opportunity.id },
      include: {
        person: { include: { creatorProfile: true } },
        opportunity: { include: { roleOpening: true } },
      },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      take: 20,
    });
    groups.push({
      roleOpening: {
        id: roleOpening.id,
        roleType: roleOpening.roleType,
        title: roleOpening.title,
      },
      opportunityId: opportunity.id,
      recommendations: recommendations.map(safeRecommendation),
    });
  }

  return {
    project: safeProject(project),
    groups,
  };
}

export async function listActiveOpportunities(query: URLSearchParams) {
  const db = getDb();
  const city = query.get("city")?.toLowerCase();
  const fandom = query.get("fandom")?.toLowerCase();
  const role = query.get("role")?.toLowerCase();
  const sagaUserId = query.get("sagaUserId");
  const personId =
    query.get("personId") ||
    (sagaUserId
      ? (
          await db.person.findUnique({
            where: { sagaUserId },
            select: { id: true },
          })
        )?.id
      : null);

  const opportunities = await db.opportunity.findMany({
    where: { status: "ACTIVE" },
    include: {
      roleOpening: { include: { project: true } },
      recommendations: personId
        ? {
            where: { personId },
            take: 1,
          }
        : false,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return opportunities
    .filter((opportunity) => {
      const project = opportunity.roleOpening.project;
      if (city && project.city?.toLowerCase() !== city) return false;
      if (
        fandom &&
        !project.fandoms.some((item) => item.toLowerCase() === fandom) &&
        !opportunity.roleOpening.preferredFandoms.some(
          (item) => item.toLowerCase() === fandom,
        )
      ) {
        return false;
      }
      if (
        role &&
        ![
          opportunity.roleOpening.roleType,
          opportunity.roleOpening.title,
          ...opportunity.roleOpening.requiredSkills,
        ]
          .join(" ")
          .toLowerCase()
          .includes(role)
      ) {
        return false;
      }
      return true;
    })
    .map(safeOpportunity);
}

export async function markOpportunityInterest(
  opportunityId: string,
  input: z.infer<typeof opportunityInterestSchema>,
) {
  const db = getDb();
  const data = opportunityInterestSchema.parse(input);
  const opportunity = await db.opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true },
  });
  if (!opportunity) {
    throw new InternalApiError(404, "Opportunity not found.");
  }
  const person = data.personId
    ? await db.person.findUnique({ where: { id: data.personId } })
    : await db.person.upsert({
        where: { sagaUserId: data.sagaUserId as string },
        update: { source: "APP" },
        create: {
          sagaUserId: data.sagaUserId,
          source: "APP",
          consentStatus: "UNKNOWN",
        },
      });
  if (!person) {
    throw new InternalApiError(404, "Person not found.");
  }

  const recommendation = await db.candidateRecommendation.upsert({
    where: {
      opportunityId_personId: {
        opportunityId,
        personId: person.id,
      },
    },
    update: {
      status: "INTERESTED",
      matchingReasons: { push: "Expressed interest in Saga app" },
    },
    create: {
      opportunityId,
      personId: person.id,
      score: 0,
      scoreBreakdown: {
        proximity: 0,
        roleFit: 0,
        fandomFit: 0,
        location: 0,
        reliability: 0,
      },
      proximityTier: "UNKNOWN",
      matchingReasons: ["Expressed interest in Saga app"],
      risks: ["Needs human approval before team placement"],
      status: "INTERESTED",
    },
  });

  await logAudit({
    actorType: "USER",
    action: "internal_api.opportunity_interest",
    entityType: "Opportunity",
    entityId: opportunityId,
    metadata: {
      personId: person.id,
      sagaUserId: data.sagaUserId,
      message: data.message,
      availability: data.availability,
    },
  });

  return { recommendationId: recommendation.id, status: recommendation.status };
}

export async function importRelationshipEdges(
  input: z.infer<typeof importRelationshipsSchema>,
) {
  const db = getDb();
  const data = importRelationshipsSchema.parse(input);
  const edges = [];

  for (const edge of data.edges) {
    const [fromPerson, toPerson] = await Promise.all([
      db.person.upsert({
        where: { sagaUserId: edge.fromSagaUserId },
        update: { source: "APP" },
        create: {
          sagaUserId: edge.fromSagaUserId,
          source: "APP",
          consentStatus: "UNKNOWN",
        },
      }),
      db.person.upsert({
        where: { sagaUserId: edge.toSagaUserId },
        update: { source: "APP" },
        create: {
          sagaUserId: edge.toSagaUserId,
          source: "APP",
          consentStatus: "UNKNOWN",
        },
      }),
    ]);

    edges.push(
      await db.relationshipEdge.upsert({
        where: {
          fromPersonId_toPersonId_relationshipType: {
            fromPersonId: fromPerson.id,
            toPersonId: toPerson.id,
            relationshipType: edge.relationshipType,
          },
        },
        update: {
          strength: edge.strength || 1,
          metadata: edge.metadata as Prisma.InputJsonValue,
        },
        create: {
          fromPersonId: fromPerson.id,
          toPersonId: toPerson.id,
          relationshipType: edge.relationshipType,
          strength: edge.strength || 1,
          metadata: edge.metadata as Prisma.InputJsonValue,
        },
      }),
    );
  }

  await logAudit({
    actorType: "SYSTEM",
    action: "internal_api.relationships_imported",
    entityType: "RelationshipEdge",
    entityId: "batch",
    metadata: { count: edges.length },
  });

  return edges;
}

export async function createInternalInterestCheck(
  input: z.infer<typeof createInterestCheckSchema>,
) {
  const db = getDb();
  const data = createInterestCheckSchema.parse(input);
  const creator = data.creatorSagaUserId
    ? await db.person.upsert({
        where: { sagaUserId: data.creatorSagaUserId },
        update: { source: "APP" },
        create: {
          sagaUserId: data.creatorSagaUserId,
          source: "APP",
          consentStatus: "UNKNOWN",
        },
      })
    : null;

  const check = await db.interestCheck.create({
    data: {
      creatorPersonId: creator?.id,
      title: data.title,
      description: data.description,
      city: data.city,
      fandoms: data.fandoms,
      proposedTiming: data.proposedTiming,
      thresholdType: data.thresholdType,
      thresholdValue: data.thresholdValue,
      status: "ACTIVE",
    },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: "internal_api.interest_check_created",
    entityType: "InterestCheck",
    entityId: check.id,
    metadata: { creatorSagaUserId: data.creatorSagaUserId },
  });

  return check;
}

async function hasRecordedInterest({
  interestCheckId,
  personId,
  sagaUserId,
}: {
  interestCheckId: string;
  personId?: string | null;
  sagaUserId?: string | null;
}) {
  if (!personId && !sagaUserId) return false;
  const logs = await getDb().auditLog.findMany({
    where: {
      entityType: "InterestCheck",
      entityId: interestCheckId,
      action: "internal_api.interest_check_interest",
    },
    take: 200,
    orderBy: { createdAt: "desc" },
  });
  return logs.some((log) => {
    if (!log.metadata || typeof log.metadata !== "object" || Array.isArray(log.metadata)) {
      return false;
    }
    const metadata = log.metadata as Record<string, unknown>;
    return metadata.personId === personId || metadata.sagaUserId === sagaUserId;
  });
}

export async function recordInterestCheckInterest(
  interestCheckId: string,
  input: z.input<typeof interestCheckInterestSchema>,
) {
  const db = getDb();
  const data = interestCheckInterestSchema.parse(input);
  const existingCheck = await db.interestCheck.findUnique({
    where: { id: interestCheckId },
    select: { id: true },
  });
  if (!existingCheck) {
    throw new InternalApiError(404, "Interest check not found.");
  }
  const person = data.personId
    ? await db.person.findUnique({ where: { id: data.personId } })
    : data.sagaUserId
      ? await db.person.upsert({
          where: { sagaUserId: data.sagaUserId },
          update: { source: "APP" },
          create: {
            sagaUserId: data.sagaUserId,
            source: "APP",
            consentStatus: "UNKNOWN",
          },
        })
      : null;
  if (data.personId && !person) {
    throw new InternalApiError(404, "Person not found.");
  }

  const alreadyRecorded = await hasRecordedInterest({
    interestCheckId,
    personId: person?.id,
    sagaUserId: data.sagaUserId,
  });
  const check = alreadyRecorded
    ? await db.interestCheck.findUniqueOrThrow({ where: { id: interestCheckId } })
    : await addInterestToCheck(interestCheckId, 1);

  await logAudit({
    actorType: "USER",
    action: "internal_api.interest_check_interest",
    entityType: "InterestCheck",
    entityId: interestCheckId,
    metadata: {
      personId: person?.id,
      sagaUserId: data.sagaUserId,
      alreadyRecorded,
    },
  });

  if (data.autoConvert && check.status === "THRESHOLD_MET") {
    const projectId = await convertInterestCheckToProject(interestCheckId);
    return { interestCheck: check, convertedProjectId: projectId };
  }

  return { interestCheck: check, convertedProjectId: null };
}

export async function convertInternalInterestCheck(interestCheckId: string) {
  const projectId = await convertInterestCheckToProject(interestCheckId);
  const project = await getDb().project.findUniqueOrThrow({
    where: { id: projectId },
  });
  return safeProject(project);
}
