import { assessMessageSafety, escalationHoldingReply } from "@/sms-engine/safety";
import {
  replyPlanSchema,
  type ConversationContext,
  type InterestCheckKnownFields,
  type InterestCheckStage,
  type ReplyPlan,
} from "@/sms-engine/conversation/conversationTypes";

const LOCATION_QUESTION = "Where would you want this to happen?";
const IDEA_SCOPE_QUESTION =
  "What kind of thing do you want to see exist - meetup, picnic, pop-up, cafe night, party, photoshoot, or something else?";
const FANDOM_AUDIENCE_QUESTION =
  "What fandom, scene, or community would this be for?";
const INTEREST_SIGNAL_QUESTION =
  "Would you want to help organize it?";
const READY_REPLY =
  "Got it. This sounds like something Saga could turn into an interest-check concept for the team to review. We can use it to understand whether there's enough demand before treating it like a real project.";

const allowedActions = [
  "persist_inbound_message",
  "draft_interest_check_review_plan",
  "audit_reply_plan",
];

const blockedActions = [
  "promise_event_will_happen",
  "promise_organizer",
  "promise_attendance",
  "promise_ticket_sales",
  "promise_venue_access",
  "promise_team_formation",
  "create_live_interest_check_without_review",
  "convert_interest_check_to_project",
  "touch_ticketing_or_rsvp",
];

const citySignals: Array<[string, RegExp]> = [
  ["New York City", /\b(new york city|nyc|brooklyn|queens|manhattan|bronx)\b/i],
  ["Los Angeles", /\b(los angeles|la|l\.a\.|silver lake|dtla)\b/i],
  ["Atlanta", /\batlanta\b/i],
  ["Chicago", /\bchicago\b/i],
  ["Seattle", /\bseattle\b/i],
  ["Austin", /\baustin\b/i],
  ["San Francisco", /\b(san francisco|sf|bay area|oakland)\b/i],
  ["Portland", /\bportland\b/i],
  ["Miami", /\bmiami\b/i],
  ["Philadelphia", /\bphiladelphia|philly\b/i],
  ["Boston", /\bboston\b/i],
  ["Dallas", /\bdallas\b/i],
  ["Denver", /\bdenver\b/i],
];

const fandomSignals: Array<[string, RegExp]> = [
  ["Love and Deepspace", /\b(love and deepspace|love & deepspace|deepspace)\b/i],
  ["One Piece", /\bone piece\b/i],
  ["JJK", /\b(jjk|jujutsu kaisen)\b/i],
  ["anime", /\banime\b/i],
  ["cosplay", /\bcosplay\b/i],
  ["gaming", /\b(gaming|games|video games|esports)\b/i],
  ["K-pop", /\b(k-pop|kpop)\b/i],
  ["horror", /\bhorror\b/i],
  ["fantasy", /\bfantasy\b/i],
  ["comics", /\b(comics|comic con|marvel|dc)\b/i],
  ["manga", /\bmanga\b/i],
  ["maid cafe", /\bmaid cafe\b/i],
];

const formatSignals: Array<[string, RegExp]> = [
  ["picnic", /\bpicnic\b/i],
  ["beach day", /\bbeach day\b/i],
  ["meetup", /\bmeetup|meet-up\b/i],
  ["pop-up", /\bpop-?up\b/i],
  ["cupsleeve", /\bcupsleeve|cup sleeve\b/i],
  ["rave", /\brave\b/i],
  ["photoshoot", /\bphotoshoot|photo shoot\b/i],
  ["cafe night", /\b(cafe|café|cafe night|cosplay cafe)\b/i],
  ["market", /\bmarket|artist alley|vendor market\b/i],
  ["party", /\bparty\b/i],
];

