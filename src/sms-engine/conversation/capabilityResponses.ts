import {
  replyPlanSchema,
  type ConversationContext,
  type IntentSuggestedFlow,
  type ReplyPlan,
} from "@/sms-engine/conversation/conversationTypes";

export type CapabilityResponseKind =
  | "GENERAL"
  | "HOW_IT_WORKS"
  | "WHAT_CAN_I_ASK"
  | "BOT_DISCLOSURE"
  | "TALENT_SEARCH"
  | "GIG_SEEKER"
  | "GUARANTEE"
  | "EVENT_PLANNING"
  | "INTEREST_CHECK"
  | "NEXT_STEPS"
  | "HELP";

export type CapabilityResponseMatch = {
  matched: boolean;
  kind: CapabilityResponseKind;
  confidence: number;
  reasons: string[];
  matchedSignals: string[];
  suggestedFlow: IntentSuggestedFlow;
  shouldEscalate: boolean;
};

export type CapabilityGeneratedReply = {
  replyText: string;
  replyType:
    | "capability_answer"
    | "route_to_organizer"
    | "route_to_creator"
    | "route_to_interest_check"
    | "needs_admin"
    | "help";
  responseKind: CapabilityResponseKind;
  shouldEscalate: boolean;
  suggestedFlow: IntentSuggestedFlow;
  source: "conversation_engine";
};

const blockedActions = [
  "promise_booking",
  "promise_paid_opportunity",
  "promise_revenue",
  "promise_attendance",
  "promise_venue_access",
  "promise_confirmed_team",
  "promise_candidate_availability",
  "send_sms",
  "send_candidate_outreach",
  "create_group_chat",
  "publish_public_beta",
];

const allowedActions = [
  "answer_capability_question",
  "route_user_to_safe_intake_lane",
  "audit_reply_plan",
];

