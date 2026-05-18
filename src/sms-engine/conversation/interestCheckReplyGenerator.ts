import {
  interestCheckGeneratedReplySchema,
  type ConversationContext,
  type InterestCheckGeneratedReply,
  type ReplyPlan,
} from "@/sms-engine/conversation/conversationTypes";

const escalationReply =
  "I want to make sure we handle that carefully. I'm going to flag this for the Saga team before moving forward.";
const interestCheckReadyReply =
  "Got it. This sounds like something Saga could turn into an interest-check concept for the team to review. We can use it to understand whether there's enough demand before treating it like a real project.";
const fallbackReply =
  "Got it. Tell me a little more about what you want to see exist, and I'll keep shaping this as an interest-check concept.";

const stageQuestions: Record<string, string> = {
  ASK_LOCATION: "Where would you want this to happen?",
  ASK_FANDOM_OR_AUDIENCE: "What fandom, scene, or community would this be for?",
  ASK_IDEA_SCOPE:
    "What kind of format are you imagining - meetup, picnic, pop-up, cafe night, party, photoshoot, or something else?",
  ASK_INTEREST_SIGNAL:
    "Would you want to help organize it?",
  ASK_TIMING:
    "Is there a rough timing that would make sense — or is it still fuzzy?",
};

const forbiddenPromisePattern =
  /\b(event will happen|will happen|guarantee|guaranteed|promise|confirmed venue|confirmed team|ticket sales|revenue|attendance guaranteed|we will find|we'll find|paid work|creator participation|venue access)\b/i;

function safeReply(text: string) {
  return forbiddenPromisePattern.test(text) ? fallbackReply : text;
}

export function generateInterestCheckReplyFromPlan(input: {
  context: ConversationContext;
  replyPlan: ReplyPlan;
  latestMessage: string;
}): InterestCheckGeneratedReply {
  const { replyPlan } = input;
  let replyText = fallbackReply;
  let replyType: InterestCheckGeneratedReply["replyType"] = "fallback";

  if (replyPlan.shouldEscalate) {
    replyText = escalationReply;
    replyType = "needs_admin";
  } else if (
    replyPlan.enoughInfoForInterestCheck ||
    replyPlan.nextStage === "INTEREST_CHECK_READY"
  ) {
    replyText = interestCheckReadyReply;
    replyType = "interest_check_ready";
  } else if (replyPlan.nextQuestion) {
    replyText =
      stageQuestions[replyPlan.nextStage] || safeReply(replyPlan.nextQuestion);
    replyType = "ask_next_question";
  }

  return interestCheckGeneratedReplySchema.parse({
    replyText: safeReply(replyText),
    replyType,
    source: "conversation_engine",
    metadata: {
      stage: replyPlan.stage,
      nextStage: replyPlan.nextStage,
      enoughInfoForInterestCheck: Boolean(replyPlan.enoughInfoForInterestCheck),
      shouldEscalate: replyPlan.shouldEscalate,
      confidence: replyPlan.confidence,
    },
  });
}
