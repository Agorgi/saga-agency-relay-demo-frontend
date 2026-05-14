import {
  gigSeekerGeneratedReplySchema,
  type ConversationContext,
  type GigSeekerGeneratedReply,
  type ReplyPlan,
} from "@/lib/conversation/conversationTypes";

const escalationReply =
  "I want to make sure we handle that carefully. I'm going to flag this for the Saga team before moving forward.";
const profileReadyReply =
  "Amazing. I can turn this into a Saga creator profile so the team can review it for relevant opportunities. We'll be careful not to promise bookings, but this helps us understand where you may be a fit.";
const fallbackReply =
  "Got it. Tell me a little more about the kind of creative work you do, and I'll keep shaping this for review.";

const stageQuestions: Record<string, string> = {
  ASK_LOCATION: "Amazing - what city are you based in?",
  ASK_GIG_TYPES:
    "What kinds of gigs are you looking for? For example: photography, cosplay appearances, hosting, DJing, design, vendor work, or something else.",
  ASK_LINKS:
    "Do you have an Instagram, portfolio, website, TikTok, LinkedIn, or anything else that shows your work?",
  ASK_FANDOMS: "Which fandoms, scenes, or communities do you know best?",
  ASK_SKILLS: "What skills or services should Saga know you can bring?",
  ASK_AVAILABILITY:
    "Any availability notes the team should know, like weekends, evenings, or specific dates?",
};

const forbiddenPromisePattern =
  /\b(guarantee|guaranteed|promise|you will get|we will book|confirmed booking|confirmed placement|paid work guaranteed|guaranteed paid work|guaranteed gigs|income|revenue)\b/i;

function safeReply(text: string) {
  const normalized = text.replace(/\bnot to promise bookings\b/gi, "");
  return forbiddenPromisePattern.test(normalized) ? fallbackReply : text;
}

export function generateGigSeekerReplyFromPlan(input: {
  context: ConversationContext;
  replyPlan: ReplyPlan;
  latestMessage: string;
}): GigSeekerGeneratedReply {
  const { replyPlan } = input;
  let replyText = fallbackReply;
  let replyType: GigSeekerGeneratedReply["replyType"] = "fallback";

  if (replyPlan.shouldEscalate) {
    replyText = escalationReply;
    replyType = "needs_admin";
  } else if (
    replyPlan.enoughInfoForProfileReview ||
    replyPlan.nextStage === "PROFILE_READY_FOR_REVIEW"
  ) {
    replyText = profileReadyReply;
    replyType = "profile_ready_for_review";
  } else if (replyPlan.nextQuestion) {
    replyText =
      stageQuestions[replyPlan.nextStage] || safeReply(replyPlan.nextQuestion);
    replyType = "ask_next_question";
  }

  return gigSeekerGeneratedReplySchema.parse({
    replyText: safeReply(replyText),
    replyType,
    source: "conversation_engine",
    metadata: {
      stage: replyPlan.stage,
      nextStage: replyPlan.nextStage,
      enoughInfoForProfileReview: Boolean(replyPlan.enoughInfoForProfileReview),
      shouldEscalate: replyPlan.shouldEscalate,
      confidence: replyPlan.confidence,
    },
  });
}
