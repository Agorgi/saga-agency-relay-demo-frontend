import type { ConsentStatus, PersonSource, ProfileReviewStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { redactPhoneForDisplay } from "@/lib/adminPrivacy";
import type {
  GigSeekerKnownFields,
  GigSeekerGeneratedReply,
  ReplyPlan,
} from "@/lib/conversation/conversationTypes";
import type { ConversationEngineRuntime } from "@/lib/conversation/conversationEngineMode";
import { getDb } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

type ExistingProfile = {
  displayName?: string | null;
  city?: string | null;
  roles?: string[] | null;
  skills?: string[] | null;
  fandoms?: string[] | null;
  communities?: string[] | null;
  portfolioUrls?: string[] | null;
  socialUrls?: string[] | null;
  availabilityNotes?: string | null;
  rateNotes?: string | null;
  preferredOpportunityTypes?: string[] | null;
  reviewStatus?: ProfileReviewStatus | null;
};

export type GigSeekerProfileDraft = {
  city?: string | null;
  roles: string[];
  skills: string[];
  fandoms: string[];
  communities: string[];
  portfolioUrls: string[];
  socialUrls: string[];
  availabilityNotes?: string | null;
  rateNotes?: string | null;
  preferredOpportunityTypes: string[];
  reviewStatus: ProfileReviewStatus;
};

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((item) => item?.trim()).filter(Boolean))] as string[];
}

function preferredTypesFromCompensation(fields: GigSeekerKnownFields) {
  if (fields.compensationPreference === "paid_only") return ["paid"];
  if (fields.compensationPreference === "paid_or_collab") {
    return ["paid", "collab"];
  }
  if (fields.compensationPreference === "volunteer_collab") {
    return ["volunteer", "collab"];
  }
  return [];
}

function nextReviewStatus(
  existingStatus?: ProfileReviewStatus | null,
): ProfileReviewStatus {
  if (existingStatus === "APPROVED" || existingStatus === "REJECTED") {
    return existingStatus;
  }
  return "PENDING_REVIEW";
}

export function shouldApplyGigSeekerMockActive(input: {
  runtime: Pick<ConversationEngineRuntime, "effectiveActive" | "providerMode">;
  source: "admin_dev" | "mock" | "twilio_webhook" | "unknown";
}) {
  return (
    input.runtime.effectiveActive &&
    (input.runtime.providerMode === "MOCK" || input.source === "admin_dev")
  );
}

export function buildGigSeekerProfileDraft({
  knownFields,
  existingProfile,
}: {
  knownFields: GigSeekerKnownFields;
  existingProfile?: ExistingProfile | null;
}): GigSeekerProfileDraft {
  const preferredOpportunityTypes = unique([
    ...(existingProfile?.preferredOpportunityTypes || []),
    ...(knownFields.preferredOpportunityTypes || []),
    ...preferredTypesFromCompensation(knownFields),
  ]);

  return {
    city: clean(knownFields.city) || clean(existingProfile?.city),
    roles: unique([
      ...(existingProfile?.roles || []),
      ...(knownFields.desiredRoles || []),
    ]),
    skills: unique([
      ...(existingProfile?.skills || []),
      ...(knownFields.skills || []),
      ...(knownFields.desiredRoles || []),
    ]),
    fandoms: unique([
      ...(existingProfile?.fandoms || []),
      ...(knownFields.fandoms || []),
    ]),
    communities: unique([
      ...(existingProfile?.communities || []),
      ...(knownFields.communities || []),
      ...(knownFields.fandoms || []),
    ]),
    portfolioUrls: unique([
      ...(existingProfile?.portfolioUrls || []),
      ...(knownFields.portfolioUrls || []),
    ]),
    socialUrls: unique([
      ...(existingProfile?.socialUrls || []),
      ...(knownFields.socialUrls || []),
    ]),
    availabilityNotes:
      clean(knownFields.availabilityNotes) ||
      clean(existingProfile?.availabilityNotes),
    rateNotes: clean(knownFields.rateNotes) || clean(existingProfile?.rateNotes),
    preferredOpportunityTypes,
    reviewStatus: nextReviewStatus(existingProfile?.reviewStatus),
  };
}

