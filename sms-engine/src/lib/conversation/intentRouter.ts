import { isStopMessage } from "@/lib/phone";
import { assessMessageSafety } from "@/lib/safety";
import { detectCapabilityFaq } from "@/lib/conversation/capabilityResponses";
import {
  conversationIntentResultSchema,
  type ConversationContext,
  type IntentSuggestedFlow,
  type ConversationIntent,
  type ConversationIntentResult,
} from "@/lib/conversation/conversationTypes";

type RuleResult = {
  intent: ConversationIntent;
  confidence: number;
  reasons: string[];
  matchedSignals: string[];
  shouldEscalate?: boolean;
  suggestedFlow: IntentSuggestedFlow;
};

function result(input: RuleResult): ConversationIntentResult {
  return conversationIntentResultSchema.parse({
    shouldEscalate: false,
    ...input,
  });
}

function normalizedText(body: string) {
  return body.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchesAll(body: string, patterns: RegExp[]) {
  return patterns.filter((pattern) => pattern.test(body));
}

function signalNames(body: string, signals: Array<[string, RegExp]>) {
  return signals
    .filter(([, pattern]) => pattern.test(body))
    .map(([name]) => name);
}

function isStartIntent(body: string) {
  return /^(start|unstop)$/i.test(body.trim());
}

function isHelpIntent(body: string) {
  return /^(help|support|help me)$/i.test(body.trim());
}

function contactReplyIntent(body: string) {
  const text = normalizedText(body);
  if (/\b(no|nope|not interested|pass|can't|cannot|do not|don't)\b/.test(text)) {
    return "NO";
  }
  if (
    /\b(yes|yeah|yep|sure|happy to|interested|open to|sounds good|ok|okay|introduce|add me)\b/.test(
      text,
    )
  ) {
    return "YES";
  }
  if (/\b(maybe|possibly|depends|send info|more info|not sure)\b/.test(text)) {
    return "MAYBE";
  }
  return null;
}

const gigSeekerSignals: Array<[string, RegExp]> = [
  ["want gigs", /\b(i want|looking for|seeking|need|available for).{0,24}\bgigs?\b/i],
  ["join network", /\b(join|be part of|sign up for).{0,24}\b(network|saga)\b/i],
  ["get booked", /\b(get booked|book me|hire me|available to book)\b/i],
  ["photographer", /\b(i'?m|i am|as a|freelance|available).{0,24}\bphotographer\b/i],
  ["cosplayer", /\b(i'?m|i am|as a|guest|available).{0,24}\bcosplayer\b/i],
  ["dj", /\b(i'?m|i am|as a|available).{0,24}\bdj\b/i],
  ["artist", /\b(i'?m|i am|as an|available).{0,24}\b(artist|illustrator|designer)\b/i],
  ["maid cafe gigs", /\bmaid cafe\b.{0,30}\bgigs?\b/i],
  ["paid gigs", /\bpaid\b.{0,24}\bgigs?\b|\bgigs?\b.{0,24}\bpaid\b/i],
];

const organizerSignals: Array<[string, RegExp]> = [
  ["throw", /\b(i want to|we want to|trying to|planning to).{0,24}\bthrow\b/i],
  ["host", /\b(i want to|we want to|trying to|planning to).{0,24}\bhost\b/i],
  ["produce", /\b(i want to|we want to|trying to|planning to).{0,24}\b(produce|make|do|create|put together)\b/i],
  ["putting on", /\b(thinking of|thinking about|trying to|planning to).{0,24}\b(putting on|put on)\b/i],
  ["event", /\b(event|party|pop-?up|meetup|rave|show|screening|workshop|festival|launch)\b/i],
  ["project", /\b(project|photoshoot|activation|community night|creator day)\b/i],
];

const interestCheckSignals: Array<[string, RegExp]> = [
  ["wish existed", /\b(i wish|wish someone|someone should|there should be)\b/i],
  ["can someone host", /\bcan someone host\b/i],
  ["would people come", /\b(would people|would anyone|do you think people).{0,30}\b(come|show up|be interested|attend)\b/i],
  ["would be down", /\b(would anyone|would people).{0,30}\bbe down\b/i],
  ["check interest", /\b(can saga|can you|could saga|could you).{0,28}\b(check|test|see if|gauge).{0,28}\b(interest|demand|people would|people are interested)\b/i],
  ["would attend", /\b(i'?d go|i would go|would attend|would show up).{0,40}\b(if someone organized|if someone hosted|if someone made)\b/i],
  ["do not want to host", /\b(i don'?t want to (?:host|organize)|i do not want to (?:host|organize))\b/i],
  ["interest check", /\binterest check\b/i],
  ["if enough people", /\bif enough people\b/i],
  ["want this to exist", /\bwant this to exist\b/i],
  ["want there to be", /\bi want there to be\b/i],
];

function hasActiveContactContext(context?: ConversationContext | null) {
  return Boolean(context?.activeOutreach || context?.contact);
}

export function classifyConversationIntent({
  body,
  context,
}: {
  body: string;
  context?: ConversationContext | null;
}): ConversationIntentResult {
  const trimmed = body.trim();

  if (!trimmed) {
    return result({
      intent: "UNKNOWN",
      confidence: 0.2,
      reasons: ["empty message"],
      matchedSignals: [],
      suggestedFlow: "unknown",
    });
  }

  if (isStopMessage(trimmed)) {
    return result({
      intent: "STOP_OR_OPT_OUT",
      confidence: 1,
      reasons: ["exact opt-out command"],
      matchedSignals: [trimmed.toUpperCase()],
      suggestedFlow: "opt_out",
    });
  }

  if (isStartIntent(trimmed)) {
    return result({
      intent: "START_OR_OPT_IN",
      confidence: 1,
      reasons: ["exact opt-in command"],
      matchedSignals: [trimmed.toUpperCase()],
      suggestedFlow: "opt_in",
    });
  }

  if (isHelpIntent(trimmed)) {
    const faq = detectCapabilityFaq(trimmed);
    return result({
      intent: "HELP",
      confidence: faq.matched ? faq.confidence : 0.98,
      reasons: faq.matched ? faq.reasons : ["help command"],
      matchedSignals: faq.matched ? faq.matchedSignals : [trimmed],
      suggestedFlow: "help",
    });
  }

  const capabilityFaq = detectCapabilityFaq(trimmed);
  if (capabilityFaq.matched) {
    return result({
      intent: "CAPABILITY_FAQ",
      confidence: capabilityFaq.confidence,
      reasons: capabilityFaq.reasons,
      matchedSignals: capabilityFaq.matchedSignals,
      shouldEscalate: capabilityFaq.shouldEscalate,
      suggestedFlow: capabilityFaq.suggestedFlow,
    });
  }

  const gigSignals = signalNames(trimmed, gigSeekerSignals);
  const safety = assessMessageSafety(trimmed);
  const selfDirectedGigPreference =
    gigSignals.length > 0 &&
    safety.flags.every((flag) => flag === "money_or_contract") &&
    !/\b(contract|agreement|legal|deposit|invoice|refund|quote|pricing|commission|revenue|payment dispute|chargeback|guarantee|guaranteed|should i sign)\b|\$/i.test(
      trimmed,
    );
  if (safety.needsAdmin && !selfDirectedGigPreference) {
    return result({
      intent: "SAFETY_ESCALATION",
      confidence: 0.96,
      reasons: ["deterministic safety rule matched", ...safety.flags],
      matchedSignals: safety.flags,
      shouldEscalate: true,
      suggestedFlow: "admin_review",
    });
  }

  const replyIntent = contactReplyIntent(trimmed);
  if (replyIntent && hasActiveContactContext(context)) {
    return result({
      intent: "CONTACT_REPLY",
      confidence: context?.activeOutreach ? 0.92 : 0.78,
      reasons: [
        context?.activeOutreach
          ? "active outreach context exists"
          : "known contact context exists",
        `reply language classified as ${replyIntent}`,
      ],
      matchedSignals: [replyIntent],
      suggestedFlow: "contact_reply",
    });
  }

  if (
    hasActiveContactContext(context) &&
    /\b(what is this|who is this|why are you texting|why did you text|what project|send details|more details)\b/i.test(
      trimmed,
    )
  ) {
    return result({
      intent: "CONTACT_REPLY",
      confidence: 0.68,
      reasons: [
        context?.activeOutreach
          ? "active outreach context exists"
          : "known contact context exists",
        "message appears to be an unclear contact reply",
      ],
      matchedSignals: ["unclear_contact_reply"],
      suggestedFlow: "contact_reply",
    });
  }

  if (gigSignals.length > 0) {
    return result({
      intent: "GIG_SEEKER_ONBOARDING",
      confidence: Math.min(0.94, 0.72 + gigSignals.length * 0.06),
      reasons: ["message appears to be from a creator seeking opportunities"],
      matchedSignals: gigSignals,
      suggestedFlow: "creator_onboarding",
    });
  }

  const interestSignals = signalNames(trimmed, interestCheckSignals);
  if (interestSignals.length > 0) {
    return result({
      intent: "INTEREST_CHECK",
      confidence: Math.min(0.9, 0.68 + interestSignals.length * 0.07),
      reasons: ["message describes demand or an idea someone wishes existed"],
      matchedSignals: interestSignals,
      suggestedFlow: "interest_check",
    });
  }

  const organizerMatches = matchesAll(
    trimmed,
    organizerSignals.map(([, pattern]) => pattern),
  );
  const organizerSignalNames = signalNames(trimmed, organizerSignals);
  if (organizerSignalNames.length > 0) {
    return result({
      intent: "ORGANIZER_PROJECT_IDEA",
      confidence: Math.min(0.93, 0.62 + organizerMatches.length * 0.08),
      reasons: ["message mentions an event/project idea"],
      matchedSignals: organizerSignalNames,
      suggestedFlow: "organizer_intake",
    });
  }

  return result({
    intent: "UNKNOWN",
    confidence: 0.35,
    reasons: ["no deterministic intent rule matched"],
    matchedSignals: [],
    suggestedFlow: "unknown",
  });
}
