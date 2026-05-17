import type { LlmReviewItem, LlmReviewStatus, Prisma } from "@prisma/client";
import { redactSensitiveTextForDisplay } from "@/sms-engine/adminPrivacy";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";
import { containsForbiddenLlmClaim, compactLlmText } from "@/sms-engine/llm/llmTypes";
import { logServerError, redactForLog } from "@/sms-engine/safeLogging";

export const LLM_REVIEW_STATUSES: LlmReviewStatus[] = [
  "UNREVIEWED",
  "GOOD",
  "TOO_VERBOSE",
  "WRONG_NEXT_QUESTION",
  "UNSAFE",
  "CONFUSING",
  "BETTER_THAN_FALLBACK",
  "WORSE_THAN_FALLBACK",
  "NEEDS_PROMPT_TUNING",
];

export type LlmReviewValidationStatus =
  | "VALID"
  | "INVALID"
  | "PROVIDER_FAILED"
  | "FORBIDDEN_CLAIMS"
  | "SKIPPED";

export type LlmReviewComparisonInput = {
  operation: string;
  flow?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  provider: string;
  model: string;
  mode: string;
  fallbackValue?: unknown;
  llmValue?: unknown;
  selectedValue?: unknown;
  selectedReplySource?: string | null;
  validationStatus: LlmReviewValidationStatus | string;
  safetyFlags?: unknown;
  forbiddenClaimsDetected?: boolean;
  fallbackUsed: boolean;
  fallbackReason?: string | null;
  toneReviewStatus?: string | null;
};

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function textFromValue(value: unknown): string | null {
  if (isString(value)) return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  for (const key of [
    "replyText",
    "reply",
    "message",
    "body",
    "selectedText",
    "organizerFacingSummary",
  ]) {
    if (isString(record[key])) return record[key];
  }

  const keys = Object.keys(record).filter((key) => record[key] !== undefined);
  return keys.length ? `Structured output fields: ${keys.join(", ")}` : null;
}

export function safeLlmReviewText(value: unknown) {
  const text = textFromValue(value);
  if (!text) return null;
  const redacted = redactForLog(text);
  return typeof redacted === "string" ? compactLlmText(redacted, 1200) : null;
}

function normalizedString(value: unknown) {
  return isString(value) ? value.trim() : null;
}

export function inferLlmReviewFlow({
  operation,
  metadata = {},
}: {
  operation: string;
  metadata?: Record<string, unknown>;
}) {
  const flow = normalizedString(metadata.flow);
  if (flow) {
    const normalized = flow.toLowerCase();
    if (normalized.includes("organizer")) return "organizer";
    if (normalized.includes("gig") || normalized.includes("creator")) {
      return "gig_seeker";
    }
    if (normalized.includes("interest")) return "interest_check";
    if (normalized.includes("contact")) return "contact_reply";
    if (normalized.includes("producer")) return "producer_agent";
  }

  const operationText = operation.toLowerCase();
  if (operationText.includes("organizer") || operationText.includes("brief")) {
    return "organizer";
  }
  if (operationText.includes("gig") || operationText.includes("creator")) {
    return "gig_seeker";
  }
  if (operationText.includes("interest")) return "interest_check";
  if (operationText.includes("contact")) return "contact_reply";
  return "producer_agent";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function idFromMetadata(
  metadata: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = normalizedString(metadata[key]);
    if (value) return value;
  }
  return null;
}

export function suggestLlmToneReviewStatus({
  deterministicText,
  llmText,
  expectedNextQuestion,
}: {
  deterministicText?: string | null;
  llmText?: string | null;
  expectedNextQuestion?: string | null;
}): LlmReviewStatus {
  const text = llmText?.trim() || "";
  if (!text) return "CONFUSING";
  if (containsForbiddenLlmClaim(text)) return "UNSAFE";
  if (text.length > 360 || text.split(/\s+/).length > 70) {
    return "TOO_VERBOSE";
  }

  const expected = expectedNextQuestion?.toLowerCase().match(/[a-z]{4,}/g) || [];
  if (expected.length > 0) {
    const lower = text.toLowerCase();
    const overlap = expected.filter((word) => lower.includes(word)).length;
    if (overlap === 0) return "WRONG_NEXT_QUESTION";
  }

  if (deterministicText && text.length < deterministicText.length * 0.65) {
    return "BETTER_THAN_FALLBACK";
  }

  return "GOOD";
}

function linkIds(input: LlmReviewComparisonInput) {
  const metadata = input.metadata || {};
  return {
    projectBriefId:
      idFromMetadata(metadata, ["projectBriefId"]) ||
      (input.entityType === "ProjectBrief" ? input.entityId || null : null),
    personId:
      idFromMetadata(metadata, ["personId"]) ||
      (input.entityType === "Person" ? input.entityId || null : null),
    messageId:
      idFromMetadata(metadata, ["messageId", "inboundMessageId"]) ||
      (input.entityType === "Message" ? input.entityId || null : null),
  };
}

export function normalizeLlmReviewStatus(
  value?: FormDataEntryValue | string | null,
): LlmReviewStatus {
  return LLM_REVIEW_STATUSES.includes(value as LlmReviewStatus)
    ? (value as LlmReviewStatus)
    : "UNREVIEWED";
}

