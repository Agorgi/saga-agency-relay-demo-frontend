import {
  organizerGeneratedReplySchema,
  type ConversationContext,
  type OrganizerGeneratedReply,
  type ReplyPlan,
} from "@/sms-engine/conversation/conversationTypes";

const escalationReply =
  "I want to make sure we handle that carefully. I'm going to flag this for the Saga team before moving forward.";
const briefReadyReply =
  "Got it. I'm going to turn this into a brief and start mapping the kind of team that could bring it to life. I'll follow up once we've checked who may be a fit.";
const fallbackReply =
  "Got it. Give me the clearest next detail you know, and I'll keep shaping this into a production brief.";

const stageQuestions: Record<string, string> = {
  ASK_FIRST_TIME_HOST:
    "Love this. Have you hosted something like this before, or would this be your first one?",
  ASK_LOCATION:
    "Great. What city or general location are you thinking for this?",
  ASK_PROJECT_CONCEPT:
    "Nice. Give me the core concept in a sentence or two - what are we making happen?",
  ASK_SCOPE_VIBE:
    "What kind of vibe are you imagining - casual meetup, polished production, pop-up, photoshoot, party, or something else?",
};

const forbiddenPromisePattern =
  /\b(guarantee|guaranteed|promise|confirmed team|confirmed venue|venue access|ticket sales|revenue|celebrity|influencer participation|paid work|payment confirmed|booking confirmed)\b/i;

function safeReply(text: string) {
  return forbiddenPromisePattern.test(text) ? fallbackReply : text;
}

export function generateOrganizerReplyFromPlan(input: {
  context: ConversationContext;
  replyPlan: ReplyPlan;
  latestMessage: string;
}): OrganizerGeneratedReply {
  const { replyPlan } = input;
  let replyText = fallbackReply;
  let replyType: OrganizerGeneratedReply["replyType"] = "fallback";

  if (replyPlan.shouldEscalate) {
    replyText = escalationReply;
    replyType = "needs_admin";
  } else if (replyPlan.enoughInfoForBrief || replyPlan.nextStage === "BRIEF_READY") {
    replyText = briefReadyReply;
    replyType = "brief_ready";
  } else if (replyPlan.nextQuestion) {
    replyText =
      stageQuestions[replyPlan.nextStage] || safeReply(replyPlan.nextQuestion);
    replyType = "ask_next_question";
  }

  return organizerGeneratedReplySchema.parse({
    replyText: safeReply(replyText),
    replyType,
    source: "conversation_engine",
    metadata: {
      stage: replyPlan.stage,
      nextStage: replyPlan.nextStage,
      enoughInfoForBrief: replyPlan.enoughInfoForBrief,
      shouldEscalate: replyPlan.shouldEscalate,
      confidence: replyPlan.confidence,
    },
  });
}
