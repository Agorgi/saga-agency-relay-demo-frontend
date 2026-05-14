import {
  contactReplyGeneratedReplySchema,
  type ContactReplyGeneratedReply,
  type ContactReplyKind,
  type ConversationContext,
  type ReplyPlan,
} from "@/sms-engine/conversation/conversationTypes";

const consentReply =
  "Amazing - can I introduce you in a group text with the organizer and a few other team members for this project?";
const declineReply = "Totally understood - thanks for letting me know.";
const maybeReply =
  "Totally fair. I can keep you in consideration while we clarify the details.";
const needsAdminReply =
  "I want to make sure we handle that carefully. I'm going to flag this for the Saga team before moving forward.";
const paymentQuestionReply =
  "Good question. I don't want to guess on terms - I'm going to flag this for the Saga team before moving forward.";
const consentConfirmedReply =
  "Great - I'll mark that you're okay being introduced. A human on the Saga team may still review before any group intro.";
const helpReply =
  "Saga helps coordinate creative projects and production teams. Reply STOP to opt out, or send YES, NO, or MAYBE if this is about a project outreach.";
const fallbackReply =
  "Thanks - I don't want to over-assume your interest. A human on the Saga team can review this before moving forward.";

const forbiddenPromisePattern =
  /\b(guarantee|guaranteed|promise|confirmed placement|confirmed team|confirmed booking|you will get|paid work guaranteed|ticket sales|revenue|venue access|celebrity|influencer)\b/i;

function safeReply(text: string) {
  return forbiddenPromisePattern.test(text) ? needsAdminReply : text;
}

export function generateContactReplyFromPlan(input: {
  context: ConversationContext;
  replyPlan: ReplyPlan;
  latestMessage: string;
  replyKind: ContactReplyKind;
}): ContactReplyGeneratedReply {
  const { context, replyPlan, replyKind } = input;
  let replyText = fallbackReply;
  let replyType: ContactReplyGeneratedReply["replyType"] = "fallback";

  if (replyKind === "HELP") {
    replyText = helpReply;
    replyType = "help";
  } else if (
    replyPlan.shouldEscalate ||
    replyPlan.nextStage === "NEEDS_ADMIN" ||
    replyKind === "RATE_OR_PAYMENT_QUESTION" ||
    replyKind === "AVAILABILITY_QUESTION"
  ) {
    replyText =
      replyKind === "RATE_OR_PAYMENT_QUESTION" ||
      replyKind === "AVAILABILITY_QUESTION"
        ? paymentQuestionReply
        : needsAdminReply;
    replyType = "needs_admin";
  } else if (replyPlan.nextStage === "INTERESTED") {
    replyText = consentReply;
    replyType = "ask_consent";
  } else if (
    replyPlan.nextStage === "DECLINED" ||
    replyPlan.nextStage === "CONSENT_DECLINED"
  ) {
    replyText = declineReply;
    replyType = "acknowledge_decline";
  } else if (replyPlan.nextStage === "MAYBE") {
    replyText = maybeReply;
    replyType = "maybe_followup";
  } else if (replyPlan.nextStage === "CONSENT_CONFIRMED") {
    replyText = consentConfirmedReply;
    replyType = "fallback";
  } else if (replyPlan.nextQuestion) {
    replyText = replyPlan.nextQuestion;
  }

  return contactReplyGeneratedReplySchema.parse({
    replyText: safeReply(replyText),
    replyType,
    source: "conversation_engine",
    metadata: {
      stage: replyPlan.stage,
      nextStage: replyPlan.nextStage,
      replyKind,
      hasActiveOutreach: Boolean(context.activeOutreach),
      consentToGroupChat: Boolean(context.activeOutreach?.consentToGroupChat),
      shouldEscalate: replyPlan.shouldEscalate,
      confidence: replyPlan.confidence,
    },
  });
}