export function buildLlmReviewItemData(
  input: LlmReviewComparisonInput,
): Prisma.LlmReviewItemUncheckedCreateInput {
  const metadata = input.metadata || {};
  const ids = linkIds(input);
  const deterministicText = safeLlmReviewText(input.fallbackValue);
  const llmText = safeLlmReviewText(input.llmValue);
  const selectedText = safeLlmReviewText(input.selectedValue);
  const forbiddenClaimsDetected = Boolean(
    input.forbiddenClaimsDetected ||
      containsForbiddenLlmClaim(input.llmValue) ||
      containsForbiddenLlmClaim(selectedText),
  );
  const fallbackReason =
    normalizedString(input.fallbackReason) ||
    normalizedString(metadata.fallbackReason) ||
    null;
  const safetyFlags = stringArray(input.safetyFlags || metadata.safetyFlags);
  const toneReviewStatus =
    normalizedString(input.toneReviewStatus) ||
    suggestLlmToneReviewStatus({
      deterministicText,
      llmText,
      expectedNextQuestion: normalizedString(metadata.nextQuestion),
    });

  return {
    operation: input.operation,
    flow: inferLlmReviewFlow({
      operation: input.operation,
      metadata: { ...metadata, flow: input.flow || metadata.flow },
    }),
    projectBriefId: ids.projectBriefId,
    personId: ids.personId,
    messageId: ids.messageId,
    provider: input.provider,
    model: input.model,
    mode: input.mode,
    deterministicText,
    llmText,
    selectedText,
    selectedReplySource: input.selectedReplySource || null,
    validationStatus: input.validationStatus,
    safetyFlags: safetyFlags as Prisma.InputJsonValue,
    forbiddenClaimsDetected,
    fallbackUsed: input.fallbackUsed,
    fallbackReason,
    toneReviewStatus,
    needsReview:
      input.fallbackUsed ||
      forbiddenClaimsDetected ||
      input.validationStatus !== "VALID" ||
      !["GOOD", "BETTER_THAN_FALLBACK"].includes(toneReviewStatus),
  };
}

export async function recordLlmReviewItem(input: LlmReviewComparisonInput) {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await getDb().llmReviewItem.create({
      data: buildLlmReviewItemData(input),
    });
  } catch (error) {
    logServerError("Failed to record LLM review item", error, {
      entityType: "LLM",
      entityId: input.operation,
      metadata: {
        operation: input.operation,
        provider: input.provider,
        mode: input.mode,
      },
    });
    return null;
  }
}

export function buildLlmReviewUpdateData({
  reviewStatus,
  reviewerNotes,
}: {
  reviewStatus?: FormDataEntryValue | string | null;
  reviewerNotes?: FormDataEntryValue | string | null;
}): Prisma.LlmReviewItemUpdateInput {
  const notes = typeof reviewerNotes === "string" ? reviewerNotes.trim() : "";
  return {
    reviewStatus: normalizeLlmReviewStatus(reviewStatus),
    reviewerNotes: notes ? redactSensitiveTextForDisplay(notes) : null,
  };
}

export async function updateLlmReviewItem({
  id,
  reviewStatus,
  reviewerNotes,
}: {
  id: string;
  reviewStatus?: FormDataEntryValue | string | null;
  reviewerNotes?: FormDataEntryValue | string | null;
}) {
  const data = buildLlmReviewUpdateData({ reviewStatus, reviewerNotes });
  const item = await getDb().llmReviewItem.update({
    where: { id },
    data,
  });

  await logAudit({
    actorType: "ADMIN",
    action: "llm.review_item_updated",
    entityType: "LlmReviewItem",
    entityId: item.id,
    metadata: {
      operation: item.operation,
      flow: item.flow,
      reviewStatus: item.reviewStatus,
      hasReviewerNotes: Boolean(item.reviewerNotes),
    },
  });

  return item;
}

export function safeLlmReviewItemForDisplay(
  item: Pick<
    LlmReviewItem,
    | "id"
    | "operation"
    | "flow"
    | "provider"
    | "model"
    | "mode"
    | "deterministicText"
    | "llmText"
    | "selectedText"
    | "selectedReplySource"
    | "validationStatus"
    | "safetyFlags"
    | "forbiddenClaimsDetected"
    | "fallbackUsed"
    | "fallbackReason"
    | "toneReviewStatus"
    | "needsReview"
    | "reviewStatus"
    | "reviewerNotes"
    | "projectBriefId"
    | "personId"
    | "messageId"
    | "createdAt"
    | "updatedAt"
  >,
) {
  return {
    ...item,
    deterministicText: redactSensitiveTextForDisplay(item.deterministicText),
    llmText: redactSensitiveTextForDisplay(item.llmText),
    selectedText: redactSensitiveTextForDisplay(item.selectedText),
    reviewerNotes: redactSensitiveTextForDisplay(item.reviewerNotes),
  };
}

export async function getLlmQualityReviewHealthSnapshot() {
  if (!process.env.DATABASE_URL) {
    return {
      llmQualityReviewAvailable: true,
      llmReviewItemCount: null,
    };
  }

  try {
    const llmReviewItemCount = await getDb().llmReviewItem.count();
    return {
      llmQualityReviewAvailable: true,
      llmReviewItemCount,
    };
  } catch {
    return {
      llmQualityReviewAvailable: true,
      llmReviewItemCount: null,
    };
  }
}
