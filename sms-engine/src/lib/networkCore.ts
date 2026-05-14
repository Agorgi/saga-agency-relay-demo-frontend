import type {
  CandidateRecommendationStatus,
  CompensationType,
  NetworkProjectSource,
  OutreachStatus,
  PersonSource,
  Prisma,
  Project,
  RoleOpening,
} from "@prisma/client";
import { redactPhoneForDisplay } from "@/lib/adminPrivacy";
import { logAudit } from "@/lib/audit";
import {
  contactReplyGeneratedReplySchema,
  type ConversationContext,
  type ContactReplyGeneratedReply,
  type GigSeekerGeneratedReply,
  type GigSeekerKnownFields,
  type ReplyPlan,
} from "@/lib/conversation/conversationTypes";
import { adminDevDeterministicLlmUnavailableMetadata } from "@/lib/conversation/adminDevLlmReplies";
import { generateContactReplyFromPlan } from "@/lib/conversation/contactReplyGenerator";
import { evaluateContactReplyPolicy } from "@/lib/conversation/contactReplyPolicy";
import { prepareGigSeekerProfileForMockAdmin } from "@/lib/conversation/gigSeekerProfilePreparation";
import { getDb } from "@/lib/db";
import { sendSmsMessage } from "@/lib/messages";
import { getMessagingProvider } from "@/lib/messagingProvider";
import { normalizePhone } from "@/lib/phone";
import { escalationHoldingReply } from "@/lib/safety";
import {
  assertCandidateRecommendationStatusTransition,
  assertInterestCheckStatusTransition,
  assertOutreachStatusTransition,
  assertProductionConversationStatusTransition,
  assertProjectStatusTransition,
  assertTeamMemberStatusTransition,
  assertTeamStatusTransition,
  logWorkflowTransition,
} from "@/lib/workflowStateMachine";

type RoleTemplate = {
  roleType: string;
  title: string;
  description: string;
  requiredSkills: string[];
  preferredFandoms?: string[];
  compensationType?: CompensationType;
};

const commonRoleTemplates: RoleTemplate[] = [
  {
    roleType: "venue",
    title: "Venue Partner",
    description: "Helps identify a realistic space and day-of venue needs.",
    requiredSkills: ["venue", "space", "operations"],
  },
  {
    roleType: "photographer",
    title: "Photographer",
    description: "Captures key moments, creators, and promotional content.",
    requiredSkills: ["photography", "content", "events"],
  },
  {
    roleType: "videographer",
    title: "Videographer",
    description: "Captures short-form video, recap footage, or creator clips.",
    requiredSkills: ["video", "content", "camera"],
  },
  {
    roleType: "dj",
    title: "DJ",
    description: "Shapes music, pacing, and energy for the room.",
    requiredSkills: ["music", "audio", "nightlife"],
  },
  {
    roleType: "host",
    title: "Host",
    description: "Keeps the experience warm, clear, and on schedule.",
    requiredSkills: ["hosting", "community", "performance"],
  },
  {
    roleType: "guest cosplayer",
    title: "Guest Cosplayer",
    description: "Brings fandom alignment, community draw, and creator energy.",
    requiredSkills: ["cosplay", "costume", "community"],
  },
  {
    roleType: "illustrator",
    title: "Illustrator",
    description: "Creates artwork, poster assets, merch, or visual identity.",
    requiredSkills: ["illustration", "art", "visual"],
  },
  {
    roleType: "graphic designer",
    title: "Graphic Designer",
    description: "Designs event graphics, posts, signage, and brand assets.",
    requiredSkills: ["design", "graphics", "branding"],
  },
  {
    roleType: "volunteer coordinator",
    title: "Volunteer Coordinator",
    description: "Coordinates helpers, shifts, arrival windows, and day-of coverage.",
    requiredSkills: ["volunteers", "staffing", "operations"],
  },
  {
    roleType: "vendor coordinator",
    title: "Vendor Coordinator",
    description: "Coordinates vendors, booth needs, and setup expectations.",
    requiredSkills: ["vendor", "market", "partners"],
  },
  {
    roleType: "production assistant",
    title: "Production Assistant",
    description: "Supports logistics, checklists, setup, and communication.",
    requiredSkills: ["production", "operations", "logistics"],
  },
  {
    roleType: "sponsor partner",
    title: "Sponsor / Brand Partner",
    description: "Helps shape aligned brand or sponsor participation.",
    requiredSkills: ["brand", "sponsor", "partnerships"],
  },
];

const riskyPattern =
  /\b(contract|deposit|payment dispute|permit|insurance|alcohol|security|medical|minor|weapon|illegal|guarantee|revenue|celebrity|influencer)\b/i;

