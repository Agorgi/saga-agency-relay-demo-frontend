import type {
  ConsentStatus,
  InterestCheckStatus,
  PersonSource,
  ThresholdType,
} from "@prisma/client";
import { redactPhoneForDisplay } from "@/sms-engine/adminPrivacy";
import { logAudit } from "@/sms-engine/audit";
import type {
  InterestCheckGeneratedReply,
  InterestCheckKnownFields,
  ReplyPlan,
} from "@/sms-engine/conversation/conversationTypes";
import type { ConversationEngineRuntime } from "@/sms-engine/conversation/conversationEngineMode";
import { getDb } from "@/sms-engine/db";
import { normalizePhone } from "@/sms-engine/phone";

export type InterestCheckDraft = {
  title: string;
  description: string;
  city?: string | null;
  fandoms: string[];
  proposedTiming?: string | null;
  thresholdType: ThresholdType;
  thresholdValue?: number | null;
  status: InterestCheckStatus;
};

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((item) => item?.trim()).filter(Boolean))] as string[];
}

export function shouldApplyInterestCheckMockActive(input: {
  runtime: Pick<ConversationEngineRuntime, "effectiveActive" | "providerMode">;
  source: "admin_dev" | "mock" | "twilio_webhook" | "unknown";
}) {
  return (
    input.runtime.effectiveActive &&
    (input.runtime.providerMode === "MOCK" || input.source === "admin_dev")
  );
}

export function buildInterestCheckDraft({
  knownFields,
  existingDraft,
}: {
  knownFields: InterestCheckKnownFields;
  existingDraft?: Partial<InterestCheckDraft> | null;
}): InterestCheckDraft {
  const fandoms = unique([
    ...(existingDraft?.fandoms || []),
    ...(knownFields.fandoms || []),
    ...(knownFields.communities || []),
  ]);
  const title =
    clean(knownFields.title) ||
    clean(existingDraft?.title) ||
    "Untitled interest check";
  const description =
    clean(knownFields.description) ||
    clean(existingDraft?.description) ||
    title;

  return {
    title,
    description,
    city: clean(knownFields.city) || clean(existingDraft?.city),
    fandoms,
    proposedTiming:
      clean(knownFields.proposedTiming) || clean(existingDraft?.proposedTiming),
    thresholdType: existingDraft?.thresholdType || "ADMIN_APPROVAL",
    thresholdValue: existingDraft?.thresholdValue ?? null,
    status: "DRAFT",
  };
}

function knownFieldsCount(draft: InterestCheckDraft) {
  return [
    draft.title,
    draft.description,
    draft.city,
    draft.fandoms.length,
    draft.proposedTiming,
    draft.thresholdType,
    draft.thresholdValue,
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

export async function prepareInterestCheckForMockAdmin({
  phone,
  knownFields,
  missingRequiredFields,
  replyPlan,
  generatedReply,
}: {
  phone: string;
  knownFields: InterestCheckKnownFields;
  missingRequiredFields: string[];
  replyPlan: ReplyPlan;
  generatedReply: InterestCheckGeneratedReply;
}) {
  const db = getDb();
  const normalizedPhone = normalizePhone(phone);
  const person = await upsertMockPerson({
    phone: normalizedPhone,
    city: knownFields.city,
  });
  const existingInterestCheck = await db.interestCheck.findFirst({
    where: {
      creatorPersonId: person.id,
      status: "DRAFT",
      convertedProjectId: null,
    },
    orderBy: { updatedAt: "desc" },
  });
  const draft = buildInterestCheckDraft({
    knownFields,
    existingDraft: existingInterestCheck,
  });

  const interestCheck = existingInterestCheck
    ? await db.interestCheck.update({
        where: { id: existingInterestCheck.id },
        data: {
          title: draft.title,
          description: draft.description,
          city: draft.city,
          fandoms: draft.fandoms,
          proposedTiming: draft.proposedTiming,
          thresholdType: draft.thresholdType,
          thresholdValue: draft.thresholdValue,
          status: "DRAFT",
        },
      })
    : await db.interestCheck.create({
        data: {
          creatorPersonId: person.id,
          title: draft.title,
          description: draft.description,
          city: draft.city,
          fandoms: draft.fandoms,
          proposedTiming: draft.proposedTiming,
          thresholdType: draft.thresholdType,
          thresholdValue: draft.thresholdValue,
          status: "DRAFT",
        },
      });

  await logAudit({
    actorType: "SYSTEM",
    action: "conversation.interest_check_prepared",
    entityType: "InterestCheck",
    entityId: interestCheck.id,
    metadata: {
      interestCheckId: interestCheck.id,
      status: interestCheck.status,
      knownFieldsCount: knownFieldsCount(draft),
      missingRequiredFields,
      source: "mock_admin",
      senderRedacted: redactPhoneForDisplay(normalizedPhone),
      replyType: generatedReply.replyType,
      enoughInfoForInterestCheck: replyPlan.enoughInfoForInterestCheck,
      convertedProjectId: interestCheck.convertedProjectId,
      noProjectConversion: true,
      noTicketingRsvpQrPayment: true,
    },
  });

  return { person, interestCheck, draft };
}
