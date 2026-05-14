import { assessMessageSafety } from "@/sms-engine/safety";
import {
  contactReplyKindSchema,
  replyPlanSchema,
  type ContactReplyKind,
  type ContactReplyStage,
  type ConversationContext,
  type ReplyPlan,
} from "@/sms-engine/conversation/conversationTypes";

const CONSENT_QUESTION =
  "Amazing - can I introduce you in a group text with the organizer and a few other team members for this project?";
const QUESTION_REPLY =
  "Good question. I'm going to flag this for the Saga team so we do not guess on details.";
const UNKNOWN_REPLY =
  "Thanks - I do not want to over-assume your interest. A human on the Saga team can review this before moving forward.";
const HELP_REPLY =
  "Saga helps coordinate creative projects and production teams. Reply STOP to opt out, or send a clear YES, NO, or MAYBE if this is about a project outreach.";

const allowedActions = [
  "persist_inbound_message",
  "classify_contact_reply",
  "audit_reply_plan",
];

const blockedActions = [
  "create_group_chat",
  "add_group_chat_participant",
  "add_to_team",
  "confirm_team_membership",
  "promise_paid_work",
  "promise_booking",
  "promise_rates",
  "promise_ticket_sales",
  "promise_revenue",
  "promise_venue_access",
  "promise_attendance",
  "send_live_outreach_without_admin",
];

function normalized(body: string) {
  return body.trim().toLowerCase().replace(/\s+/g, " ");
}

function isStopIntent(body: string) {
  return /^(stop|stopall|unsubscribe|cancel|end|quit)$/i.test(body.trim());
}

function isStartIntent(body: string) {
  return /^(start|unstop)$/i.test(body.trim());
}

function isHelpIntent(body: string) {
  return /^(help|support|help me)$/i.test(body.trim());
}

function isConsentPromptActive(context: ConversationContext) {
  const status = context.activeOutreach?.status;
  return status === "INTERESTED" && !context.activeOutreach?.consentToGroupChat;
}

function hasActiveOutreach(context: ConversationContext) {
  return Boolean(context.activeOutreach || context.activeOutreachId);
}

function isOptedOut(context: ConversationContext) {
  return Boolean(
    context.optedOut ||
      context.person?.optedOut ||
      context.contact?.smsOptedOutAt,
  );
}

function detectContactReplyKind(
  body: string,
  context: ConversationContext,
): ContactReplyKind {
  const text = normalized(body);
  const consentPromptActive = isConsentPromptActive(context);

  if (isStopIntent(body)) return "STOP";
  if (isStartIntent(body)) return "START";
  if (isHelpIntent(body)) return "HELP";
  if (
    /\b(rate|rates|paid|pay|payment|compensation|budget|fee|price|pricing|how much|contract|agreement|deposit|invoice|terms|booked|booking|placement|guarantee|guaranteed)\b|\$/i.test(
      text,
    )
  ) {
    return "RATE_OR_PAYMENT_QUESTION";
  }
  if (consentPromptActive) {
    if (
      /\b(no|nope|not yet|don't add|do not add|dont add|do not introduce|don't introduce|just send info|send me info|not now)\b/i.test(
        text,
      )
    ) {
      return "CONSENT_NO";
    }
    if (
      /\b(yes|yeah|yep|sure|go for it|you can introduce|introduce me|add me|sounds good|ok|okay)\b/i.test(
        text,
      )
    ) {
      return "CONSENT_YES";
    }
  }
  if (/\b(no|nope|not interested|pass|can't|cannot|do not|don't)\b/i.test(text)) {
    return "NO_DECLINED";
  }
  if (
    /\b(yes|yeah|yep|sure|happy to|interested|open to|sounds good|ok|okay)\b/i.test(
      text,
    )
  ) {
    return "YES_INTERESTED";
  }
  if (/\b(maybe|possibly|depends|send info|more info|not sure)\b/i.test(text)) {
    return "MAYBE_INTERESTED";
  }
  if (/\b(available|availability|date|dates|schedule|when|time|timing)\b/i.test(text)) {
    return "AVAILABILITY_QUESTION";
  }
  if (
    /\b(what is this|who is this|why are you texting|why did you text|what project|tell me more|send details|more details|can you explain)\b/i.test(
      text,
    )
  ) {
    return "QUESTION";
  }

  return "UNKNOWN";
}

function currentStage(context: ConversationContext): ContactReplyStage {
  if (isOptedOut(context)) return "OPTED_OUT";
  if (!hasActiveOutreach(context)) return "NO_ACTIVE_OUTREACH";
  if (context.activeOutreach?.consentToGroupChat) return "CONSENT_CONFIRMED";
  if (context.activeOutreach?.status === "INTERESTED") return "CONSENT_REQUESTED";
  if (context.activeOutreach?.status === "NOT_INTERESTED") return "DECLINED";
  if (context.activeOutreach?.status === "MAYBE") return "MAYBE";
  if (context.activeOutreach?.status === "SENT") return "OUTREACH_SENT";
  return "CLASSIFY_REPLY";
}