const interestSignals: Array<[string, RegExp]> = [
  ["wants someone else to host", /\b(wish someone|someone should|there should be|don't want to host|do not want to host)\b/i],
  ["would attend", /\b(i'?d go|i would go|would attend|would show up|i'd attend)\b/i],
  ["test demand", /\b(check|test|see if|gauge).{0,28}\b(interest|demand|people would|people are interested)\b/i],
  ["would people come", /\b(would people|would anyone|do you think people).{0,32}\b(come|show up|attend|be interested)\b/i],
  ["if people interested", /\bif people (?:are )?interested\b/i],
  ["someone organized", /\bif someone organized it\b/i],
];

const organizerAmbiguitySignals: Array<[string, RegExp]> = [
  ["might organize", /\b(i might|maybe i(?:'d| would)|i could).{0,28}\b(organize|host|run|make it happen)\b/i],
  ["help me make it happen", /\b(help me|can you help me).{0,24}\b(make this happen|organize|host|produce)\b/i],
  ["organizer language", /\b(i want to|i'm trying to|i am trying to|we want to).{0,24}\b(host|organize|throw|produce|make)\b/i],
];

const noOrganizerSignals =
  /\b(i don'?t want to (?:host|organize)|i do not want to (?:host|organize)|if someone organized it|someone else makes it happen|someone should|wish someone)\b/i;

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((item) => item?.trim()).filter(Boolean))] as string[];
}

function truncate(value: string, max = 180) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > max
    ? `${normalized.slice(0, max - 1)}...`
    : normalized;
}

function signalNames(body: string, signals: Array<[string, RegExp]>) {
  return signals
    .filter(([, pattern]) => pattern.test(body))
    .map(([name]) => name);
}

function inferCity(body: string) {
  for (const [city, pattern] of citySignals) {
    if (pattern.test(body)) return city;
  }

  const explicitLocation = body.match(
    /\b(?:in|near|around|based in|city is|for)\s+([a-z][a-z .'-]+?)(?:[.!?,]|$|\s+(?:if|and|with|before|where)\b)/i,
  );
  const candidate = explicitLocation?.[1] ? truncate(explicitLocation[1], 50) : null;
  if (
    candidate &&
    /\b(cafe|café|night|picnic|meetup|pop-?up|rave|photoshoot|market|party|beach|cosplay|anime|gaming|horror|fantasy|comics|manga|k-?pop|one piece|jjk|jujutsu|deepspace|fans?|community)\b/i.test(
      candidate,
    )
  ) {
    return null;
  }
  return candidate;
}

function inferTiming(body: string) {
  const match = body.match(
    /\b(next month|next year|this summer|summer|winter|spring|fall|autumn|weekend|weekday|soon|late [a-z]+|early [a-z]+|[a-z]+ \d{1,2})\b/i,
  );
  return match?.[0] ? truncate(match[0], 80) : null;
}

function inferAudience(body: string, fandoms: string[]) {
  const explicit = body.match(
    /\bfor\s+([a-z0-9 &'-]+?)(?:[.!?,]|$|\s+(?:fans|community|people|in|if|who|that)\b)/i,
  );
  if (explicit?.[1] && explicit[1].length > 2) {
    return truncate(explicit[1], 80);
  }
  return fandoms.length > 0 ? `${fandoms.join(", ")} fans/community` : null;
}

function inferTitle(body: string, formats: string[], fandoms: string[]) {
  const cleaned = truncate(
    body
      .replace(/\b(i wish someone would|wish someone would|someone should|there should be|can saga see if|can you check if|would people come to|would anyone come to|i'?d go to|i would go to|i want there to be)\b/gi, "")
      .replace(/\b(if someone organized it|if someone organized)\b/gi, "")
      .replace(/[?.!]+$/g, "")
      .trim(),
    90,
  );
  if (
    /^(?:la|l\.a\.|los angeles|nyc|new york city|brooklyn|queens|manhattan|atlanta|chicago|seattle|austin|san francisco|sf|portland|miami|philadelphia|philly|boston|dallas|denver)(?:\s+maybe)?$/i.test(
      cleaned,
    )
  ) {
    return null;
  }
  if (cleaned && cleaned.length >= 8) return cleaned;
  if (fandoms.length > 0 && formats.length > 0) {
    return `${fandoms[0]} ${formats[0]}`;
  }
  return null;
}

function mergeInterestFields({
  existing,
  inferred,
}: {
  existing: InterestCheckKnownFields;
  inferred: InterestCheckKnownFields;
}): InterestCheckKnownFields {
  return {
    title: clean(inferred.title) || clean(existing.title),
    description: clean(inferred.description) || clean(existing.description),
    city: clean(inferred.city) || clean(existing.city),
    fandoms: unique([...(existing.fandoms || []), ...(inferred.fandoms || [])]),
    communities: unique([
      ...(existing.communities || []),
      ...(inferred.communities || []),
    ]),
    targetAudience:
      clean(inferred.targetAudience) || clean(existing.targetAudience),
    proposedTiming:
      clean(inferred.proposedTiming) || clean(existing.proposedTiming),
    likelyFormat: clean(inferred.likelyFormat) || clean(existing.likelyFormat),
    interestSignal:
      clean(inferred.interestSignal) || clean(existing.interestSignal),
    expectedAudienceSize:
      clean(inferred.expectedAudienceSize) ||
      clean(existing.expectedAudienceSize),
    willingnessToHelpOrganize:
      clean(inferred.willingnessToHelpOrganize) ||
      clean(existing.willingnessToHelpOrganize),
    safetyFlags: unique([
      ...(existing.safetyFlags || []),
      ...(inferred.safetyFlags || []),
    ]),
    ambiguityNotes: unique([
      ...(existing.ambiguityNotes || []),
      ...(inferred.ambiguityNotes || []),
    ]),
  };
}

function hasConcept(fields: InterestCheckKnownFields) {
  return Boolean(clean(fields.title) || clean(fields.description));
}

function hasAudience(fields: InterestCheckKnownFields) {
  return Boolean(
    clean(fields.targetAudience) ||
      (fields.fandoms || []).length > 0 ||
      (fields.communities || []).length > 0,
  );
}

export function inferInterestCheckFieldsFromMessage(
  body: string,
): InterestCheckKnownFields {
  const fandoms = signalNames(body, fandomSignals);
  const formats = signalNames(body, formatSignals);
  const interest = signalNames(body, interestSignals);
  const ambiguity = noOrganizerSignals.test(body)
    ? []
    : signalNames(body, organizerAmbiguitySignals);
  const likelyFormat = formats[0] || null;
  const title = inferTitle(body, formats, fandoms);
  const willingnessToHelpOrganize = /\b(i might|maybe i|i could|help organize|help with)\b/i.test(
    body,
  )
    ? "possibly"
    : noOrganizerSignals.test(body)
      ? "hoping_someone_else_hosts"
      : null;

  return {
    title,
    description: title ? truncate(body) : null,
    city: inferCity(body),
    fandoms,
    communities: fandoms,
    targetAudience: inferAudience(body, fandoms),
    proposedTiming: inferTiming(body),
    likelyFormat,
    interestSignal: interest[0] || null,
    expectedAudienceSize: /\b(\d{2,5})\s+(?:people|fans|attendees)\b/i.test(body)
      ? body.match(/\b(\d{2,5})\s+(?:people|fans|attendees)\b/i)?.[0]
      : null,
    willingnessToHelpOrganize,
    safetyFlags: [],
    ambiguityNotes: ambiguity.map(
      (item) => `Organizer ambiguity signal: ${item}`,
    ),
  };
}

export function missingInterestCheckRequiredFields(
  fields: InterestCheckKnownFields,
) {
  const missing: string[] = [];
  if (!hasConcept(fields)) missing.push("ideaConcept");
  if (!clean(fields.city)) missing.push("city");
  if (!hasAudience(fields)) missing.push("fandomOrAudience");
  return missing;
}

export function missingInterestCheckOptionalFields(
  fields: InterestCheckKnownFields,
) {
  const missing: string[] = [];
  if (!clean(fields.proposedTiming)) missing.push("proposedTiming");
  if (!clean(fields.likelyFormat)) missing.push("preferredFormat");
  if (!clean(fields.expectedAudienceSize)) missing.push("expectedAudienceSize");
  if (!clean(fields.willingnessToHelpOrganize)) {
    missing.push("willingnessToHelpOrganize");
  }
  if (!clean(fields.interestSignal)) missing.push("interestSignal");
  return missing;
}

function determineNextStage(fields: InterestCheckKnownFields): {
  nextStage: InterestCheckStage;
  nextQuestion?: string;
  enoughInfoForInterestCheck: boolean;
  explanation: string;
} {
  const missingRequiredFields = missingInterestCheckRequiredFields(fields);
  const missingOptionalFields = missingInterestCheckOptionalFields(fields);

  if (!clean(fields.city)) {
    return {
      nextStage: "ASK_LOCATION",
      nextQuestion: LOCATION_QUESTION,
      enoughInfoForInterestCheck: false,
      explanation: "Interest-check city/location is missing.",
    };
  }

  if (!hasConcept(fields)) {
    return {
      nextStage: "ASK_IDEA_SCOPE",
      nextQuestion: IDEA_SCOPE_QUESTION,
      enoughInfoForInterestCheck: false,
      explanation: "Interest-check idea/concept is missing.",
    };
  }

  if (!hasAudience(fields)) {
    return {
      nextStage: "ASK_FANDOM_OR_AUDIENCE",
      nextQuestion: FANDOM_AUDIENCE_QUESTION,
      enoughInfoForInterestCheck: false,
      explanation: "Interest-check fandom/audience is missing.",
    };
  }

  if (
    (fields.ambiguityNotes || []).length > 0 &&
    !clean(fields.willingnessToHelpOrganize)
  ) {
    return {
      nextStage: "ASK_INTEREST_SIGNAL",
      nextQuestion: INTEREST_SIGNAL_QUESTION,
      enoughInfoForInterestCheck: false,
      explanation:
        "Required fields are present, but organizer versus interest-check intent is ambiguous.",
    };
  }

  return {
    nextStage: "INTEREST_CHECK_READY",
    nextQuestion: READY_REPLY,
    enoughInfoForInterestCheck: missingRequiredFields.length === 0,
    explanation: `Required interest-check fields are present. Missing optional fields: ${
      missingOptionalFields.join(", ") || "none"
    }.`,
  };
}

function assessInterestCheckSafety(body: string) {
  const safety = assessMessageSafety(body);
  const hardGuarantee =
    /\b(guarantee|guaranteed|ticket sales|attendance|revenue|venue access|confirmed venue|confirmed team|promise)\b/i.test(
      body,
    );
  return hardGuarantee
    ? {
        needsAdmin: true,
        flags: unique([...safety.flags, "firm_guarantee_request"]),
      }
    : safety;
}

export function evaluateInterestCheckPolicy({
  context,
  latestMessage,
}: {
  context: ConversationContext;
  latestMessage: string;
}) {
  const safety = assessInterestCheckSafety(latestMessage);
  const inferredFields = inferInterestCheckFieldsFromMessage(latestMessage);
  const knownFields = mergeInterestFields({
    existing: context.interestCheckKnownFields || {},
    inferred: {
      ...inferredFields,
      safetyFlags: safety.flags,
    },
  });
  const missingRequiredFields = missingInterestCheckRequiredFields(knownFields);
  const missingOptionalFields = missingInterestCheckOptionalFields(knownFields);

  if (safety.needsAdmin) {
    const replyPlan = replyPlanSchema.parse({
      flow: "INTEREST_CHECK",
      stage: context.currentStage,
      nextStage: "NEEDS_ADMIN",
      enoughInfoForBrief: false,
      enoughInfoForProfileReview: false,
      enoughInfoForInterestCheck: false,
      shouldEscalate: true,
      escalationReason: safety.flags.join(", "),
      nextQuestion: escalationHoldingReply(),
      ambiguityNotes: knownFields.ambiguityNotes || [],
      replyTone: "professional_friendly_casual",
      allowedActions: ["persist_inbound_message", "audit_escalation"],
      blockedActions,
      explanationForAudit:
        "Deterministic interest-check policy escalated due to safety flags.",
      confidence: 0.98,
    });

    return {
      replyPlan,
      knownFields,
      missingRequiredFields,
      missingOptionalFields,
      inferredFields,
      safetyFlags: safety.flags,
      ambiguityNotes: knownFields.ambiguityNotes || [],
    };
  }

  const stageDecision = determineNextStage(knownFields);
  const replyPlan: ReplyPlan = replyPlanSchema.parse({
    flow: "INTEREST_CHECK",
    stage: context.currentStage,
    nextStage: stageDecision.nextStage,
    enoughInfoForBrief: false,
    enoughInfoForProfileReview: false,
    enoughInfoForInterestCheck: stageDecision.enoughInfoForInterestCheck,
    shouldEscalate: false,
    nextQuestion: stageDecision.nextQuestion,
    ambiguityNotes: knownFields.ambiguityNotes || [],
    replyTone: "professional_friendly_casual",
    allowedActions,
    blockedActions,
    explanationForAudit: [
      stageDecision.explanation,
      `Missing required fields: ${missingRequiredFields.join(", ") || "none"}.`,
      `Missing optional fields: ${missingOptionalFields.join(", ") || "none"}.`,
      (knownFields.ambiguityNotes || []).length > 0
        ? `Ambiguity: ${(knownFields.ambiguityNotes || []).join("; ")}.`
        : "No organizer ambiguity detected.",
    ].join(" "),
    confidence:
      stageDecision.nextStage === "INTEREST_CHECK_READY"
        ? 0.86
        : missingRequiredFields.length <= 1
          ? 0.78
          : 0.72,
  });

  return {
    replyPlan,
    knownFields,
    missingRequiredFields,
    missingOptionalFields,
    inferredFields,
    safetyFlags: safety.flags,
    ambiguityNotes: knownFields.ambiguityNotes || [],
  };
}

export function planInterestCheckReply({
  context,
  latestMessage,
}: {
  context: ConversationContext;
  latestMessage: string;
}): ReplyPlan {
  return evaluateInterestCheckPolicy({ context, latestMessage }).replyPlan;
}