function knownFieldsCount(draft: GigSeekerProfileDraft) {
  return [
    draft.city,
    draft.roles.length,
    draft.skills.length,
    draft.fandoms.length,
    draft.communities.length,
    draft.portfolioUrls.length,
    draft.socialUrls.length,
    draft.availabilityNotes,
    draft.rateNotes,
    draft.preferredOpportunityTypes.length,
  ].filter(Boolean).length;
}

async function upsertMockPerson({
  phone,
  city,
}: {
  phone: string;
  city?: string | null;
}) {
  const normalizedPhone = normalizePhone(phone);
  const db = getDb();
  const existing = await db.person.findUnique({
    where: { phone: normalizedPhone },
  });
  const source: PersonSource = "SMS";
  const consentStatus: ConsentStatus = "IMPLIED";

  if (existing) {
    return db.person.update({
      where: { id: existing.id },
      data: {
        city: city || existing.city,
        source,
        consentStatus:
          existing.consentStatus === "OPTED_OUT"
            ? existing.consentStatus
            : consentStatus,
      },
    });
  }

  return db.person.create({
    data: {
      phone: normalizedPhone,
      city,
      source,
      consentStatus,
    },
  });
}

export async function prepareGigSeekerProfileForMockAdmin({
  phone,
  knownFields,
  missingRequiredFields,
  replyPlan,
  generatedReply,
}: {
  phone: string;
  knownFields: GigSeekerKnownFields;
  missingRequiredFields: string[];
  replyPlan: ReplyPlan;
  generatedReply: GigSeekerGeneratedReply;
}) {
  const db = getDb();
  const normalizedPhone = normalizePhone(phone);
  const person = await upsertMockPerson({
    phone: normalizedPhone,
    city: knownFields.city,
  });
  const existingProfile = await db.creatorProfile.findUnique({
    where: { personId: person.id },
  });
  const draft = buildGigSeekerProfileDraft({
    knownFields,
    existingProfile,
  });

  const profile = await db.creatorProfile.upsert({
    where: { personId: person.id },
    update: {
      displayName: existingProfile?.displayName || person.name,
      city: draft.city,
      roles: draft.roles,
      skills: draft.skills,
      fandoms: draft.fandoms,
      communities: draft.communities,
      portfolioUrls: draft.portfolioUrls,
      socialUrls: draft.socialUrls,
      availabilityNotes: draft.availabilityNotes,
      rateNotes: draft.rateNotes,
      preferredOpportunityTypes: draft.preferredOpportunityTypes,
      reviewStatus: draft.reviewStatus,
    },
    create: {
      personId: person.id,
      displayName: person.name,
      city: draft.city,
      roles: draft.roles,
      skills: draft.skills,
      fandoms: draft.fandoms,
      communities: draft.communities,
      portfolioUrls: draft.portfolioUrls,
      socialUrls: draft.socialUrls,
      availabilityNotes: draft.availabilityNotes,
      rateNotes: draft.rateNotes,
      preferredOpportunityTypes: draft.preferredOpportunityTypes,
      reviewStatus: draft.reviewStatus,
    },
  });

  await logAudit({
    actorType: "SYSTEM",
    action: "conversation.gig_seeker_profile_prepared",
    entityType: "CreatorProfile",
    entityId: profile.id,
    metadata: {
      personId: person.id,
      creatorProfileId: profile.id,
      reviewStatus: profile.reviewStatus,
      knownFieldsCount: knownFieldsCount(draft),
      missingRequiredFields,
      source: "mock_admin",
      senderRedacted: redactPhoneForDisplay(normalizedPhone),
      replyType: generatedReply.replyType,
      enoughInfoForProfileReview: replyPlan.enoughInfoForProfileReview,
    },
  });

  return { person, profile, draft };
}