function nextStageFor({
  context,
  replyKind,
  shouldEscalate,
}: {
  context: ConversationContext;
  replyKind: ContactReplyKind;
  shouldEscalate: boolean;
}): ContactReplyStage {
  if (replyKind === "STOP") return "OPTED_OUT";
  if (replyKind === "HELP") return "HELP_REQUESTED";
  if (replyKind === "START") {
    return hasActiveOutreach(context) ? "OUTREACH_SENT" : "NO_ACTIVE_OUTREACH";
  }
  if (isOptedOut(context)) return "OPTED_OUT";
  if (shouldEscalate) return "NEEDS_ADMIN";
  if (!hasActiveOutreach(context)) return "NO_ACTIVE_OUTREACH";
  if (replyKind === "CONSENT_YES") return "CONSENT_CONFIRMED";
  if (replyKind === "CONSENT_NO") return "CONSENT_DECLINED";
  if (replyKind === "YES_INTERESTED") {
    return context.activeOutreach?.consentToGroupChat
      ? "CONSENT_CONFIRMED"
      : "INTERESTED";
  }
  if (replyKind === "NO_DECLINED") return "DECLINED";
  if (replyKind === "MAYBE_INTERESTED") return "MAYBE";
  if (
    replyKind === "QUESTION" ||
    replyKind === "AVAILABILITY_QUESTION" ||
    replyKind === "UNKNOWN"
  ) {
    return "QUESTION_OR_CLARIFICATION";
  }
  return currentStage(context);
}

function proposedReplyFor({
  replyKind,
  nextStage,
  shouldEscalate,
}: {
  replyKind: ContactReplyKind;
  nextStage: ContactReplyStage;
  shouldEscalate: boolean;
}) {
  if (replyKind === "HELP") return HELP_REPLY;
  if (shouldEscalate || nextStage === "NEEDS_ADMIN") return QUESTION_REPLY;
  if (nextStage === "INTERESTED") return CONSENT_QUESTION;
  if (nextStage === "DECLINED" || nextStage === "CONSENT_DECLINED") {
    return "Totally understood - thanks for letting me know.";
  }
  if (nextStage === "MAYBE") {
    return "Totally fair. I can keep you in consideration while we clarify the details.";
  }
  if (nextStage === "CONSENT_CONFIRMED") {
    return "Great - I'll mark that you're okay being introduced. A human on the Saga team may still review before any group intro.";
  }
  if (
    replyKind === "RATE_OR_PAYMENT_QUESTION" ||
    replyKind === "AVAILABILITY_QUESTION" ||
    replyKind === "QUESTION"
  ) {
    return QUESTION_REPLY;
  }
  return UNKNOWN_REPLY;
}

function escalationForKind(replyKind: ContactReplyKind, safetyNeedsAdmin: boolean) {
  return (
    safetyNeedsAdmin ||
    replyKind === "RATE_OR_PAYMENT_QUESTION" ||
    replyKind === "AVAILABILITY_QUESTION"
  );
}

export function evaluateContactReplyPolicy({
  context,
  latestMessage,
}: {
  context: ConversationContext;
  latestMessage: string;
}) {
  const safety = assessMessageSafety(latestMessage);
  const hasOutreach = hasActiveOutreach(context);
  const rawReplyKind = contactReplyKindSchema.parse(
    detectContactReplyKind(latestMessage, context),
  );
  const replyKind = contactReplyKindSchema.parse(
    !hasOutreach &&
      ![
        "STOP",
        "START",
        "HELP",
        "RATE_OR_PAYMENT_QUESTION",
        "AVAILABILITY_QUESTION",
      ].includes(rawReplyKind)
      ? "UNKNOWN"
      : rawReplyKind,
  );
  const shouldEscalate = escalationForKind(replyKind, safety.needsAdmin);
  const stage = currentStage(context);
  const nextStage = nextStageFor({ context, replyKind, shouldEscalate });
  const consentToGroupChat =
    nextStage === "CONSENT_CONFIRMED" ||
    Boolean(context.activeOutreach?.consentToGroupChat);
  const nextQuestion = proposedReplyFor({
    replyKind,
    nextStage,
    shouldEscalate,
  });
  const replyPlan: ReplyPlan = replyPlanSchema.parse({
    flow: "CONTACT_REPLY",
    stage,
    nextStage,
    enoughInfoForBrief: false,
    enoughInfoForProfileReview: false,
    enoughInfoForInterestCheck: false,
    shouldEscalate,
    escalationReason: shouldEscalate
      ? [...safety.flags, replyKind].filter(Boolean).join(", ")
      : undefined,
    nextQuestion,
    replyTone: "professional_friendly_casual",
    allowedActions,
    blockedActions,
    explanationForAudit: [
      hasOutreach
        ? "Active outreach/contact context is present."
        : "No active outreach context is present; reply is not treated as interest.",
      `Reply kind: ${replyKind}.`,
      `Consent before: ${Boolean(context.activeOutreach?.consentToGroupChat)}.`,
      `Consent after: ${consentToGroupChat}.`,
      shouldEscalate
        ? `Escalation required: ${[...safety.flags, replyKind].join(", ")}.`
        : "No deterministic escalation required.",
    ].join(" "),
    confidence:
      replyKind === "UNKNOWN"
        ? 0.45
        : !hasOutreach && !["STOP", "START", "HELP"].includes(replyKind)
          ? 0.55
          : 0.86,
  });

  return {
    replyPlan,
    replyKind,
    hasActiveOutreach: hasOutreach,
    currentOutreachStatus: context.activeOutreach?.status || null,
    consentToGroupChat,
    consentBefore: Boolean(context.activeOutreach?.consentToGroupChat),
    shouldEscalate,
    safetyFlags: safety.flags,
  };
}