function listFromText(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(/[,|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function empty(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function unique(items: Array<string | null | undefined>) {
  return [...new Set(items.filter((item): item is string => Boolean(item)))];
}

function parseNetworkProjectSource(value: string | null): NetworkProjectSource {
  const sources: NetworkProjectSource[] = [
    "SMS",
    "MOBILE_APP",
    "WEB_APP",
    "ADMIN",
    "INTEREST_CHECK",
    "IMPORT",
  ];
  return sources.includes(value as NetworkProjectSource)
    ? (value as NetworkProjectSource)
    : "ADMIN";
}

function inferFandoms(text: string) {
  const lower = text.toLowerCase();
  const fandoms = [
    ["anime", "anime"],
    ["cosplay", "cosplay"],
    ["gaming", "gaming"],
    ["game", "gaming"],
    ["k-pop", "K-pop"],
    ["kpop", "K-pop"],
    ["horror", "horror"],
    ["fantasy", "fantasy"],
    ["comic", "comics"],
    ["maid cafe", "maid cafe"],
  ];
  return unique(
    fandoms
      .filter(([needle]) => lower.includes(needle))
      .map(([, value]) => value),
  );
}

function inferRoles(text: string) {
  const lower = text.toLowerCase();
  return commonRoleTemplates.filter((role) => {
    const haystack = [role.roleType, role.title, ...role.requiredSkills]
      .join(" ")
      .toLowerCase();
    return haystack
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .some((word) => lower.includes(word));
  });
}

export function extractCreatorOnboardingFields(body: string) {
  const urls: string[] = body.match(/https?:\/\/\S+|@\w[\w.]+/gi) || [];
  const cityMatch =
    body.match(
      /\bin\s+([A-Za-z .-]+?)(?:$|,|\.|\s+for|\s+and|\s+looking|\s+seeking)/i,
    )?.[1] ||
    (/\bLA\b/i.test(body) ? "Los Angeles" : null) ||
    (/\bNYC\b/i.test(body) ? "New York" : null);
  const roles = unique([...inferRoles(body).map((role) => role.roleType)]);
  const fandoms = inferFandoms(body);
  const opportunityTypes = /paid/i.test(body)
    ? ["paid"]
    : /volunteer|collab/i.test(body)
      ? ["volunteer", "collab"]
      : [];

  return {
    needsAdmin: riskyPattern.test(body),
    urls,
    city: cityMatch,
    roles,
    fandoms,
    opportunityTypes,
  };
}

function defaultRolesForProject(project: Pick<Project, "description" | "title" | "fandoms">) {
  const text = [project.title, project.description, ...project.fandoms]
    .filter(Boolean)
    .join(" ");
  const inferred = inferRoles(text);
  const defaults = [
    commonRoleTemplates.find((role) => role.roleType === "production assistant"),
    commonRoleTemplates.find((role) => role.roleType === "photographer"),
    commonRoleTemplates.find((role) => role.roleType === "venue"),
  ].filter((role): role is RoleTemplate => Boolean(role));

  return unique([...inferred, ...defaults].map((role) => role.roleType))
    .map((roleType) =>
      commonRoleTemplates.find((template) => template.roleType === roleType),
    )
    .filter((role): role is RoleTemplate => Boolean(role))
    .slice(0, 6);
}

export async function upsertPerson({
  phone,
  email,
  name,
  city,
  source = "ADMIN",
  consentStatus,
}: {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  city?: string | null;
  source?: PersonSource;
  consentStatus?: "UNKNOWN" | "IMPLIED" | "EXPLICIT" | "OPTED_OUT";
}) {
  const db = getDb();
  const normalizedPhone = phone ? normalizePhone(phone) : null;
  const existing = normalizedPhone
    ? await db.person.findUnique({ where: { phone: normalizedPhone } })
    : email
      ? await db.person.findUnique({ where: { email } })
      : null;

  if (existing) {
    return db.person.update({
      where: { id: existing.id },
      data: {
        name: name || existing.name,
        city: city || existing.city,
        email: email || existing.email,
        source,
        ...(consentStatus ? { consentStatus } : {}),
      },
    });
  }

  return db.person.create({
    data: {
      phone: normalizedPhone,
      email,
      name,
      city,
      source,
      consentStatus: consentStatus || "UNKNOWN",
    },
  });
}

export async function handleCreatorOnboardingDemo({
  phone,
  body,
  conversationReplyPlan,
  conversationGeneratedReply,
  conversationKnownFields,
  conversationMissingRequiredFields = [],
  conversationMissingOptionalFields = [],
}: {
  phone: string;
  body: string;
  conversationReplyPlan?: ReplyPlan | null;
  conversationGeneratedReply?: GigSeekerGeneratedReply | null;
  conversationKnownFields?: GigSeekerKnownFields | null;
  conversationMissingRequiredFields?: string[];
  conversationMissingOptionalFields?: string[];
}) {
  const db = getDb();
  const person = await upsertPerson({
    phone,
    source: "SMS",
    consentStatus: "IMPLIED",
  });
  const existingProfile = await db.creatorProfile.findUnique({
    where: { personId: person.id },
  });

  await db.message.create({
    data: {
      direction: "INBOUND",
      channel: "SMS",
      body,
      metadata: {
        provider: "mock",
        flow: "creator_onboarding",
        personId: person.id,
      },
    },
  });

  if (
    conversationReplyPlan &&
    conversationGeneratedReply &&
    conversationKnownFields
  ) {
    const prepared = conversationReplyPlan.shouldEscalate
      ? null
      : await prepareGigSeekerProfileForMockAdmin({
          phone,
          knownFields: conversationKnownFields,
          missingRequiredFields: conversationMissingRequiredFields,
          replyPlan: conversationReplyPlan,
          generatedReply: conversationGeneratedReply,
        });

    const reply = conversationGeneratedReply.replyText;
    await sendSmsMessage({
      to: normalizePhone(phone),
      body: reply,
      provider: "MOCK",
      metadata: {
        flow: "creator_onboarding",
        generatedBy: "conversation_engine",
        conversationEngineActive: true,
        conversationReplyType: conversationGeneratedReply.replyType,
        conversationReplySource: conversationGeneratedReply.source,
        conversationReplySourceDetail:
          conversationGeneratedReply.metadata.replySourceDetail,
        llmOperation: conversationGeneratedReply.metadata.llmOperation,
        llmOperationUnavailable:
          conversationGeneratedReply.metadata.llmOperationUnavailable,
        llmMode: conversationGeneratedReply.metadata.llmMode,
        llmExecutionSurface:
          conversationGeneratedReply.metadata.llmExecutionSurface,
        llmValidationPassed:
          conversationGeneratedReply.metadata.llmValidationPassed,
        llmFallbackUsed: conversationGeneratedReply.metadata.llmFallbackUsed,
        llmFallbackReason:
          conversationGeneratedReply.metadata.llmFallbackReason,
        forbiddenClaimsDetected:
          conversationGeneratedReply.metadata.forbiddenClaimsDetected,
        personId: prepared?.person.id || person.id,
        creatorProfileId: prepared?.profile.id || existingProfile?.id,
        profilePrepared: Boolean(prepared),
      },
    });

    await logAudit({
      actorType: "SYSTEM",
      action: "conversation.gig_seeker_reply_plan_applied",
      entityType: prepared?.profile ? "CreatorProfile" : "Person",
      entityId: prepared?.profile.id || person.id,
      metadata: {
        flow: conversationReplyPlan.flow,
        stage: conversationReplyPlan.stage,
        nextStage: conversationReplyPlan.nextStage,
        replyType: conversationGeneratedReply.replyType,
        source: conversationGeneratedReply.source,
        conversationReplySourceDetail:
          conversationGeneratedReply.metadata.replySourceDetail,
        llmOperation: conversationGeneratedReply.metadata.llmOperation,
        llmOperationUnavailable:
          conversationGeneratedReply.metadata.llmOperationUnavailable,
        llmMode: conversationGeneratedReply.metadata.llmMode,
        llmExecutionSurface:
          conversationGeneratedReply.metadata.llmExecutionSurface,
        llmValidationPassed:
          conversationGeneratedReply.metadata.llmValidationPassed,
        llmFallbackUsed: conversationGeneratedReply.metadata.llmFallbackUsed,
        llmFallbackReason:
          conversationGeneratedReply.metadata.llmFallbackReason,
        forbiddenClaimsDetected:
          conversationGeneratedReply.metadata.forbiddenClaimsDetected,
        enoughInfoForProfileReview:
          conversationReplyPlan.enoughInfoForProfileReview,
        missingRequiredFields: conversationMissingRequiredFields,
        missingOptionalFields: conversationMissingOptionalFields,
        confidence: conversationReplyPlan.confidence,
        senderRedacted: redactPhoneForDisplay(phone),
      },
    });

    return {
      person: prepared?.person || person,
      profile: prepared?.profile || existingProfile,
      reply,
    };
  }

  if (riskyPattern.test(body)) {
    const reply = escalationHoldingReply();
    await sendSmsMessage({
      to: normalizePhone(phone),
      body: reply,
      provider: "MOCK",
      metadata: {
        flow: "creator_onboarding",
        personId: person.id,
        reason: "safety_escalation",
      },
    });
    return { person, profile: existingProfile, reply };
  }

  const {
    urls,
    city: cityMatch,
    roles,
    fandoms,
    opportunityTypes,
  } = extractCreatorOnboardingFields(body);

  const updatedPerson = cityMatch
    ? await db.person.update({
        where: { id: person.id },
        data: { city: cityMatch },
      })
    : person;

  const profile = await db.creatorProfile.upsert({
    where: { personId: person.id },
    update: {
      displayName: existingProfile?.displayName || updatedPerson.name,
      city: cityMatch || existingProfile?.city || updatedPerson.city,
      roles: unique([...(existingProfile?.roles || []), ...roles]),
      skills: unique([...(existingProfile?.skills || []), ...roles]),
      fandoms: unique([...(existingProfile?.fandoms || []), ...fandoms]),
      socialUrls: unique([...(existingProfile?.socialUrls || []), ...urls]),
      preferredOpportunityTypes: unique([
        ...(existingProfile?.preferredOpportunityTypes || []),
        ...opportunityTypes,
      ]),
      reviewStatus: "PENDING_REVIEW",
    },
    create: {
      personId: person.id,
      displayName: updatedPerson.name,
      city: cityMatch || updatedPerson.city,
      roles,
      skills: roles,
      fandoms,
      communities: fandoms,
      portfolioUrls: urls.filter((url) => url.startsWith("http")),
      socialUrls: urls,
      preferredOpportunityTypes: opportunityTypes,
      reviewStatus: "PENDING_REVIEW",
    },
  });

  const reply = nextCreatorOnboardingReply(updatedPerson, profile);
  await sendSmsMessage({
    to: normalizePhone(phone),
    body: reply,
    provider: "MOCK",
    metadata: {
      flow: "creator_onboarding",
      personId: person.id,
      creatorProfileId: profile.id,
    },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: "creator_profile.demo_onboarded",
    entityType: "CreatorProfile",
    entityId: profile.id,
    metadata: { personId: person.id },
  });

  return { person: updatedPerson, profile, reply };
}

function nextCreatorOnboardingReply(
  person: { city: string | null },
  profile: {
    city: string | null;
    roles: string[];
    fandoms: string[];
    socialUrls: string[];
    preferredOpportunityTypes: string[];
  },
) {
  if (!person.city && !profile.city) {
    return "Amazing. What city are you based in, and where would you want gigs?";
  }
  if (profile.roles.length === 0) {
    return "What kinds of gigs do you want Saga to match you with? Photographer, DJ, cosplayer, artist, designer, vendor support, something else?";
  }
  if (profile.socialUrls.length === 0) {
    return "Send a portfolio, Instagram, website, or any link that helps Saga understand your work.";
  }
  if (profile.fandoms.length === 0) {
    return "What fandoms, scenes, or communities do you know best?";
  }
  if (profile.preferredOpportunityTypes.length === 0) {
    return "Do you prefer paid gigs only, volunteer/collab opportunities, or both?";
  }
  return "Amazing - I'm going to turn this into a Saga creator profile so we can match you with relevant opportunities. A human on the Saga team may review it before we start recommending you.";
}

export async function createNetworkProjectFromForm(formData: FormData) {
  const organizerPhone = empty(formData.get("organizerPhone"));
  const organizer = organizerPhone
    ? await upsertPerson({
        phone: organizerPhone,
        name: empty(formData.get("organizerName")),
        city: empty(formData.get("city")),
        source: "ADMIN",
        consentStatus: "IMPLIED",
      })
    : null;

  const projectData = {
      source: parseNetworkProjectSource(empty(formData.get("source"))),
      existingSagaEventId: empty(formData.get("existingSagaEventId")),
      existingSagaCommunityId: empty(formData.get("existingSagaCommunityId")),
      organizerPersonId: organizer?.id,
      title: empty(formData.get("title")),
      description: empty(formData.get("description")),
      city: empty(formData.get("city")),
      targetDate: empty(formData.get("targetDate")),
      budgetRange: empty(formData.get("budgetRange")),
      audience: empty(formData.get("audience")),
      fandoms: listFromText(empty(formData.get("fandoms"))),
      status: "BRIEF_READY",
  } as const;
  const db = getDb();
  const project = projectData.existingSagaEventId
    ? await db.project.upsert({
        where: { existingSagaEventId: projectData.existingSagaEventId },
        update: projectData,
        create: projectData,
      })
    : await db.project.create({ data: projectData });

  await generateRoleOpeningsForProject(project.id);
  return project;
}

export async function generateRoleOpeningsForProject(projectId: string) {
  const db = getDb();
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
  });
  const templates = defaultRolesForProject(project);
  const openings: RoleOpening[] = [];

  for (const template of templates) {
    const existing = await db.roleOpening.findFirst({
      where: {
        projectId,
        roleType: template.roleType,
      },
    });

    if (existing) {
      openings.push(existing);
    } else {
      openings.push(
        await db.roleOpening.create({
          data: {
            projectId,
            roleType: template.roleType,
            title: template.title,
          description: template.description,
          requiredSkills: template.requiredSkills,
          preferredFandoms: template.preferredFandoms || project.fandoms,
          locationRequirement: project.city,
            compensationType: template.compensationType || "UNKNOWN",
            status: "OPEN",
          },
        }),
      );
    }
  }

  assertProjectStatusTransition(project.status, "ROLE_MAPPING");
  await db.project.update({
    where: { id: projectId },
    data: { status: "ROLE_MAPPING" },
  });
  await logWorkflowTransition({
    action: "project.status_transitioned",
    entityType: "Project",
    entityId: projectId,
    fromStatus: project.status,
    toStatus: "ROLE_MAPPING",
    metadata: { reason: "role_openings_generated" },
  });

  return openings;
}

export async function createOpportunityForRoleOpening(roleOpeningId: string) {
  const opportunity = await getDb().opportunity.create({
    data: {
      roleOpeningId,
      visibility: "PRIVATE",
      applicationMode: "INVITE_AND_APPLY",
      status: "ACTIVE",
    },
  });
  return opportunity;
}

export async function createInterestCheckFromForm(formData: FormData) {
  const creatorPhone = empty(formData.get("creatorPhone"));
  const creator = creatorPhone
    ? await upsertPerson({
        phone: creatorPhone,
        source: "SMS",
        consentStatus: "IMPLIED",
      })
    : null;

  return getDb().interestCheck.create({
    data: {
      creatorPersonId: creator?.id,
      title: empty(formData.get("title")) || "Untitled interest check",
      description: empty(formData.get("description")) || "",
      city: empty(formData.get("city")),
      fandoms: listFromText(empty(formData.get("fandoms"))),
      proposedTiming: empty(formData.get("proposedTiming")),
      thresholdType: "INTERESTED_COUNT",
      thresholdValue: Number(empty(formData.get("thresholdValue")) || 10),
      status: "ACTIVE",
    },
  });
}

export async function addInterestToCheck(interestCheckId: string, count = 1) {
  const db = getDb();
  const updated = await db.interestCheck.update({
    where: { id: interestCheckId },
    data: {
      currentInterestCount: { increment: count },
    },
  });

  if (
    updated.thresholdValue &&
    updated.currentInterestCount >= updated.thresholdValue &&
    updated.status === "ACTIVE"
  ) {
    assertInterestCheckStatusTransition(updated.status, "THRESHOLD_MET");
    return db.interestCheck.update({
      where: { id: interestCheckId },
      data: { status: "THRESHOLD_MET" },
    });
  }

  return updated;
}

export async function convertInterestCheckToProject(interestCheckId: string) {
  const db = getDb();
  const check = await db.interestCheck.findUniqueOrThrow({
    where: { id: interestCheckId },
  });

  if (check.convertedProjectId) return check.convertedProjectId;
  assertInterestCheckStatusTransition(check.status, "CONVERTED_TO_PROJECT", {
    convertedProjectId: check.convertedProjectId,
  });

  const project = await db.project.create({
    data: {
      source: "INTEREST_CHECK",
      organizerPersonId: check.creatorPersonId,
      title: check.title,
      description: check.description,
      city: check.city,
      targetDate: check.proposedTiming,
      audience: `${check.currentInterestCount} interested`,
      fandoms: check.fandoms,
      status: "BRIEF_READY",
    },
  });

  await db.interestCheck.update({
    where: { id: interestCheckId },
    data: {
      status: "CONVERTED_TO_PROJECT",
      convertedProjectId: project.id,
    },
  });
  await logWorkflowTransition({
    action: "interest_check.status_transitioned",
    entityType: "InterestCheck",
    entityId: interestCheckId,
    fromStatus: check.status,
    toStatus: "CONVERTED_TO_PROJECT",
    metadata: { projectId: project.id },
  });
  await generateRoleOpeningsForProject(project.id);
  return project.id;
}

export function classifyCandidateReply(body: string) {
  const text = body.trim().toLowerCase();
  if (/\b(yes|yeah|yep|sure|interested|open|ok|okay|introduce|add me)\b/.test(text)) {
    return "YES";
  }
  if (/\b(no|nope|pass|not interested|can't|cannot|do not|don't)\b/.test(text)) {
    return "NO";
  }
  if (/\b(maybe|possibly|depends|send info|more info|not sure)\b/.test(text)) {
    return "MAYBE";
  }
  return "UNKNOWN";
}

type MockOutreachRecommendation = Prisma.CandidateRecommendationGetPayload<{
  include: {
    person: true;
    opportunity: {
      include: {
        roleOpening: {
          include: {
            project: true;
          };
        };
      };
    };
  };
}>;

async function ensureMockOutreachForRecommendation({
  recommendation,
  body,
}: {
  recommendation: MockOutreachRecommendation;
  body: string;
}) {
  const db = getDb();
  const projectBriefId =
    recommendation.opportunity.roleOpening.project.legacyProjectBriefId;
  const phone = recommendation.person.phone
    ? normalizePhone(recommendation.person.phone)
    : null;

  if (!projectBriefId || !phone) return null;

  const roleType = recommendation.opportunity.roleOpening.roleType;
  const existingContact = await db.contact.findUnique({ where: { phone } });
  if (existingContact?.smsOptedOutAt) return null;

  const contact = existingContact
    ? await db.contact.update({
        where: { id: existingContact.id },
        data: {
          personId:
            !existingContact.personId ||
            existingContact.personId === recommendation.personId
              ? recommendation.personId
              : existingContact.personId,
          name:
            recommendation.person.name ||
            existingContact.name ||
            "Demo contact",
          city:
            recommendation.person.city ||
            recommendation.opportunity.roleOpening.project.city ||
            existingContact.city,
          roles: existingContact.roles.length ? existingContact.roles : [roleType],
          tags: existingContact.tags.length
            ? existingContact.tags
            : recommendation.opportunity.roleOpening.project.fandoms,
        },
      })
    : await db.contact.create({
        data: {
          personId: recommendation.personId,
          phone,
          name: recommendation.person.name || "Demo contact",
          city:
            recommendation.person.city ||
            recommendation.opportunity.roleOpening.project.city,
          roles: [roleType],
          tags: recommendation.opportunity.roleOpening.project.fandoms,
        },
      });

  const existingOutreach = await db.outreach.findUnique({
    where: {
      projectBriefId_contactId: {
        projectBriefId,
        contactId: contact.id,
      },
    },
  });

  if (existingOutreach) {
    if (existingOutreach.status !== "SENT") {
      assertOutreachStatusTransition(existingOutreach.status, "SENT", {
        allowAdminOverride: true,
        adminApproved: true,
        hasMessage: Boolean(body.trim()),
      });
    }
    return db.outreach.update({
      where: { id: existingOutreach.id },
      data: {
        status: "SENT",
        draftedMessage: body,
        sentMessage: body,
        adminApproved: true,
        consentToGroupChat: false,
        lastResponse: null,
        opportunityId: recommendation.opportunityId,
        candidateRecommendationId: recommendation.id,
      },
    });
  }

  assertOutreachStatusTransition("DRAFTED", "SENT", {
    adminApproved: true,
    hasMessage: Boolean(body.trim()),
  });
  return db.outreach.create({
    data: {
      projectBriefId,
      contactId: contact.id,
      opportunityId: recommendation.opportunityId,
      candidateRecommendationId: recommendation.id,
      status: "SENT",
      draftedMessage: body,
      sentMessage: body,
      adminApproved: true,
      consentToGroupChat: false,
    },
  });
}

export async function approveMockRecommendationOutreach(recommendationIds: string[]) {
  const db = getDb();
  if (recommendationIds.length === 0) {
    return { requestedCount: 0, sentCount: 0, skippedCount: 0 };
  }

  const recommendations = await db.candidateRecommendation.findMany({
    where: { id: { in: recommendationIds } },
    include: {
      person: true,
      opportunity: {
        include: {
          roleOpening: {
            include: { project: true },
          },
        },
      },
    },
  });

  let sentCount = 0;
  let skippedCount = 0;
  let rearmedCount = 0;
  let outreachCount = 0;
  for (const recommendation of recommendations) {
    if (
      !recommendation.person.phone ||
      recommendation.person.optedOut ||
      [
        "DO_NOT_CONTACT",
        "REJECTED",
        "NEEDS_MORE_INFO",
        "CONTACT_LATER",
      ].includes(
        recommendation.status,
      )
    ) {
      skippedCount += 1;
      continue;
    }
    const project = recommendation.opportunity.roleOpening.project;
    const role = recommendation.opportunity.roleOpening.title;
    const body = `Hey ${recommendation.person.name || "there"} - Saga is helping put together ${project.title || "a creative project"}${project.city ? ` in ${project.city}` : ""}. You look like a strong fit for ${role}. Want to be considered? Reply YES, NO, or MAYBE.`;

    const nextStatus: CandidateRecommendationStatus = "CONTACTED";
    const rearmedFromPriorDemoState = recommendation.status !== nextStatus;
    assertCandidateRecommendationStatusTransition(
      recommendation.status,
      nextStatus,
      {
        allowAdminOverride: rearmedFromPriorDemoState,
        humanApproved: true,
      },
    );
    await sendSmsMessage({
      to: recommendation.person.phone,
      body,
      provider: "MOCK",
      metadata: {
        flow: "network_candidate_outreach",
        recommendationId: recommendation.id,
        opportunityId: recommendation.opportunityId,
        personId: recommendation.personId,
      },
    });

    const outreach = await ensureMockOutreachForRecommendation({
      recommendation,
      body,
    });
    if (outreach) outreachCount += 1;
    if (recommendation.person.consentStatus === "EXPLICIT") {
      await db.person.update({
        where: { id: recommendation.personId },
        data: { consentStatus: "IMPLIED" },
      });
    }
    await db.candidateRecommendation.update({
      where: { id: recommendation.id },
      data: { status: nextStatus },
    });
    await logWorkflowTransition({
      actorType: "ADMIN",
      action: "candidate.status_transitioned",
      entityType: "CandidateRecommendation",
      entityId: recommendation.id,
      fromStatus: recommendation.status,
      toStatus: nextStatus,
      metadata: {
        reason: "mock_outreach_approved",
        rearmedFromPriorDemoState,
        outreachId: outreach?.id,
      },
    });
    if (rearmedFromPriorDemoState) rearmedCount += 1;
    sentCount += 1;
  }

  await logAudit({
    actorType: "ADMIN",
    action: "demo.mock_outreach_approved",
    entityType: "CandidateRecommendation",
    entityId: "batch",
    metadata: {
      recommendationIds,
      providerMode: "MOCK",
      requestedCount: recommendationIds.length,
      sentCount,
      rearmedCount,
      outreachCount,
      skippedCount:
        skippedCount + (recommendationIds.length - recommendations.length),
    },
  });

  return {
    requestedCount: recommendationIds.length,
    sentCount,
    rearmedCount,
    outreachCount,
    skippedCount: skippedCount + (recommendationIds.length - recommendations.length),
  };
}

export async function simulateCandidateReply({
  personId,
  body,
}: {
  personId: string;
  body: string;
}) {
  const db = getDb();
  const recommendation = await db.candidateRecommendation.findFirst({
    where: {
      personId,
      status: { in: ["CONTACTED", "INTERESTED", "SHORTLISTED"] },
    },
    include: {
      person: true,
      opportunity: { include: { roleOpening: { select: { projectId: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!recommendation) return null;
  const linkedOutreach = await db.outreach.findFirst({
    where: { candidateRecommendationId: recommendation.id },
    orderBy: { updatedAt: "desc" },
  });
  const activeOutreachStatus =
    linkedOutreach?.status ||
    (recommendation.status === "CONTACTED"
      ? "SENT"
      : recommendation.status === "INTERESTED"
        ? "INTERESTED"
        : recommendation.status === "SHORTLISTED"
          ? "APPROVED_FOR_GROUPCHAT"
          : null);
  const consentBefore = Boolean(
    linkedOutreach?.consentToGroupChat ||
      recommendation.person.consentStatus === "EXPLICIT",
  );
  const contactContext = {
    normalizedPhone: recommendation.person.phone || null,
    personId,
    intent: "CONTACT_REPLY",
    priorMessages: [],
    knownFields: {},
    gigSeekerKnownFields: {},
    interestCheckKnownFields: {},
    contactReplyKnownFields: {
      personId,
      candidateRecommendationId: recommendation.id,
      projectId: recommendation.opportunity.roleOpening.projectId,
      currentOutreachStatus: activeOutreachStatus,
      consentToGroupChat: consentBefore,
      hasActiveOutreach: ["CONTACTED", "INTERESTED", "SHORTLISTED"].includes(
        recommendation.status,
      ),
    },
    missingRequiredFields: [],
    missingOptionalFields: [],
    hasCompletedFirstTimeHostQuestion: false,
    optedOut: Boolean(recommendation.person.optedOut),
    safetyFlags: [],
    providerMode: "MOCK",
    sendsDisabled: true,
    allowlistResult: "not_applicable",
    currentStage:
      activeOutreachStatus === "INTERESTED"
        ? "CONSENT_REQUESTED"
        : activeOutreachStatus === "APPROVED_FOR_GROUPCHAT"
          ? "CONSENT_CONFIRMED"
          : "OUTREACH_SENT",
    person: {
      id: recommendation.person.id,
      optedOut: recommendation.person.optedOut,
      consentStatus: recommendation.person.consentStatus,
    },
    activeOutreach: {
      id: linkedOutreach?.id || recommendation.id,
      status: activeOutreachStatus,
      consentToGroupChat: consentBefore,
      candidateRecommendationId: recommendation.id,
      projectBriefId: linkedOutreach?.projectBriefId || null,
      opportunityId: recommendation.opportunityId,
    },
  } satisfies ConversationContext;
  const policy = evaluateContactReplyPolicy({
    context: contactContext,
    latestMessage: body,
  });
  const deterministicContactReply = generateContactReplyFromPlan({
    context: contactContext,
    replyPlan: policy.replyPlan,
    latestMessage: body,
    replyKind: policy.replyKind,
  });
  const generatedReply: ContactReplyGeneratedReply =
    contactReplyGeneratedReplySchema.parse({
      ...deterministicContactReply,
      source: "deterministic_fallback",
      metadata: {
        ...deterministicContactReply.metadata,
        ...adminDevDeterministicLlmUnavailableMetadata({
          conversationEngineMode: "mock_active",
        }),
      },
    });
  const intent = classifyCandidateReply(body);
  let nextStatus: CandidateRecommendationStatus = recommendation.status;
  const reply = generatedReply.replyText;
  let consentAfter = consentBefore;

  if (recommendation.status === "SHORTLISTED") {
    if (policy.replyKind === "CONSENT_NO" || policy.replyKind === "NO_DECLINED") {
      nextStatus = "DECLINED";
    } else if (
      policy.replyKind === "CONSENT_YES" ||
      policy.replyKind === "YES_INTERESTED"
    ) {
      nextStatus = "SHORTLISTED";
      await db.person.update({
        where: { id: personId },
        data: { consentStatus: "EXPLICIT" },
      });
      consentAfter = true;
    } else if (policy.replyKind === "MAYBE_INTERESTED") {
      nextStatus = "SHORTLISTED";
    }
  } else if (recommendation.status === "INTERESTED") {
    if (policy.replyKind === "CONSENT_YES") {
      nextStatus = "SHORTLISTED";
      await db.person.update({
        where: { id: personId },
        data: { consentStatus: "EXPLICIT" },
      });
      consentAfter = true;
    } else if (
      policy.replyKind === "CONSENT_NO" ||
      policy.replyKind === "NO_DECLINED"
    ) {
      nextStatus = "DECLINED";
    }
  } else if (policy.replyKind === "YES_INTERESTED") {
    nextStatus = "INTERESTED";
  } else if (policy.replyKind === "NO_DECLINED") {
    nextStatus = "DECLINED";
  } else if (policy.replyKind === "MAYBE_INTERESTED") {
    nextStatus = "INTERESTED";
  }

  await db.message.create({
    data: {
      direction: "INBOUND",
      channel: "SMS",
      body,
      metadata: {
        provider: "mock",
        flow: "network_candidate_reply",
        personId,
        recommendationId: recommendation.id,
        projectId: recommendation.opportunity.roleOpening.projectId,
        intent,
        replyKind: policy.replyKind,
      },
    },
  });
  await sendSmsMessage({
    to: recommendation.person.phone || "+14155550000",
    body: reply,
    provider: "MOCK",
    metadata: {
      flow: "network_candidate_reply",
      personId,
      recommendationId: recommendation.id,
      projectId: recommendation.opportunity.roleOpening.projectId,
      intent,
      replyKind: policy.replyKind,
      generatedBy: "conversation_engine",
      conversationReplyType: generatedReply.replyType,
      conversationReplySource: generatedReply.source,
      conversationReplySourceDetail: generatedReply.metadata.replySourceDetail,
      llmOperation: generatedReply.metadata.llmOperation,
      llmOperationUnavailable: generatedReply.metadata.llmOperationUnavailable,
      llmMode: generatedReply.metadata.llmMode,
      llmExecutionSurface: generatedReply.metadata.llmExecutionSurface,
      llmValidationPassed: generatedReply.metadata.llmValidationPassed,
      llmFallbackUsed: generatedReply.metadata.llmFallbackUsed,
      llmFallbackReason: generatedReply.metadata.llmFallbackReason,
      forbiddenClaimsDetected: generatedReply.metadata.forbiddenClaimsDetected,
      noGroupChatCreated: true,
    },
  });
  if (nextStatus !== recommendation.status) {
    assertCandidateRecommendationStatusTransition(
      recommendation.status,
      nextStatus,
      {
        hasConsent:
          nextStatus === "SHORTLISTED"
            ? consentAfter ||
              recommendation.person.consentStatus === "EXPLICIT"
            : undefined,
      },
    );
    await logWorkflowTransition({
      actorType: "CONTACT",
      action: "candidate.status_transitioned",
      entityType: "CandidateRecommendation",
      entityId: recommendation.id,
      fromStatus: recommendation.status,
      toStatus: nextStatus,
      metadata: {
        reason: "mock_candidate_reply",
        intent,
        replyKind: policy.replyKind,
      },
    });
  }
  let nextOutreachStatus: OutreachStatus | null = linkedOutreach?.status || null;
  if (linkedOutreach) {
    if (policy.replyKind === "YES_INTERESTED") {
      nextOutreachStatus = "INTERESTED";
    } else if (
      policy.replyKind === "NO_DECLINED" ||
      policy.replyKind === "CONSENT_NO"
    ) {
      nextOutreachStatus = "NOT_INTERESTED";
    } else if (policy.replyKind === "MAYBE_INTERESTED") {
      nextOutreachStatus = "MAYBE";
    } else if (policy.replyKind === "CONSENT_YES") {
      nextOutreachStatus = "APPROVED_FOR_GROUPCHAT";
    }

    if (nextOutreachStatus && nextOutreachStatus !== linkedOutreach.status) {
      assertOutreachStatusTransition(linkedOutreach.status, nextOutreachStatus, {
        hasConsent:
          nextOutreachStatus === "APPROVED_FOR_GROUPCHAT"
            ? consentAfter
            : undefined,
      });
    }
    await db.outreach.update({
      where: { id: linkedOutreach.id },
      data: {
        status: nextOutreachStatus || linkedOutreach.status,
        lastResponse: body,
        consentToGroupChat: consentAfter,
      },
    });
  }
  await logAudit({
    actorType: "CONTACT",
    action: "demo.fake_reply_simulated",
    entityType: "CandidateRecommendation",
    entityId: recommendation.id,
    metadata: {
      intent,
      personId,
      projectId: recommendation.opportunity.roleOpening.projectId,
      providerMode: "MOCK",
      fromStatus: recommendation.status,
      toStatus: nextStatus,
      replyKind: policy.replyKind,
      consentBefore,
      consentAfter,
      outreachId: linkedOutreach?.id,
      outreachStatusBefore: linkedOutreach?.status,
      outreachStatusAfter: nextOutreachStatus,
      noGroupChatCreated: true,
    },
  });
  await logAudit({
    actorType: "CONTACT",
    action: "conversation.contact_reply_plan_applied",
    entityType: "CandidateRecommendation",
    entityId: recommendation.id,
    metadata: {
      personId,
      replyKind: policy.replyKind,
      oldStatus: recommendation.status,
      newStatus: nextStatus,
      consentToGroupChatBefore: consentBefore,
      consentToGroupChatAfter: consentAfter,
      outreachId: linkedOutreach?.id,
      outreachStatusBefore: linkedOutreach?.status,
      outreachStatusAfter: nextOutreachStatus,
      source: "mock_admin",
      replyType: generatedReply.replyType,
      generatedReplySource: generatedReply.source,
      conversationReplySourceDetail: generatedReply.metadata.replySourceDetail,
      llmOperation: generatedReply.metadata.llmOperation,
      llmOperationUnavailable: generatedReply.metadata.llmOperationUnavailable,
      llmMode: generatedReply.metadata.llmMode,
      llmExecutionSurface: generatedReply.metadata.llmExecutionSurface,
      llmValidationPassed: generatedReply.metadata.llmValidationPassed,
      llmFallbackUsed: generatedReply.metadata.llmFallbackUsed,
      llmFallbackReason: generatedReply.metadata.llmFallbackReason,
      forbiddenClaimsDetected: generatedReply.metadata.forbiddenClaimsDetected,
      shouldEscalate: policy.replyPlan.shouldEscalate,
      noGroupChatCreated: true,
      noTeamMembershipConfirmed: true,
    },
  });
  return db.candidateRecommendation.update({
    where: { id: recommendation.id },
    data: { status: nextStatus },
  });
}

export async function createMockTeamAndConversation(
  projectId: string,
  recommendationIds: string[],
) {
  const db = getDb();
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      roleOpenings: true,
    },
  });
  const recommendations = await db.candidateRecommendation.findMany({
    where: {
      id: { in: recommendationIds },
      status: "SHORTLISTED",
    },
    include: { person: true, opportunity: { include: { roleOpening: true } } },
  });
  const consentedRecommendations = recommendations.filter(
    (recommendation) => recommendation.person.consentStatus === "EXPLICIT",
  );
  if (consentedRecommendations.length === 0) {
    throw new Error(
      "No shortlisted candidates have explicit consent for the mock group conversation.",
    );
  }
  const provider = getMessagingProvider("MOCK");
  const conversation = await provider.createGroupConversation({
    friendlyName: `Saga demo: ${project.title || "project"}`,
  });
  const team = await db.team.upsert({
    where: { projectId },
    update: { status: "FORMING" },
    create: { projectId, status: "FORMING" },
  });

  for (const recommendation of consentedRecommendations) {
    const existingTeamMember = await db.teamMember.findUnique({
      where: {
        teamId_personId_roleOpeningId: {
          teamId: team.id,
          personId: recommendation.personId,
          roleOpeningId: recommendation.opportunity.roleOpeningId,
        },
      },
    });
    assertTeamMemberStatusTransition(
      existingTeamMember?.status || "INVITED",
      "CONFIRMED",
      {
        humanApproved: true,
        hasExplicitConsent: recommendation.person.consentStatus === "EXPLICIT",
      },
    );
    await db.teamMember.upsert({
      where: {
        teamId_personId_roleOpeningId: {
          teamId: team.id,
          personId: recommendation.personId,
          roleOpeningId: recommendation.opportunity.roleOpeningId,
        },
      },
      update: { status: "CONFIRMED" },
      create: {
        teamId: team.id,
        personId: recommendation.personId,
        roleOpeningId: recommendation.opportunity.roleOpeningId,
        status: "CONFIRMED",
      },
    });
    assertCandidateRecommendationStatusTransition(
      recommendation.status,
      "ADDED_TO_TEAM",
      {
        humanApproved: true,
        hasExplicitConsent: recommendation.person.consentStatus === "EXPLICIT",
        hasConfirmedTeamMember: true,
      },
    );
    await db.candidateRecommendation.update({
      where: { id: recommendation.id },
      data: { status: "ADDED_TO_TEAM" },
    });
    await logWorkflowTransition({
      actorType: "ADMIN",
      action: "candidate.status_transitioned",
      entityType: "CandidateRecommendation",
      entityId: recommendation.id,
      fromStatus: recommendation.status,
      toStatus: "ADDED_TO_TEAM",
      metadata: { reason: "mock_team_created", teamId: team.id },
    });
    if (recommendation.person.phone) {
      await provider.addParticipant({
        conversationSid: conversation.sid || team.id,
        phone: recommendation.person.phone,
      });
    }
  }

  assertTeamStatusTransition(team.status, "ACTIVE", {
    hasConfirmedTeamMember: true,
  });
  const activeTeam = await db.team.update({
    where: { id: team.id },
    data: { status: "ACTIVE" },
  });
  await logAudit({
    actorType: "SYSTEM",
    action: "team.mock_created",
    entityType: "Team",
    entityId: activeTeam.id,
    metadata: {
      projectId,
      providerMode: "MOCK",
      recommendationIds: consentedRecommendations.map(
        (recommendation) => recommendation.id,
      ),
      memberCount: consentedRecommendations.length,
    },
  });
  await logWorkflowTransition({
    action: "team.status_transitioned",
    entityType: "Team",
    entityId: activeTeam.id,
    fromStatus: team.status,
    toStatus: "ACTIVE",
    metadata: { reason: "mock_team_members_confirmed" },
  });

  const productionConversation = await db.productionConversation.create({
    data: {
      projectId,
      provider: "MOCK",
      externalConversationId: conversation.sid,
      status: "DRAFT",
    },
  });
  assertProductionConversationStatusTransition("DRAFT", "ACTIVE", {
    participantCount: consentedRecommendations.length + 1,
  });
  const activeProductionConversation = await db.productionConversation.update({
    where: { id: productionConversation.id },
    data: { status: "ACTIVE" },
  });
  await logWorkflowTransition({
    action: "production_conversation.status_transitioned",
    entityType: "ProductionConversation",
    entityId: activeProductionConversation.id,
    fromStatus: "DRAFT",
    toStatus: "ACTIVE",
    metadata: {
      reason: "mock_group_created",
      participantCount: consentedRecommendations.length + 1,
    },
  });
  const kickoff = buildNetworkKickoff(project, consentedRecommendations);

  await logAudit({
    actorType: "SYSTEM",
    action: "mock_groupchat.kickoff_created",
    entityType: "ProductionConversation",
    entityId: activeProductionConversation.id,
    metadata: {
      projectId,
      providerMode: "MOCK",
      kickoff,
      firstTasks: [
        "Confirm the target date",
        "Confirm venue direction",
        "Assign content/photo ownership",
        "Set the next decision deadline",
      ],
    },
  });

  const firstTasks = [
    "Confirm the target date",
    "Confirm venue direction",
    "Assign content/photo ownership",
    "Set the next decision deadline",
  ];
  for (const title of firstTasks) {
    await db.task.create({
      data: {
        projectId,
        productionConversationId: activeProductionConversation.id,
        title,
        status: "TODO",
      },
    });
  }

  assertProjectStatusTransition(project.status, "TEAM_FORMING");
  await db.project.update({
    where: { id: projectId },
    data: { status: "TEAM_FORMING" },
  });
  await logWorkflowTransition({
    action: "project.status_transitioned",
    entityType: "Project",
    entityId: projectId,
    fromStatus: project.status,
    toStatus: "TEAM_FORMING",
    metadata: { reason: "mock_group_created" },
  });

  return activeProductionConversation;
}

export async function resetNetworkDemoData() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo reset is disabled in production.");
  }

  const db = getDb();
  const demoProjects = await db.project.findMany({
    where: {
      OR: [
        { existingSagaEventId: { startsWith: "evt_demo" } },
        { existingSagaEventId: { startsWith: "evt_internal" } },
        { title: { contains: "Demo" } },
        { title: { contains: "Anime Rave LA" } },
      ],
    },
    select: { id: true },
  });
  const demoPeople = await db.person.findMany({
    where: {
      OR: [
        { sagaUserId: { startsWith: "saga_demo" } },
        { sagaUserId: { startsWith: "saga_internal" } },
        { phone: { startsWith: "+1415555" } },
      ],
    },
    select: { id: true },
  });
  const demoUsers = await db.user.findMany({
    where: { phone: { startsWith: "+1415555" } },
    include: { projectBriefs: true },
  });
  const projectIds = demoProjects.map((project) => project.id);
  const personIds = demoPeople.map((person) => person.id);
  const projectBriefIds = demoUsers.flatMap((user) =>
    user.projectBriefs.map((brief) => brief.id),
  );

  await db.auditLog.deleteMany({
    where: {
      OR: [
        { entityId: { in: projectIds } },
        { entityId: { in: personIds } },
        { entityId: { in: projectBriefIds } },
        { action: { startsWith: "demo." } },
      ],
    },
  });
  await db.message.deleteMany({
    where: {
      OR: [
        { projectBriefId: { in: projectBriefIds } },
        { metadata: { path: ["flow"], equals: "network_candidate_reply" } },
        { metadata: { path: ["flow"], equals: "network_candidate_outreach" } },
      ],
    },
  });
  await db.project.deleteMany({ where: { id: { in: projectIds } } });
  await db.interestCheck.deleteMany({
    where: {
      OR: [
        { title: { contains: "Demo" } },
        { title: { contains: "Maid cafe" } },
        { creatorPersonId: { in: personIds } },
      ],
    },
  });
  await db.projectBrief.deleteMany({ where: { id: { in: projectBriefIds } } });
  await db.user.deleteMany({ where: { id: { in: demoUsers.map((user) => user.id) } } });
  await db.person.deleteMany({ where: { id: { in: personIds } } });

  return {
    deletedProjects: projectIds.length,
    deletedPeople: personIds.length,
    deletedOrganizerUsers: demoUsers.length,
  };
}

export async function createFullDemoScenario() {
  const db = getDb();
  const organizerUser = await db.user.upsert({
    where: { phone: "+14155559000" },
    update: { name: "Demo Organizer", hasCompletedFirstTimeHostQuestion: true },
    create: {
      phone: "+14155559000",
      name: "Demo Organizer",
      hasCompletedFirstTimeHostQuestion: true,
    },
  });
  const projectBrief = await db.projectBrief.upsert({
    where: {
      id: "demo-project-brief",
    },
    update: {
      userId: organizerUser.id,
      status: "BRIEF_READY_FOR_REVIEW",
      city: "Los Angeles",
      projectType: "Anime rave",
      title: "Demo Anime Rave LA",
      description:
        "A fandom-aligned music night with DJs, guest cosplayers, content moments, and vendors.",
      targetDate: "Late summer",
      budgetRange: "Unknown",
      expectedAudienceSize: "150-250",
      scope: "Small venue, production-light, community-led",
      vibe: "High-energy anime nightlife",
      helpNeeded: "Venue, DJ, photographer, guest cosplayers, vendor coordination",
      requiredRoles: [
        {
          role: "Photographer",
          reason: "Capture promo and event content",
          priority: "core",
          tags: ["photography", "content"],
        },
        {
          role: "DJ",
          reason: "Set the music direction",
          priority: "core",
          tags: ["music", "audio"],
        },
        {
          role: "Guest Cosplayer",
          reason: "Bring fandom alignment and community draw",
          priority: "nice_to_have",
          tags: ["cosplay", "anime"],
        },
      ],
    },
    create: {
      id: "demo-project-brief",
      userId: organizerUser.id,
      status: "BRIEF_READY_FOR_REVIEW",
      city: "Los Angeles",
      projectType: "Anime rave",
      title: "Demo Anime Rave LA",
      description:
        "A fandom-aligned music night with DJs, guest cosplayers, content moments, and vendors.",
      targetDate: "Late summer",
      budgetRange: "Unknown",
      expectedAudienceSize: "150-250",
      scope: "Small venue, production-light, community-led",
      vibe: "High-energy anime nightlife",
      helpNeeded: "Venue, DJ, photographer, guest cosplayers, vendor coordination",
      requiredRoles: [
        {
          role: "Photographer",
          reason: "Capture promo and event content",
          priority: "core",
          tags: ["photography", "content"],
        },
        {
          role: "DJ",
          reason: "Set the music direction",
          priority: "core",
          tags: ["music", "audio"],
        },
        {
          role: "Guest Cosplayer",
          reason: "Bring fandom alignment and community draw",
          priority: "nice_to_have",
          tags: ["cosplay", "anime"],
        },
      ],
    },
  });
  await db.message.createMany({
    data: [
      {
        direction: "INBOUND",
        channel: "SMS",
        userId: organizerUser.id,
        projectBriefId: projectBrief.id,
        body: "I want to throw an anime rave in LA.",
        metadata: { simulated: true, demoScenario: true },
      },
      {
        direction: "OUTBOUND",
        channel: "SMS",
        userId: organizerUser.id,
        projectBriefId: projectBrief.id,
        body: "Got it. I'm going to turn this into a brief and start mapping the kind of team that could bring it to life.",
        metadata: { simulated: true, demoScenario: true, provider: "mock" },
      },
    ],
    skipDuplicates: true,
  });

  const project = await db.project.upsert({
    where: { existingSagaEventId: "evt_demo_full_scenario" },
    update: {
      legacyProjectBriefId: projectBrief.id,
      title: "Demo Anime Rave LA",
      description: projectBrief.description,
      city: "Los Angeles",
      targetDate: "Late summer",
      audience: "150-250",
      fandoms: ["anime", "cosplay", "gaming"],
      status: "RECRUITING",
    },
    create: {
      source: "IMPORT",
      existingSagaEventId: "evt_demo_full_scenario",
      legacyProjectBriefId: projectBrief.id,
      title: "Demo Anime Rave LA",
      description: projectBrief.description,
      city: "Los Angeles",
      targetDate: "Late summer",
      audience: "150-250",
      fandoms: ["anime", "cosplay", "gaming"],
      status: "RECRUITING",
    },
  });
  await db.projectBrief.update({
    where: { id: projectBrief.id },
    data: { projectId: project.id },
  });

  const creatorSpecs = [
    {
      sagaUserId: "saga_demo_photo",
      phone: "+14155559011",
      name: "Mina Park",
      roles: ["photographer"],
      skills: ["photography", "content"],
      fandoms: ["anime", "cosplay"],
    },
    {
      sagaUserId: "saga_demo_dj",
      phone: "+14155559012",
      name: "DJ Kiko",
      roles: ["dj"],
      skills: ["music", "audio", "nightlife"],
      fandoms: ["anime", "gaming"],
    },
    {
      sagaUserId: "saga_demo_cosplay",
      phone: "+14155559013",
      name: "Rae Star",
      roles: ["cosplayer"],
      skills: ["cosplay", "performance"],
      fandoms: ["anime", "fantasy"],
    },
  ];

  const people = [];
  for (const spec of creatorSpecs) {
    const person = await db.person.upsert({
      where: { sagaUserId: spec.sagaUserId },
      update: {
        phone: spec.phone,
        name: spec.name,
        city: "Los Angeles",
        source: "APP",
        consentStatus: "EXPLICIT",
      },
      create: {
        sagaUserId: spec.sagaUserId,
        phone: spec.phone,
        name: spec.name,
        city: "Los Angeles",
        source: "APP",
        consentStatus: "EXPLICIT",
      },
    });
    await db.creatorProfile.upsert({
      where: { personId: person.id },
      update: {
        displayName: spec.name,
        city: "Los Angeles",
        roles: spec.roles,
        skills: spec.skills,
        fandoms: spec.fandoms,
        communities: spec.fandoms,
        portfolioUrls: [`https://example.com/${spec.sagaUserId}`],
        socialUrls: [`https://instagram.com/${spec.sagaUserId}`],
        preferredOpportunityTypes: ["paid", "collab"],
        reviewStatus: "APPROVED",
      },
      create: {
        personId: person.id,
        displayName: spec.name,
        city: "Los Angeles",
        roles: spec.roles,
        skills: spec.skills,
        fandoms: spec.fandoms,
        communities: spec.fandoms,
        portfolioUrls: [`https://example.com/${spec.sagaUserId}`],
        socialUrls: [`https://instagram.com/${spec.sagaUserId}`],
        preferredOpportunityTypes: ["paid", "collab"],
        reviewStatus: "APPROVED",
      },
    });
    people.push(person);
  }

  const organizerPerson = await db.person.upsert({
    where: { phone: "+14155559000" },
    update: { name: "Demo Organizer", city: "Los Angeles", source: "SMS" },
    create: {
      phone: "+14155559000",
      name: "Demo Organizer",
      city: "Los Angeles",
      source: "SMS",
      consentStatus: "IMPLIED",
    },
  });
  await db.project.update({
    where: { id: project.id },
    data: { organizerPersonId: organizerPerson.id },
  });
  for (const person of people) {
    await db.relationshipEdge.upsert({
      where: {
        fromPersonId_toPersonId_relationshipType: {
          fromPersonId: organizerPerson.id,
          toPersonId: person.id,
          relationshipType: "FRIEND",
        },
      },
      update: { strength: 1 },
      create: {
        fromPersonId: organizerPerson.id,
        toPersonId: person.id,
        relationshipType: "FRIEND",
        strength: 1,
      },
    });
  }

  const roleTypes = ["photographer", "dj", "cosplayer"];
  const recommendationIds = [];
  for (const roleType of roleTypes) {
    const roleOpening =
      (await db.roleOpening.findFirst({ where: { projectId: project.id, roleType } })) ||
      (await db.roleOpening.create({
        data: {
          projectId: project.id,
          roleType,
          title:
            roleType === "dj"
              ? "DJ"
              : roleType === "cosplayer"
                ? "Guest Cosplayer"
                : "Photographer",
          requiredSkills: [roleType],
          preferredFandoms: project.fandoms,
          locationRequirement: "Los Angeles",
          status: "OPEN",
        },
      }));
    const opportunity =
      (await db.opportunity.findFirst({ where: { roleOpeningId: roleOpening.id } })) ||
      (await db.opportunity.create({
        data: {
          roleOpeningId: roleOpening.id,
          visibility: "COMMUNITY",
          applicationMode: "INVITE_AND_APPLY",
          status: "ACTIVE",
        },
      }));
    const matchingPerson = people.find((person) =>
      creatorSpecs
        .find((spec) => spec.sagaUserId === person.sagaUserId)
        ?.roles.some((role) => role === roleType || role.includes(roleType)),
    ) || people[0];
    const recommendation = await db.candidateRecommendation.upsert({
      where: {
        opportunityId_personId: {
          opportunityId: opportunity.id,
          personId: matchingPerson.id,
        },
      },
      update: {
        score: 25,
        scoreBreakdown: {
          proximity: 10,
          roleFit: 7,
          fandomFit: 3,
          location: 5,
          reliability: 2,
        },
        proximityTier: "FRIEND",
        matchingReasons: [
          "Direct friend of the organizer",
          "Same city: Los Angeles",
          `Role match: ${roleType}`,
          "Fandom fit: anime",
          "Profile reviewed by Saga",
        ],
        risks: [],
        status: "SHORTLISTED",
      },
      create: {
        opportunityId: opportunity.id,
        personId: matchingPerson.id,
        score: 25,
        scoreBreakdown: {
          proximity: 10,
          roleFit: 7,
          fandomFit: 3,
          location: 5,
          reliability: 2,
        },
        proximityTier: "FRIEND",
        matchingReasons: [
          "Direct friend of the organizer",
          "Same city: Los Angeles",
          `Role match: ${roleType}`,
          "Fandom fit: anime",
          "Profile reviewed by Saga",
        ],
        risks: [],
        status: "SHORTLISTED",
      },
    });
    recommendationIds.push(recommendation.id);
  }

  await db.message.deleteMany({
    where: {
      AND: [
        { metadata: { path: ["demoScenario"], equals: true } },
        { metadata: { path: ["flow"], equals: "network_candidate_reply" } },
        { metadata: { path: ["projectId"], equals: project.id } },
      ],
    },
  });
  await db.message.createMany({
    data: recommendationIds.map((recommendationId) => ({
      direction: "INBOUND",
      channel: "SMS",
      body: "YES, you can introduce me in the group",
      metadata: {
        provider: "mock",
        flow: "network_candidate_reply",
        demoScenario: true,
        projectId: project.id,
        recommendationId,
        intent: "YES",
      },
    })),
  });

  await logAudit({
    actorType: "SYSTEM",
    action: "demo.shortlist_generated",
    entityType: "Project",
    entityId: project.id,
    metadata: { recommendationIds, providerMode: "MOCK" },
  });
  await createMockTeamAndConversation(project.id, recommendationIds);
  await logAudit({
    actorType: "SYSTEM",
    action: "demo.full_scenario_created",
    entityType: "Project",
    entityId: project.id,
    metadata: {
      projectBriefId: projectBrief.id,
      providerMode: "MOCK",
      recommendationIds,
    },
  });

  return {
    projectId: project.id,
    projectBriefId: projectBrief.id,
    recommendationIds,
  };
}

function buildNetworkKickoff(
  project: Pick<Project, "title" | "description" | "city" | "targetDate">,
  recommendations: Array<{
    person: { name: string | null };
    opportunity: { roleOpening: { title: string } };
  }>,
) {
  const roles = recommendations
    .map(
      (recommendation) =>
        `- ${recommendation.person.name || "Team member"}: ${recommendation.opportunity.roleOpening.title}`,
    )
    .join("\n");
  return `Hey everyone - Saga here. I will help keep this organized.\n\nQuick recap: ${project.title || "Creative project"}${project.city ? ` in ${project.city}` : ""}${project.targetDate ? ` around ${project.targetDate}` : ""}. ${project.description || ""}\n\nSuggested roles:\n${roles || "- Organizer: Project lead"}\n\nFirst next steps:\n1. Confirm the target date\n2. Confirm venue direction\n3. Confirm who owns photography/content\n4. Align on the next decision deadline`;
}