function normalizedText(body: string) {
  return body.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function capabilityMatch(input: Omit<CapabilityResponseMatch, "matched">) {
  return { matched: true, ...input };
}

export function detectCapabilityFaq(body: string): CapabilityResponseMatch {
  const text = normalizedText(body);

  if (!text) {
    return {
      matched: false,
      kind: "GENERAL",
      confidence: 0,
      reasons: [],
      matchedSignals: [],
      suggestedFlow: "unknown",
      shouldEscalate: false,
    };
  }

  if (
    !/\b(rate|payment|ticket|sales|attendance|venue|team|revenue)\b/i.test(text) &&
    matchAny(text, [
      /\b(can you|could you|can saga|could saga).{0,28}\bguarantee\b.{0,36}\b(i'?ll|i will|i get|get booked|booked|booking|paid gigs?|paid opportunities?|paid work|gigs?)\b/,
      /\b(can you|could you|can saga|could saga).{0,28}\bpromise\b.{0,36}\b(i'?ll|i will|i get|get booked|paid gigs?|paid opportunities?|paid work|gigs?)\b/,
    ])
  ) {
    return capabilityMatch({
      kind: "GUARANTEE",
      confidence: 0.96,
      reasons: ["user asked about a guarantee or firm commitment"],
      matchedSignals: ["guarantee"],
      suggestedFlow: "admin_review",
      shouldEscalate: true,
    });
  }

  if (
    matchAny(text, [
      /^(help|support|help me)$/,
      /\bwhat can i ask (you|saga)\b/,
      /\bwhat should i text\b/,
      /\bwhat can you help (with|me with)\b/,
    ])
  ) {
    return capabilityMatch({
      kind: text === "help" || text === "support" || text === "help me" ? "HELP" : "WHAT_CAN_I_ASK",
      confidence: 0.94,
      reasons: ["user asked what Saga can help with"],
      matchedSignals: ["help_or_askable"],
      suggestedFlow: text === "help" || text === "support" ? "help" : "capability_faq",
      shouldEscalate: false,
    });
  }

  if (
    matchAny(text, [
      /\bwhat do you do\b/,
      /\bwhat does saga do\b/,
      /\bwhat is saga\b/,
      /\bwho are you\b/,
    ])
  ) {
    return capabilityMatch({
      kind: "GENERAL",
      confidence: 0.92,
      reasons: ["user asked for a general capability explanation"],
      matchedSignals: ["what_do_you_do"],
      suggestedFlow: "capability_faq",
      shouldEscalate: false,
    });
  }

  if (
    matchAny(text, [
      /\bhow does (this|it|saga) work\b/,
      /\bhow do(es)? (i|we) use (this|saga)\b/,
      /\bwhat happens when i text\b/,
    ])
  ) {
    return capabilityMatch({
      kind: "HOW_IT_WORKS",
      confidence: 0.9,
      reasons: ["user asked how the pilot works"],
      matchedSignals: ["how_it_works"],
      suggestedFlow: "capability_faq",
      shouldEscalate: false,
    });
  }

  if (
    matchAny(text, [
      /\bare you (a )?(bot|robot|ai)\b/,
      /\bis this (a )?(bot|ai)\b/,
      /\bam i texting (a )?(bot|ai)\b/,
    ])
  ) {
    return capabilityMatch({
      kind: "BOT_DISCLOSURE",
      confidence: 0.9,
      reasons: ["user asked whether Saga is automated"],
      matchedSignals: ["bot_disclosure"],
      suggestedFlow: "capability_faq",
      shouldEscalate: false,
    });
  }

  if (
    matchAny(text, [
      /\b(can you|could you|can saga|could saga).{0,36}\b(find|source|recommend|look for).{0,36}\b(talent|people|creator|creators|photographer|dj|host|cosplayer|artist|venue|team)\b/,
      /\b(find|source|recommend).{0,24}\b(a |an |some )?(photographer|dj|host|cosplayer|artist|venue|team|talent)\b/,
    ])
  ) {
    return capabilityMatch({
      kind: "TALENT_SEARCH",
      confidence: 0.91,
      reasons: ["user asked whether Saga can help look for people"],
      matchedSignals: ["talent_search"],
      suggestedFlow: "organizer_intake",
      shouldEscalate: false,
    });
  }

  if (
    matchAny(text, [
      /\b(can you|could you|can saga|could saga).{0,36}\b(find|get|help me get|connect me with).{0,36}\b(gig|gigs|bookings?|paid opportunities|paid)\b/,
      /\b(can you|could you|can saga|could saga).{0,36}\b(book me|hire me)\b/,
    ])
  ) {
    return capabilityMatch({
      kind: "GIG_SEEKER",
      confidence: 0.91,
      reasons: ["user asked whether Saga can help with gigs"],
      matchedSignals: ["gig_seeker_capability"],
      suggestedFlow: "creator_onboarding",
      shouldEscalate: false,
    });
  }

  if (
    matchAny(text, [
      /\b(can you|could you|can saga|could saga).{0,36}\b(make|help make|plan|produce|put together).{0,36}\b(event|project|party|meetup|rave|pop-?up|photoshoot|idea)\b/,
      /\bcan you make (this|my|our).{0,24}\b(happen|real)\b/,
    ])
  ) {
    return capabilityMatch({
      kind: "EVENT_PLANNING",
      confidence: 0.88,
      reasons: ["user asked whether Saga can help plan a project"],
      matchedSignals: ["event_planning_capability"],
      suggestedFlow: "organizer_intake",
      shouldEscalate: false,
    });
  }

  if (
    matchAny(text, [
      /\bwhat happens next\b/,
      /\bwhat'?s next\b/,
      /\bnext step(s)?\b/,
      /\bwhere do we go from here\b/,
    ])
  ) {
    return capabilityMatch({
      kind: "NEXT_STEPS",
      confidence: 0.86,
      reasons: ["user asked what happens next"],
      matchedSignals: ["next_steps"],
      suggestedFlow: "capability_faq",
      shouldEscalate: false,
    });
  }

  return {
    matched: false,
    kind: "GENERAL",
    confidence: 0,
    reasons: [],
    matchedSignals: [],
    suggestedFlow: "unknown",
    shouldEscalate: false,
  };
}

export function capabilityResponseText(kind: CapabilityResponseKind) {
  switch (kind) {
    case "HOW_IT_WORKS":
      return "Tell me what you are trying to do. I will ask a few basics, shape it for the Saga team to check, and help point you to the right next step.";
    case "WHAT_CAN_I_ASK":
      return "You can ask me to shape a creative project, look for relevant people for review, start a creator profile for gigs, or test whether an idea has interest.";
    case "BOT_DISCLOSURE":
      return "I am Saga's text assistant for this pilot. I can collect details and structure next steps; the Saga team checks anything that needs judgment.";
    case "TALENT_SEARCH":
      return "Yes, I can help understand the project and look for relevant people for the Saga team to check. No one is confirmed until they are reviewed and contacted.";
    case "GIG_SEEKER":
      return "I can help start a creator profile so Saga understands what you do, where you are based, and what gigs may fit. I cannot promise bookings or paid opportunities.";
    case "GUARANTEE":
      return "I cannot make firm commitments around bookings, paid opportunities, teams, venues, ticket outcomes, or whether an event moves forward. I will flag those questions for the Saga team.";
    case "EVENT_PLANNING":
      return "I can help turn an event idea into a clear brief and map what kind of support it may need. It is not confirmed execution, but we can start with the basics.";
    case "INTEREST_CHECK":
      return "If it is an idea you want to exist, I can help shape it as an interest check so Saga can understand the audience, city, and format before treating it like a project.";
    case "NEXT_STEPS":
      return "Next, tell me which lane fits: a project you want to plan, gigs you want to be considered for, or an idea you want to test.";
    case "HELP":
      return "I can help with project ideas, creator/gig profiles, interest checks, and basic questions about the pilot. Reply STOP if you need to opt out.";
    case "GENERAL":
    default:
      return "Saga helps shape creative project ideas, creator profiles, and interest checks into clear next steps for the pilot.";
  }
}

function replyTypeFor(match: CapabilityResponseMatch): CapabilityGeneratedReply["replyType"] {
  if (match.shouldEscalate) return "needs_admin";
  if (match.kind === "HELP") return "help";
  if (match.suggestedFlow === "organizer_intake") return "route_to_organizer";
  if (match.suggestedFlow === "creator_onboarding") return "route_to_creator";
  if (match.suggestedFlow === "interest_check") return "route_to_interest_check";
  return "capability_answer";
}

export function generateCapabilityResponse(input: {
  body: string;
}): CapabilityGeneratedReply {
  const detected = detectCapabilityFaq(input.body);
  const match = detected.matched
    ? detected
    : {
        matched: true,
        kind: "GENERAL" as const,
        confidence: 0.72,
        reasons: ["fallback capability response"],
        matchedSignals: ["fallback"],
        suggestedFlow: "capability_faq" as const,
        shouldEscalate: false,
      };

  return {
    replyText: capabilityResponseText(match.kind),
    replyType: replyTypeFor(match),
    responseKind: match.kind,
    shouldEscalate: match.shouldEscalate,
    suggestedFlow: match.suggestedFlow,
    source: "conversation_engine",
  };
}

export function evaluateCapabilityFaqPolicy({
  context,
  latestMessage,
}: {
  context: ConversationContext;
  latestMessage: string;
}): {
  replyPlan: ReplyPlan;
  response: CapabilityGeneratedReply;
  match: CapabilityResponseMatch;
} {
  const match = detectCapabilityFaq(latestMessage);
  const response = generateCapabilityResponse({ body: latestMessage });
  const replyPlan = replyPlanSchema.parse({
    flow: match.shouldEscalate ? "ADMIN_REVIEW" : "CAPABILITY_FAQ",
    stage: context.currentStage,
    nextStage: match.shouldEscalate ? "NEEDS_ADMIN" : context.currentStage,
    enoughInfoForBrief: false,
    enoughInfoForProfileReview: false,
    enoughInfoForInterestCheck: false,
    shouldEscalate: match.shouldEscalate,
    escalationReason: match.shouldEscalate ? "firm_commitment_or_guarantee_request" : undefined,
    nextQuestion: response.replyText,
    replyTone: "concise_clear_safe",
    allowedActions,
    blockedActions,
    explanationForAudit: [
      `Capability FAQ response kind: ${response.responseKind}.`,
      `Suggested flow: ${response.suggestedFlow}.`,
      match.shouldEscalate
        ? "Firm-commitment language requires Saga team review."
        : "No firm commitment or unsafe action was offered.",
    ].join(" "),
    confidence: match.matched ? match.confidence : 0.72,
  });

  return { replyPlan, response, match };
}
