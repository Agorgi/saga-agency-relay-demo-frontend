import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getSuggestedRoles } from "@/data/sagaAgencyData";
import {
  buildOrganizerCorrectionReply,
  evaluateOrganizerBriefReadiness,
  extractOrganizerIntakeFieldsFromMessages,
  formatOrganizerKnownSummary,
  formatOrganizerMissingSummary,
  isOrganizerCorrectionPrompt,
  type OrganizerIntakeFields,
} from "@/lib/sagasanOrganizerIntake";
import {
  PERSONA_OPTIONS,
  normalizePersona,
  type Persona,
} from "@/lib/sagasanPersonas";
import { buildSystemPrompt } from "@/lib/sagasanSystemPrompt";
import {
  sanitizeNextStepPayload,
  type WebChatNextStep,
  type WebChatPrefill,
} from "@/lib/webChatNextStep";
import type { StoredExtractedFields } from "@/lib/webChatSessionStore";
import type { ProjectType } from "@/types/sagaAgency";

export type ChatRole = "user" | "assistant";
export type RouteLlmMode = "active_mock" | "active_live";
export type ProviderState =
  | "openai_not_called_gate_closed"
  | "openai_not_called_mode_mock"
  | "openai_not_called_missing_key"
  | "openai_called_succeeded"
  | "openai_called_failed"
  | "openai_called_validation_failed";
export type ModelPreflightStatus =
  | "ok"
  | "skipped"
  | "model_not_found"
  | "auth_error"
  | "rate_limit"
  | "provider_error";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type AgentDiagnostics = {
  operation: string;
  selectedReplySource: "openai_selected" | "deterministic_fallback" | "holding_template";
  fallbackReason: string | null;
  providerState: ProviderState;
  model: string;
  configuredMode: RouteLlmMode;
  effectiveMode: "autonomous_live" | "autonomous_mock" | "holding";
  openAiConfigured: boolean;
  openAiCalled: boolean;
  activeLiveAllowed: boolean;
  shadowMode: boolean;
  blockingGate: string | null;
  publicLaunchGate: boolean;
};

export type AgentReply = {
  reply: string;
  nextStep: WebChatNextStep | null;
  persona: Persona | null;
  extractedFields: StoredExtractedFields;
  diagnostics: AgentDiagnostics;
};

type OpenAiStructuredResult<T> =
  | {
      ok: true;
      data: T;
      responseId: string | null;
    }
  | {
      ok: false;
      errorCategory: ModelPreflightStatus | "validation_failed";
      errorMessage: string;
      statusCode?: number | null;
      responseId: string | null;
    };

type LiveStructuredCall = (input: {
  apiKey: string;
  baseUrl?: string | null;
  model: string;
  timeoutMs: number;
  instructions: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
}) => Promise<OpenAiStructuredResult<LiveAgentReply>>;

type PersonaSignal = Persona | null;

type LiveAgentReply = z.infer<typeof liveAgentReplySchema>;

const TICKET_REPLY = "Tickets live elsewhere — Saga doesn't handle those.";
const BASE_MODEL = "gpt-4o-mini";
const GENERIC_PERSONA_STARTERS = new Set(
  PERSONA_OPTIONS.map((option) => option.firstTurn.toLowerCase()),
);

const liveAgentReplySchema = z.object({
  message: z.string().trim().min(1),
  nextStep: z.unknown().nullable().optional(),
});

const PERSONA_ROUTE_MAP: Record<Persona, string> = {
  host: "/projects/new",
  creative: "/me",
  venue: "/spaces",
  fan: "/feed",
};

const CREATIVE_ROLE_PATTERNS: Array<[RegExp, string]> = [
  [/\bphotographer\b/i, "Photographer"],
  [/\bdj\b/i, "DJ"],
  [/\bvideographer\b|\bdp\b|\bcinematographer\b/i, "Videographer"],
  [/\billustrator\b/i, "Illustrator"],
  [/\bdesigner\b|\bgraphic designer\b/i, "Designer"],
  [/\bcosplayer\b/i, "Cosplayer"],
  [/\bstylist\b/i, "Stylist"],
  [/\bmakeup\b|\bhmua\b|\bmakeup artist\b/i, "HMUA"],
  [/\bproducer\b/i, "Producer"],
  [/\beditor\b/i, "Editor"],
  [/\bhost\b/i, "Host"],
];

const INTEREST_PATTERNS: Array<[RegExp, string]> = [
  [/\banime\b/i, "Anime"],
  [/\bcosplay\b/i, "Cosplay"],
  [/\bdj\b|\bdance\b|\bnightlife\b/i, "DJ nights"],
  [/\bpop-?up\b/i, "Pop-ups"],
  [/\bgaming\b/i, "Gaming"],
  [/\bj[- ]?fashion\b/i, "J-fashion"],
  [/\bcreator\b/i, "Creator events"],
];

const VENUE_TYPE_PATTERNS: Array<[RegExp, string]> = [
  [/\bevent space\b/i, "Event space"],
  [/\bwarehouse\b/i, "Warehouse"],
  [/\bstudio\b/i, "Studio"],
  [/\bcafe\b/i, "Cafe"],
  [/\bgallery\b/i, "Gallery"],
  [/\bclub\b/i, "Club"],
  [/\bbar\b/i, "Bar"],
  [/\bstorefront\b/i, "Storefront"],
];

const CITY_PATTERNS: Array<[RegExp, string]> = [
  [/\blos angeles\b|\bla\b/i, "Los Angeles"],
  [/\bsilver lake\b/i, "Silver Lake"],
  [/\barts district\b/i, "Arts District"],
  [/\bbrooklyn\b/i, "Brooklyn"],
  [/\bnew york\b|\bnyc\b/i, "New York"],
  [/\bmiami\b/i, "Miami"],
  [/\bseattle\b/i, "Seattle"],
  [/\bchicago\b/i, "Chicago"],
  [/\bsan francisco\b|\bsf\b/i, "San Francisco"],
  [/\boakland\b/i, "Oakland"],
  [/\bpasadena\b/i, "Pasadena"],
];

const FAN_INTEREST_STOP_WORDS = new Set([
  "i",
  "im",
  "i'm",
  "the",
  "and",
  "or",
  "in",
  "for",
  "of",
  "to",
  "a",
  "an",
  "more",
  "want",
  "wanting",
  "into",
  "find",
  "cool",
  "stuff",
  "scene",
  "scenes",
  "events",
  "event",
  "near",
  "me",
  "what",
  "happening",
  "things",
  "attend",
]);

let cachedClient: OpenAI | null = null;
let cachedApiKey: string | null = null;
let cachedBaseUrl: string | null = null;

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function trimSentence(text: string, maxLength = 160) {
  return text.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeProjectIdea(text: string) {
  return trimSentence(
    text
      .replace(/^i (want to|need to|am looking to)\s+/i, "")
      .replace(/^we (want to|need to|are looking to)\s+/i, ""),
    120,
  );
}

function getOpenAiClient({
  apiKey,
  baseUrl,
}: {
  apiKey: string;
  baseUrl?: string | null;
}) {
  const normalizedBaseUrl = baseUrl || null;
  if (
    cachedClient &&
    cachedApiKey === apiKey &&
    cachedBaseUrl === normalizedBaseUrl
  ) {
    return cachedClient;
  }

  cachedClient = new OpenAI({
    apiKey,
    baseURL: normalizedBaseUrl || undefined,
    maxRetries: 1,
  });
  cachedApiKey = apiKey;
  cachedBaseUrl = normalizedBaseUrl;
  return cachedClient;
}

function classifyOpenAiError(error: unknown): {
  category: ModelPreflightStatus;
  message: string;
  statusCode: number | null;
} {
  const statusCode =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status?: number }).status) || null
      : null;
  const message =
    error instanceof Error ? error.message : "Unknown OpenAI error.";

  if (statusCode === 401 || statusCode === 403) {
    return {
      category: "auth_error",
      message,
      statusCode,
    };
  }

  if (statusCode === 404 || /model/i.test(message)) {
    return {
      category: "model_not_found",
      message,
      statusCode,
    };
  }

  if (statusCode === 429) {
    return {
      category: "rate_limit",
      message,
      statusCode,
    };
  }

  return {
    category: "provider_error",
    message,
    statusCode,
  };
}

async function callLiveStructured(input: {
  apiKey: string;
  baseUrl?: string | null;
  model: string;
  timeoutMs: number;
  instructions: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
}): Promise<OpenAiStructuredResult<LiveAgentReply>> {
  try {
    const client = getOpenAiClient({
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
    });
    const response = await client.responses.parse(
      {
        model: input.model,
        instructions: input.instructions,
        input: input.prompt,
        text: {
          format: zodTextFormat(liveAgentReplySchema, "sagasan_live_reply"),
        },
        temperature: input.temperature,
        max_output_tokens: input.maxOutputTokens,
      },
      {
        timeout: input.timeoutMs,
        maxRetries: 1,
      },
    );

    if (!response.output_parsed) {
      return {
        ok: false,
        errorCategory: "validation_failed",
        errorMessage: "OpenAI returned no parsed output.",
        responseId: response.id || null,
      };
    }

    return {
      ok: true,
      data: response.output_parsed,
      responseId: response.id || null,
    };
  } catch (error) {
    const classified = classifyOpenAiError(error);
    return {
      ok: false,
      errorCategory: classified.category,
      errorMessage: classified.message,
      statusCode: classified.statusCode,
      responseId: null,
    };
  }
}

export function normalizeRouteLlmMode(value: string | undefined): RouteLlmMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "live" || normalized === "active_live") {
    return "active_live";
  }
  return "active_mock";
}

export function getConfiguredModel() {
  return process.env.OPENAI_MODEL?.trim() || BASE_MODEL;
}

export function shouldAnswerTickets(message: string) {
  return /\bticket|tickets|admission|entry pass|passes\b/i.test(message);
}

function isCapabilityQuestion(message: string) {
  return /\bwhat do you do\b|\bwhat can you do\b|\bhow can you help\b/i.test(message);
}

function isPaidWorkBoundary(message: string) {
  return /\bpaid work\b|\bget paid\b|\bbook me\b/i.test(message);
}

function isGuaranteeBoundary(message: string) {
  return (
    /\bguarantee\b|\bpromise\b|\bconfirm(ed)? team\b|\bbookings?\b/i.test(
      message,
    ) ||
    /\bbook my whole team\b|\bbook the whole team\b|\bbook gigs?\b|\b100%\s+sure\b/i.test(
      message,
    )
  );
}

function isTrustBoundary(message: string) {
  return (
    /\b(?:confirmed|available)\b/i.test(message) &&
      /\b(?:people|person|team|talent|photographer|dj|artist|cosplayer|venue|event)\b/i.test(
        message,
      ) ||
    /\bdid you contact\b|\bdid saga contact\b|\bare these people confirmed\b|\bare they available\b/i.test(
      message,
    )
  );
}

function isOutboundActionBoundary(message: string) {
  return (
    /\b(?:dm|message|text|email|call|contact|invite|reach out to|send this to)\b/i.test(
      message,
    ) ||
    /\b(?:tell|ask)\s+(?:them|my friends|that (?:person|photographer|dj|artist|cosplayer|venue)|the (?:photographer|dj|artist|cosplayer|venue))\b/i.test(
      message,
    ) ||
    /\bbook them now\b/i.test(message)
  );
}

function isOffTopic(message: string) {
  return /\bcapital of france\b|\bweather\b|\bstock price\b|\brecipe\b/i.test(message);
}

function isBoundaryPriorityMessage(message: string) {
  return (
    shouldAnswerTickets(message) ||
    isTrustBoundary(message) ||
    isOutboundActionBoundary(message) ||
    isPaidWorkBoundary(message) ||
    isGuaranteeBoundary(message) ||
    isCapabilityQuestion(message) ||
    isOffTopic(message)
  );
}

function summarizeTranscript(history: ChatMessage[], latestMessage: string) {
  return [...history, { role: "user" as const, content: latestMessage }]
    .map((message) =>
      `${message.role === "assistant" ? "Sagasan" : "User"}: ${message.content}`,
    )
    .join("\n");
}

function inferCity(value: string) {
  for (const [pattern, label] of CITY_PATTERNS) {
    if (pattern.test(value)) {
      return label;
    }
  }
  return null;
}

function inferNeighborhood(value: string) {
  const match =
    value.match(/\b(arts district|silver lake|echo park|williamsburg|soho|hollywood|dtla)\b/i) ||
    value.match(/\b(?:in|near)\s+(arts district|silver lake|echo park|williamsburg|soho|hollywood|dtla)\b/i);
  return match ? match[1].replace(/\b\w/g, (char) => char.toUpperCase()) : null;
}

function inferDateWindow(value: string) {
  const match = value.match(
    /\b(next month|next week|this weekend|this month|tonight|tomorrow|next friday|next saturday|next sunday|friday|saturday|sunday|summer|fall|winter|spring|jan(?:uary)?(?:\s+\d{1,2})?|feb(?:ruary)?(?:\s+\d{1,2})?|mar(?:ch)?(?:\s+\d{1,2})?|apr(?:il)?(?:\s+\d{1,2})?|may(?:\s+\d{1,2})?|jun(?:e)?(?:\s+\d{1,2})?|jul(?:y)?(?:\s+\d{1,2})?|aug(?:ust)?(?:\s+\d{1,2})?|sep(?:tember)?(?:\s+\d{1,2})?|oct(?:ober)?(?:\s+\d{1,2})?|nov(?:ember)?(?:\s+\d{1,2})?|dec(?:ember)?(?:\s+\d{1,2})?)\b/i,
  );
  return match ? match[1] : null;
}

function inferAvailabilityHint(value: string) {
  const match = value.match(
    /\b(available[^.?!,]*|open[^.?!,]*|weeknights[^.?!,]*|weekends[^.?!,]*|after \d{1,2}(?::\d{2})?\s*(?:am|pm)?[^.?!,]*|this month[^.?!,]*|next month[^.?!,]*)\b/i,
  );
  return match ? trimSentence(match[1], 80) : null;
}

function inferPortfolioLink(value: string) {
  const match = value.match(/https?:\/\/\S+/i);
  if (match) {
    return match[0];
  }
  if (/portfolio|samples?|reel|instagram|ig|behance|dribbble/i.test(value)) {
    return "Sample shared in chat";
  }
  return null;
}

function inferRateHint(value: string) {
  const match = value.match(/\$[\d,]+(?:\s*-\s*\$?[\d,]+)?/);
  if (match) {
    return match[0];
  }
  if (/day rate|hourly|negotiable/i.test(value)) {
    return "Negotiable";
  }
  return null;
}

function inferScale(value: string) {
  const explicit =
    value.match(/(\d+)\s*[- ]?(?:person|people|guest|guests|attendees?)/i) ||
    value.match(/\b(\d+)\s*cap\b/i);
  if (explicit) {
    return `${explicit[1]} people`;
  }

  if (/\bintimate\b/i.test(value)) return "intimate";
  if (/\b(mid|medium)\b/i.test(value)) return "mid";
  if (/\b(big|large|huge)\b/i.test(value)) return "big";
  return null;
}

function inferCapacity(value: string) {
  const explicit =
    value.match(/(\d+)\s*[- ]?(?:person|people|guest|guests|capacity)/i) ||
    value.match(/\bcap(?:acity)?\s*(?:for|of)?\s*(\d+)/i);
  if (explicit) {
    return `${explicit[1]} people`;
  }
  if (/\bsmall\b/i.test(value)) return "small";
  if (/\bmedium\b/i.test(value)) return "mid";
  if (/\blarge\b/i.test(value)) return "large";
  return null;
}

function inferVenueType(value: string) {
  for (const [pattern, label] of VENUE_TYPE_PATTERNS) {
    if (pattern.test(value)) {
      return label;
    }
  }
  return null;
}

function inferCreativeRoles(value: string) {
  return uniqueStrings(
    CREATIVE_ROLE_PATTERNS.filter(([pattern]) => pattern.test(value)).map(
      ([, label]) => label,
    ),
  );
}

function inferInterestTags(value: string) {
  const matched = uniqueStrings(
    INTEREST_PATTERNS.filter(([pattern]) => pattern.test(value)).map(
      ([, label]) => label,
    ),
  );

  if (matched.length > 0) {
    return matched.slice(0, 3);
  }

  return value
    .toLowerCase()
    .replace(/[^a-z0-9,\s/-]/g, " ")
    .split(/[,\s/]+/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length > 2 &&
        !FAN_INTEREST_STOP_WORDS.has(part) &&
        !CITY_PATTERNS.some(([pattern]) => pattern.test(part)),
    )
    .slice(0, 3)
    .map((part) => part.replace(/\b\w/g, (char) => char.toUpperCase()));
}

function inferVibeTags(value: string) {
  return uniqueStrings(
    [
      /\banime\b/i.test(value) ? "anime" : null,
      /\bcosplay\b/i.test(value) ? "cosplay" : null,
      /\bneon\b/i.test(value) ? "neon" : null,
      /\bpicnic\b/i.test(value) ? "picnic" : null,
      /\bpop-?up\b/i.test(value) ? "pop-up" : null,
      /\blaunch\b/i.test(value) ? "launch" : null,
      /\bdj\b/i.test(value) ? "dj" : null,
      /\bplayful\b/i.test(value) ? "playful" : null,
    ].filter(Boolean) as string[],
  ).slice(0, 4);
}

function inferHostProjectType(value: string): ProjectType {
  const lower = value.toLowerCase();
  if (/picnic/.test(lower)) return "Pop-up / activation";
  if (/pop-?up|activation|launch/.test(lower)) return "Pop-up / activation";
  if (/fan|gala|watch party|meetup/.test(lower)) return "Fan event";
  if (/editorial|lookbook|photoshoot|photo shoot/.test(lower)) return "Photoshoot";
  if (/music video/.test(lower)) return "Music video";
  if (/video|trailer|film/.test(lower)) return "Video shoot";
  if (/brand|campaign|product/.test(lower)) return "Brand campaign";
  if (/creator/.test(lower)) return "Creator collaboration";
  if (/performance|concert|show/.test(lower)) return "Live performance";
  return "Other";
}

function inferProjectIdea(value: string) {
  const normalized = normalizeProjectIdea(value);
  if (!normalized) {
    return null;
  }
  return normalized.split(/[.!?]/)[0]?.slice(0, 90) || null;
}

function inferHostEventType(projectType: ProjectType, raw: string) {
  if (projectType !== "Other") {
    return projectType;
  }
  return inferProjectIdea(raw) || "Creative project";
}

function getSignalMatcher(persona: Persona | null) {
  if (persona === "creative") return strongCreativeSignal;
  if (persona === "venue") return strongVenueSignal;
  if (persona === "fan") return strongFanSignal;
  if (persona === "host") return strongHostSignal;
  return null;
}

function getUserTranscript(
  history: ChatMessage[],
  latestMessage: string,
  persona: Persona | null,
) {
  const userMessages = [...history, { role: "user" as const, content: latestMessage }]
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .filter((content) => !GENERIC_PERSONA_STARTERS.has(content.toLowerCase()));

  const signalMatcher = getSignalMatcher(persona);
  if (!signalMatcher || userMessages.length <= 1) {
    return userMessages.join("\n");
  }

  let anchorIndex = 0;
  for (let index = userMessages.length - 1; index >= 0; index -= 1) {
    if (signalMatcher(userMessages[index] || "")) {
      anchorIndex = index;
      break;
    }
  }

  return userMessages.slice(anchorIndex).join("\n");
}

function getUserMessages(history: ChatMessage[], latestMessage: string) {
  return [...history, { role: "user" as const, content: latestMessage }]
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .filter((content) => !GENERIC_PERSONA_STARTERS.has(content.toLowerCase()));
}

function organizerFieldsFromStored(
  fields: StoredExtractedFields,
): OrganizerIntakeFields {
  return {
    projectIdea: fields.projectIdea,
    locationMarket: fields.city,
    timing: fields.dateWindow,
    scopeFormat: fields.scopeFormat,
    themeVibe: fields.themeVibe,
    expectedAttendance: fields.scale,
    lineupStatus: fields.lineupStatus,
    helpNeeded: fields.helpNeeded,
    budget: fields.budget,
    budgetStatus: fields.budgetStatus,
    inspirationStatus: fields.inspirationStatus,
    inspirationReferences: fields.inspirationReferences,
    userRole: fields.userRole,
    userIdentity: fields.userIdentity,
    organization: fields.organization,
    socials: fields.socials,
    audience: fields.audience,
    ticketingModel: fields.ticketingModel,
    safetyFlags: fields.safetyFlags,
    urgency: fields.urgency,
    desiredTalentRoles: fields.desiredTalentRoles,
  };
}

export function extractStructuredFields({
  persona,
  history,
  latestMessage,
}: {
  persona: Persona | null;
  history: ChatMessage[];
  latestMessage: string;
}): StoredExtractedFields {
  const scopedTranscript = getUserTranscript(history, latestMessage, persona);
  const userMessages = getUserMessages(history, latestMessage);
  const organizerFields =
    persona === "host"
      ? extractOrganizerIntakeFieldsFromMessages(userMessages)
      : null;
  const organizerReadiness = organizerFields
    ? evaluateOrganizerBriefReadiness(organizerFields)
    : null;
  const city = inferCity(scopedTranscript);
  const neighborhood = inferNeighborhood(scopedTranscript);
  const dateWindow = inferDateWindow(scopedTranscript);
  const projectIdea = inferProjectIdea(scopedTranscript);
  const roles = inferCreativeRoles(scopedTranscript);
  const venueType = inferVenueType(scopedTranscript);
  const availability = inferAvailabilityHint(scopedTranscript);
  const rates = inferRateHint(scopedTranscript);
  const portfolio = inferPortfolioLink(scopedTranscript);
  const interests = inferInterestTags(scopedTranscript).filter(
    (interest) => !city || !city.toLowerCase().includes(interest.toLowerCase()),
  );
  const vibeTags = inferVibeTags(scopedTranscript);
  const scale = inferScale(scopedTranscript) || inferCapacity(scopedTranscript);

  const route =
    persona && PERSONA_ROUTE_MAP[persona]
      ? PERSONA_ROUTE_MAP[persona]
      : null;

  return {
    persona,
    city: organizerFields?.locationMarket || city,
    neighborhood,
    dateWindow: organizerFields?.timing || dateWindow,
    roles,
    vibeTags,
    venueType,
    projectIdea: organizerFields?.projectIdea || projectIdea,
    interests,
    portfolio,
    availability,
    rates,
    scale: organizerFields?.expectedAttendance || scale,
    scopeFormat: organizerFields?.scopeFormat || null,
    themeVibe: organizerFields?.themeVibe || null,
    lineupStatus: organizerFields?.lineupStatus || null,
    helpNeeded: organizerFields?.helpNeeded || null,
    budget: organizerFields?.budget || null,
    budgetStatus: organizerFields?.budgetStatus || null,
    inspirationStatus: organizerFields?.inspirationStatus || null,
    inspirationReferences: organizerFields?.inspirationReferences || [],
    userRole: organizerFields?.userRole || null,
    userIdentity: organizerFields?.userIdentity || null,
    organization: organizerFields?.organization || null,
    socials: organizerFields?.socials || [],
    audience: organizerFields?.audience || null,
    ticketingModel: organizerFields?.ticketingModel || null,
    safetyFlags: organizerFields?.safetyFlags || [],
    urgency: organizerFields?.urgency || null,
    desiredTalentRoles: organizerFields?.desiredTalentRoles || [],
    readinessStage: organizerReadiness?.stage || null,
    missingRequiredFields: organizerReadiness?.missingRequiredFields || [],
    missingImportantFields: organizerReadiness?.missingImportantFields || [],
    nextRoute: route,
  };
}

type PersonaScores = Record<Persona, number>;

const CREATIVE_SIGNAL_PATTERNS = [
  /\bphotographer\b/i,
  /\bvideographer\b/i,
  /\bdj\b/i,
  /\billustrator\b/i,
  /\bdesigner\b/i,
  /\bcosplayer\b/i,
  /\bperformer\b/i,
  /\bartist\b/i,
  /\blooking for gigs\b/i,
  /\blooking for work\b/i,
  /\bavailable for events\b/i,
  /\bbook me\b/i,
  /\bhire me\b/i,
  /\bportfolio\b/i,
  /\bmy work\b/i,
];

const VENUE_SIGNAL_PATTERNS = [
  /\bi run (?:a|an)?(?:\s+\w+){0,2}\s+(?:venue|space|studio|cafe|gallery|event space|bar|club)\b/i,
  /\bi have (?:a|an)?(?:\s+\w+){0,2}\s+(?:venue|space|studio|cafe|gallery|event space|bar|club)\b/i,
  /\bi manage (?:a|an)?(?:\s+\w+){0,2}\s+(?:venue|space|studio|cafe|gallery|event space|bar|club)\b/i,
  /\bi own (?:a|an)?(?:\s+\w+){0,2}\s+(?:venue|space|studio|cafe|gallery|event space|bar|club)\b/i,
  /\bmy (?:venue|space|studio|cafe|gallery|event space|bar|club)\b/i,
  /\bour (?:venue|space|studio|cafe|gallery|event space|bar|club)\b/i,
  /\bwe host events\b/i,
  /\brent out my space\b/i,
];

const FAN_SIGNAL_PATTERNS = [
  /\bfind events\b/i,
  /\bdiscover events\b/i,
  /\bcool events\b/i,
  /\bthings near me\b/i,
  /\bwhat'?s happening\b/i,
  /\bi want to attend\b/i,
  /\banime events near me\b/i,
  /\bshows near me\b/i,
  /\bcool stuff\b/i,
  /\bevents near me\b/i,
  /\bwhere should i go\b/i,
  /\bwhat'?s going on\b/i,
  /\bwhat'?s happening on\b/i,
  /\bthings to do\b/i,
  /\bevents this weekend\b/i,
  /\bthis weekend\b/i,
  /\bon friday\b/i,
];

const HOST_SIGNAL_PATTERNS = [
  /\bi want to host\b/i,
  /\bi want to throw\b/i,
  /\bi want to organize\b/i,
  /\bi want to produce\b/i,
  /\bputting on an event\b/i,
  /\bplanning an event\b/i,
  /\bcreating a project\b/i,
  /\bi want to put on\b/i,
  /\bthinking about\b/i,
  /\bi(?:'m| am) thinking about\b/i,
  /\bi want to plan\b/i,
  /\bplanning\b/i,
  /\bi want to do\b/i,
  /\borganizing\b/i,
];

const HOST_EVENT_CONCEPT_PATTERNS = [
  /\bpicnic\b/i,
  /\bnight\b/i,
  /\bparty\b/i,
  /\blaunch\b/i,
  /\bmeetup\b/i,
  /\bshow\b/i,
  /\bevent\b/i,
  /\bpop-?up\b/i,
  /\bactivation\b/i,
  /\bcafe night\b/i,
];

const HOST_INTENT_PATTERNS = [
  /\bi want to (?:host|throw|organize|produce|put on|plan|do|build)\b/i,
  /\bi(?:'m| am) thinking about\b/i,
  /\bthinking about\b/i,
  /\bplanning\b/i,
  /\borganizing\b/i,
];

function matchesAnyPattern(message: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(message));
}

function strongCreativeSignal(message: string) {
  return (
    /\bactually\b.*\b(dj|photographer|videographer|illustrator|designer|cosplayer|performer|artist)\b/i.test(
      message,
    ) ||
    /\bi(?:'m| am)\s+(?:the\s+)?(dj|photographer|videographer|illustrator|designer|cosplayer|performer|artist)\b/i.test(
      message,
    ) ||
    matchesAnyPattern(message, CREATIVE_SIGNAL_PATTERNS)
  );
}

function anchoredCreativePivotSignal(message: string) {
  return (
    /\bactually\b.*\b(dj|photographer|videographer|illustrator|designer|cosplayer|performer|artist)\b/i.test(
      message,
    ) ||
    /^\s*i(?:'m| am)\s+(?:the\s+)?(dj|photographer|videographer|illustrator|designer|cosplayer|performer|artist)\b/i.test(
      message,
    )
  );
}

function strongVenueSignal(message: string) {
  return (
    /\bactually\b.*\b(?:run(?:ning)?|have|manage|own)(?: (?:a|an))?(?:\s+\w+){0,2}\s+(?:space|venue|studio|cafe|gallery|event space|bar|club)\b/i.test(
      message,
    ) ||
    /\bi (?:run|have|manage|own) (?:a|an)?(?:\s+\w+){0,2}\s+(?:space|venue|studio|cafe|gallery|event space|bar|club)\b|\bour (?:space|venue|studio|cafe|gallery|event space|bar|club)\b/i.test(
      message,
    ) ||
    matchesAnyPattern(message, VENUE_SIGNAL_PATTERNS)
  );
}

function anchoredVenuePivotSignal(message: string) {
  return (
    /\bactually\b.*\b(?:run(?:ning)?|have|manage|own)(?: (?:a|an))?(?:\s+\w+){0,2}\s+(?:space|venue|studio|cafe|gallery|event space|bar|club)\b/i.test(
      message,
    ) ||
    /^\s*i (?:run|have|manage|own) (?:a|an)?(?:\s+\w+){0,2}\s+(?:space|venue|studio|cafe|gallery|event space|bar|club)\b/i.test(
      message,
    ) ||
    /^\s*our (?:space|venue|studio|cafe|gallery|event space|bar|club)\b/i.test(message)
  );
}

function strongFanSignal(message: string) {
  return (
    /\bactually\b.*\b(find|discover|attend)\b/i.test(message) ||
    /\bi want to attend\b|\bwhat'?s happening\b/i.test(message) ||
    matchesAnyPattern(message, FAN_SIGNAL_PATTERNS)
  );
}

function anchoredFanPivotSignal(message: string) {
  return (
    /\bactually\b.*\b(find|discover|attend)\b/i.test(message) ||
    /^\s*i want to attend\b/i.test(message) ||
    /^\s*(?:find|discover) (?:events|shows|things to do)\b/i.test(message) ||
    /^\s*what'?s happening\b/i.test(message)
  );
}

function strongHostSignal(message: string) {
  return (
    /\bactually\b.*\b(host|throw|organize|produce|put on)\b/i.test(message) ||
    /\bi want to (?:host|throw|organize|produce|put on)\b/i.test(message) ||
    matchesAnyPattern(message, HOST_SIGNAL_PATTERNS) ||
    (matchesAnyPattern(message, HOST_INTENT_PATTERNS) &&
      matchesAnyPattern(message, HOST_EVENT_CONCEPT_PATTERNS))
  );
}

function anchoredHostPivotSignal(message: string) {
  return (
    /\bactually\b.*\b(host|throw|organize|produce|put on)\b/i.test(message) ||
    /^\s*i want to (?:host|throw|organize|produce|put on)\b/i.test(message) ||
    /^\s*i(?:'m| am) thinking about\b/i.test(message) ||
    /^\s*thinking about\b/i.test(message) ||
    /^\s*planning\b/i.test(message)
  );
}

function scorePersona(message: string): PersonaScores {
  const lower = message.toLowerCase();
  const hostIntent = matchesAnyPattern(message, HOST_INTENT_PATTERNS);
  const hostEventConcept = matchesAnyPattern(message, HOST_EVENT_CONCEPT_PATTERNS);
  return {
    host:
      (matchesAnyPattern(message, HOST_SIGNAL_PATTERNS) ? 6 : 0) +
      (hostIntent && hostEventConcept ? 5 : hostIntent ? 3 : 0) +
      (/\bproject\b|\bbrief\b|\bhiring\b|\bneed a\b|\bneed help\b/.test(lower)
        ? 2
        : 0),
    creative:
      (matchesAnyPattern(message, CREATIVE_SIGNAL_PATTERNS) ? 6 : 0) +
      (/\bportfolio\b|\breel\b|\bsamples?\b/.test(lower) ? 2 : 0) +
      (/\bfor hire\b|\bavailable\b/.test(lower) ? 1 : 0),
    venue:
      (matchesAnyPattern(message, VENUE_SIGNAL_PATTERNS) ? 7 : 0) +
      (/\bavailability\b|\bopen dates\b|\bcapacity\b/.test(lower) ? 1 : 0),
    fan:
      (matchesAnyPattern(message, FAN_SIGNAL_PATTERNS) ? 7 : 0) +
      (/\bscene\b|\bscenes\b|\bnights\b|\bfandom\b|\bweekend\b|\bfriday\b|\btonight\b/.test(
        lower,
      )
        ? 2
        : 0),
  };
}

export function inferPersonaFromMessage(message: string): PersonaSignal {
  if (isOutboundActionBoundary(message)) {
    return null;
  }
  const scores = scorePersona(message);
  const ranked = (Object.entries(scores) as Array<[Persona, number]>)
    .sort((a, b) => b[1] - a[1]);
  if (!ranked[0] || ranked[0][1] <= 0) {
    return null;
  }
  return ranked[0][0];
}

function detectPersonaPivot(
  message: string,
  currentPersona: Persona | null,
  anchoredPersona: Persona | null,
) {
  if (!currentPersona) {
    return null;
  }

  const creativeSignal = anchoredPersona
    ? anchoredCreativePivotSignal(message)
    : strongCreativeSignal(message);
  if (currentPersona !== "creative" && creativeSignal) {
    return "creative";
  }
  const venueSignal = anchoredPersona
    ? anchoredVenuePivotSignal(message)
    : strongVenueSignal(message);
  if (currentPersona !== "venue" && venueSignal) {
    return "venue";
  }
  const fanSignal = anchoredPersona
    ? anchoredFanPivotSignal(message)
    : strongFanSignal(message);
  if (currentPersona !== "fan" && fanSignal) {
    return "fan";
  }
  const hostSignal = anchoredPersona
    ? anchoredHostPivotSignal(message)
    : strongHostSignal(message);
  if (currentPersona !== "host" && hostSignal) {
    return "host";
  }
  return null;
}

export function resolvePersona({
  personaHint,
  explicitPersona,
  sessionPersona,
  cookiePersona,
  latestMessage,
}: {
  personaHint?: unknown;
  explicitPersona?: unknown;
  sessionPersona?: string | null | undefined;
  cookiePersona?: string | null | undefined;
  latestMessage: string;
}) {
  const normalizedHint =
    typeof personaHint === "string" ? normalizePersona(personaHint) : null;
  const normalizedExplicit =
    typeof explicitPersona === "string" ? normalizePersona(explicitPersona) : null;
  const anchoredPersona = normalizedHint || normalizedExplicit;
  const rememberedPersona =
    normalizePersona(sessionPersona) || normalizePersona(cookiePersona);
  const currentPersona = anchoredPersona || rememberedPersona;
  const pivotPersona = detectPersonaPivot(latestMessage, currentPersona, anchoredPersona);
  if (pivotPersona) {
    return pivotPersona;
  }

  if (isBoundaryPriorityMessage(latestMessage)) {
    return anchoredPersona || rememberedPersona;
  }

  const inferred = inferPersonaFromMessage(latestMessage);
  if (anchoredPersona) {
    return anchoredPersona;
  }

  if (inferred) {
    return inferred;
  }

  return rememberedPersona;
}

function buildHostNextStep(fields: StoredExtractedFields): WebChatNextStep | null {
  const organizerFields = organizerFieldsFromStored(fields);
  const readiness = evaluateOrganizerBriefReadiness(organizerFields);
  const projectType = inferHostProjectType(
    organizerFields.projectIdea || organizerFields.scopeFormat || fields.projectIdea || "",
  );
  const eventType =
    organizerFields.scopeFormat ||
    inferHostEventType(projectType, organizerFields.projectIdea || fields.projectIdea || "");
  const city = organizerFields.locationMarket || fields.city;

  if (!readiness.enoughInfoForDraftBrief || !city) {
    return null;
  }

  const suggestedRoles = uniqueStrings([
    ...organizerFields.desiredTalentRoles,
    ...getSuggestedRoles(projectType),
  ]).slice(0, 8);

  const payload: WebChatPrefill = {
    eventType,
    city,
    scale: organizerFields.expectedAttendance || fields.scale || "Unknown",
    expectedAttendance: organizerFields.expectedAttendance || fields.scale || "",
    vibe:
      organizerFields.themeVibe ||
      fields.themeVibe ||
      fields.vibeTags.join(", ") ||
      fields.projectIdea ||
      "Creative event",
    themeVibe:
      organizerFields.themeVibe ||
      fields.themeVibe ||
      fields.vibeTags.join(", "),
    projectType,
    suggestedRoles,
    projectIdea: organizerFields.projectIdea || fields.projectIdea || eventType,
    helpNeeded: organizerFields.helpNeeded || "",
    scopeFormat: organizerFields.scopeFormat || "",
    lineupStatus: organizerFields.lineupStatus || "",
    budget: organizerFields.budget || "",
    budgetStatus: organizerFields.budgetStatus || "",
    inspirationStatus: organizerFields.inspirationStatus || "",
    inspirationRefs: organizerFields.inspirationReferences.slice(0, 2),
    readinessStage: readiness.stage,
    missingRequiredFields: readiness.missingRequiredFields,
    desiredTalentRoles: organizerFields.desiredTalentRoles,
  };

  if (organizerFields.timing || fields.dateWindow) {
    payload.date = organizerFields.timing || fields.dateWindow || "";
  }

  return {
    label: "Review brief",
    route: "/projects/new",
    prefill: payload,
  };
}

function buildCreativeNextStep(
  fields: StoredExtractedFields,
): WebChatNextStep | null {
  const hasMinimum =
    fields.roles.length > 0 && Boolean(fields.city || fields.portfolio);
  if (!hasMinimum) {
    return null;
  }

  return {
    label: "Open my feed",
    route: "/me",
    prefill: {
      city: fields.city || "Flexible",
      roles: fields.roles,
      portfolio: fields.portfolio || "",
      availability: fields.availability || "",
      rates: fields.rates || "",
    },
  };
}

function buildVenueNextStep(fields: StoredExtractedFields): WebChatNextStep | null {
  const hasMinimum =
    Boolean(fields.venueType || fields.scale) &&
    Boolean(fields.city || fields.neighborhood);
  if (!hasMinimum) {
    return null;
  }

  return {
    label: "Open my spaces",
    route: "/spaces",
    prefill: {
      city: fields.city || "",
      capacity: fields.scale || "",
      neighborhood: fields.neighborhood || fields.city || "",
      availabilityHint: fields.dateWindow || fields.availability || "",
      venueType: fields.venueType || "",
    },
  };
}

function buildFanNextStep(fields: StoredExtractedFields): WebChatNextStep | null {
  const hasMinimum =
    fields.interests.length > 0 || Boolean(fields.city && fields.projectIdea);
  if (!hasMinimum) {
    return null;
  }

  return {
    label: "See events",
    route: "/feed",
    prefill: {
      city: fields.city || "",
      interests: fields.interests.length > 0 ? fields.interests : ["Events"],
    },
  };
}

export function deriveNextStep(
  persona: Persona | null,
  history: ChatMessage[],
  latestMessage: string,
) {
  const fields = extractStructuredFields({
    persona,
    history,
    latestMessage,
  });
  if (persona === "host") {
    return sanitizeNextStepPayload(buildHostNextStep(fields));
  }
  if (persona === "creative") {
    return sanitizeNextStepPayload(buildCreativeNextStep(fields));
  }
  if (persona === "venue") {
    return sanitizeNextStepPayload(buildVenueNextStep(fields));
  }
  if (persona === "fan") {
    return sanitizeNextStepPayload(buildFanNextStep(fields));
  }
  return null;
}

function buildCapabilityReply(persona: Persona | null, fields: StoredExtractedFields): AgentReply {
  return {
    reply:
      persona === "creative"
        ? "I can shape your creative profile and route you to the right opportunities. What kind of work are you chasing?"
        : "I can shape the brief and route you to the right next page. Which lane fits best: host, creative, venue, or fan?",
    nextStep: null,
    persona,
    extractedFields: fields,
    diagnostics: {
      operation: persona ? `sagasan_${persona}_intake` : "sagasan_router",
      selectedReplySource: "deterministic_fallback",
      fallbackReason: "capability_question",
      providerState: "openai_not_called_mode_mock",
      model: getConfiguredModel(),
      configuredMode: "active_mock",
      effectiveMode: "autonomous_mock",
      openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      openAiCalled: false,
      activeLiveAllowed: false,
      shadowMode: true,
      blockingGate: "mode_mock",
      publicLaunchGate: process.env.PUBLIC_LAUNCH_ENABLED === "true",
    },
  };
}

function buildBoundaryReply(
  kind: "ticketing" | "paid_work" | "guarantee" | "off_topic" | "external_action" | "trust_boundary",
  persona: Persona | null,
  fields: StoredExtractedFields,
  latestMessage: string,
): AgentReply {
  let reply = TICKET_REPLY;

  if (kind === "paid_work") {
    reply = "I can't promise paid work. What role and city should I anchor for you?";
  } else if (kind === "guarantee") {
    if (/\bbook my whole team\b|\bbook the whole team\b|\bconfirm(ed)? team\b/i.test(latestMessage)) {
      reply =
        "I can help map the team you may need, but I can't confirm or book anyone automatically. What kind of project are you building?";
    } else if (/\bbook gigs?\b|\b100%\s+sure\b|\bpaid work\b|\bget paid\b/i.test(latestMessage)) {
      reply =
        "I can't guarantee bookings, but I can help shape your profile so opportunities are easier to match. What role and city should I anchor?";
    } else {
      reply =
        "I can't guarantee bookings or a confirmed team. What should I help shape next?";
    }
  } else if (kind === "off_topic") {
    reply =
      "I stay focused on creative plans, opportunities, spaces, and scenes. What are you trying to make or find?";
  } else if (kind === "trust_boundary") {
    reply =
      "Not yet. Saga can help prepare the shortlist, but no one is confirmed or contacted until a human reviews and approves it. Who are you trying to line up?";
  } else if (kind === "external_action") {
    reply =
      "Saga can help prepare outreach, but it won't contact anyone until a human reviews and approves it. Who are you trying to reach, and for what project?";
  }

  return {
    reply,
    nextStep: null,
    persona,
    extractedFields: fields,
    diagnostics: {
      operation: persona ? `sagasan_${persona}_intake` : "sagasan_router",
      selectedReplySource: "deterministic_fallback",
      fallbackReason: kind,
      providerState: "openai_not_called_mode_mock",
      model: getConfiguredModel(),
      configuredMode: "active_mock",
      effectiveMode: "autonomous_mock",
      openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      openAiCalled: false,
      activeLiveAllowed: false,
      shadowMode: true,
      blockingGate: "mode_mock",
      publicLaunchGate: process.env.PUBLIC_LAUNCH_ENABLED === "true",
    },
  };
}

function buildDeterministicReply({
  persona,
  history,
  latestMessage,
  providerState,
  fallbackReason,
  configuredMode,
}: {
  persona: Persona | null;
  history: ChatMessage[];
  latestMessage: string;
  providerState: ProviderState;
  fallbackReason: string | null;
  configuredMode: RouteLlmMode;
}): AgentReply {
  const extractedFields = extractStructuredFields({
    persona,
    history,
    latestMessage,
  });

  if (shouldAnswerTickets(latestMessage)) {
    return buildBoundaryReply("ticketing", persona, extractedFields, latestMessage);
  }
  if (isTrustBoundary(latestMessage)) {
    return buildBoundaryReply("trust_boundary", persona, extractedFields, latestMessage);
  }
  if (isOutboundActionBoundary(latestMessage)) {
    return buildBoundaryReply("external_action", persona, extractedFields, latestMessage);
  }
  if (isPaidWorkBoundary(latestMessage)) {
    return buildBoundaryReply("paid_work", persona, extractedFields, latestMessage);
  }
  if (isGuaranteeBoundary(latestMessage)) {
    return buildBoundaryReply("guarantee", persona, extractedFields, latestMessage);
  }
  if (isCapabilityQuestion(latestMessage)) {
    return buildCapabilityReply(persona, extractedFields);
  }
  if (isOffTopic(latestMessage)) {
    return buildBoundaryReply("off_topic", persona, extractedFields, latestMessage);
  }

  if (!persona) {
    return {
      reply:
        "I can route hosts, creatives, venues, and fans. Which lane fits you best?",
      nextStep: null,
      persona,
      extractedFields,
      diagnostics: {
        operation: "sagasan_router",
        selectedReplySource: "deterministic_fallback",
        fallbackReason: fallbackReason || "router_needed",
        providerState,
        model: getConfiguredModel(),
        configuredMode,
        effectiveMode:
          providerState === "openai_not_called_gate_closed" ? "holding" : "autonomous_mock",
        openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
        openAiCalled: false,
        activeLiveAllowed: configuredMode === "active_live",
        shadowMode: configuredMode !== "active_live",
        blockingGate:
          providerState === "openai_not_called_gate_closed"
            ? "runtime_gate_closed"
            : configuredMode === "active_live"
              ? fallbackReason
              : "mode_mock",
        publicLaunchGate: process.env.PUBLIC_LAUNCH_ENABLED === "true",
      },
    };
  }

  const nextStep = deriveNextStep(persona, history, latestMessage);
  const organizerReadiness =
    persona === "host"
      ? evaluateOrganizerBriefReadiness(organizerFieldsFromStored(extractedFields))
      : null;
  if (nextStep) {
    const successReplies = {
      host: organizerReadiness
        ? organizerReadiness.stage === "talent_search_ready"
          ? "Got it — this is enough signal for a clean brief, plan, and crew search."
          : organizerReadiness.stage === "production_plan_ready"
            ? "Got it — this is enough signal for a clean brief and production plan."
            : `Got it — I can shape this into a partial brief now. I still need ${formatOrganizerMissingSummary(organizerReadiness)} before I build the production plan.`
        : "Got it — I can shape this into a partial brief now. Keep filling in the project details.",
      creative: "Got it — I shaped that into your creative profile draft.",
      venue: "Got it — I shaped that into your space profile draft.",
      fan: "Got it. I tuned that into your event feed setup.",
    } satisfies Record<Exclude<Persona, null>, string>;

    return {
      reply: successReplies[persona],
      nextStep,
      persona,
      extractedFields: {
        ...extractedFields,
        nextRoute: nextStep.route,
      },
      diagnostics: {
        operation: `sagasan_${persona}_intake`,
        selectedReplySource: "deterministic_fallback",
        fallbackReason,
        providerState,
        model: getConfiguredModel(),
        configuredMode,
        effectiveMode:
          providerState === "openai_not_called_gate_closed"
            ? "holding"
            : "autonomous_mock",
        openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
        openAiCalled: false,
        activeLiveAllowed: configuredMode === "active_live",
        shadowMode: configuredMode !== "active_live",
        blockingGate:
          providerState === "openai_not_called_gate_closed"
            ? "runtime_gate_closed"
            : configuredMode === "active_live"
              ? fallbackReason
              : "mode_mock",
        publicLaunchGate: process.env.PUBLIC_LAUNCH_ENABLED === "true",
      },
    };
  }

  let reply = "Got it. What should I help shape next?";
  if (persona === "host") {
    if (!organizerReadiness) {
      reply = "Got it. Tell me what you're planning, and add whatever context you already know in one message.";
    } else if (isOrganizerCorrectionPrompt(latestMessage)) {
      reply = buildOrganizerCorrectionReply(
        organizerFieldsFromStored(extractedFields),
        organizerReadiness,
      );
    } else if (!extractedFields.projectIdea) {
      reply =
        "Got it. Tell me the project idea, and if you know them, add the city, timing, rough attendance, venue status, budget range, and any references in the same note.";
    } else {
      const knownSummary = formatOrganizerKnownSummary(organizerReadiness);
      reply = `Got it — I have ${knownSummary}. ${organizerReadiness.nextBestQuestion}`;
    }
  } else if (persona === "creative") {
    if (extractedFields.roles.length === 0) {
      reply = "Got it — what kind of creative work do you want most?";
    } else if (!extractedFields.city) {
      reply = "Got it — what city are you based in?";
    } else {
      reply = "Got it — where can I see your work?";
    }
  } else if (persona === "venue") {
    if (!extractedFields.venueType) {
      reply = "Got it — what kind of space is it?";
    } else if (!extractedFields.city && !extractedFields.neighborhood) {
      reply = "Got it — what city is the space in?";
    } else if (!extractedFields.scale) {
      reply = "Got it — about how many people can it hold?";
    } else {
      reply = "Got it — what dates or weekends are usually open?";
    }
  } else if (persona === "fan") {
    if (!extractedFields.city) {
      reply = "Got it. What city or scene should I look around?";
    } else {
      reply = "Got it. What kind of nights or fandoms should I tune for?";
    }
  }

  return {
    reply,
    nextStep: null,
    persona,
    extractedFields,
    diagnostics: {
      operation: `sagasan_${persona}_intake`,
      selectedReplySource: "deterministic_fallback",
      fallbackReason,
      providerState,
      model: getConfiguredModel(),
      configuredMode,
      effectiveMode:
        providerState === "openai_not_called_gate_closed" ? "holding" : "autonomous_mock",
      openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      openAiCalled: false,
      activeLiveAllowed: configuredMode === "active_live",
      shadowMode: configuredMode !== "active_live",
      blockingGate:
        providerState === "openai_not_called_gate_closed"
          ? "runtime_gate_closed"
          : configuredMode === "active_live"
            ? fallbackReason
            : "mode_mock",
      publicLaunchGate: process.env.PUBLIC_LAUNCH_ENABLED === "true",
    },
  };
}

export function buildUiFallbackReply(persona: Persona | null) {
  if (persona === "host") {
    return "Got it. I lost that turn for a second — send the city, timing, rough attendance, venue status, budget range, and any references when you can.";
  }
  if (persona === "creative") {
    return "Got it — I lost that turn for a second. What city are you based in?";
  }
  if (persona === "venue") {
    return "Got it — I lost that turn for a second. What city is the space in?";
  }
  if (persona === "fan") {
    return "Got it. I lost that turn for a second — what city should I look around?";
  }
  return "Got it. I lost that turn for a second — are you here as a host, creative, venue, or fan?";
}

export function buildMockAgentReply({
  persona,
  history,
  latestMessage,
}: {
  persona: Persona | null;
  history: ChatMessage[];
  latestMessage: string;
}): AgentReply {
  return buildDeterministicReply({
    persona,
    history,
    latestMessage,
    providerState: "openai_not_called_mode_mock",
    fallbackReason: "active_live_disabled",
    configuredMode: "active_mock",
  });
}

export async function preflightOpenAiModelAccess({
  apiKey,
  model = getConfiguredModel(),
  baseUrl = process.env.OPENAI_BASE_URL || null,
}: {
  apiKey?: string | null;
  model?: string;
  baseUrl?: string | null;
}) {
  if (!apiKey?.trim()) {
    return {
      status: "skipped" as const,
      message: "OPENAI_API_KEY is missing. Skipping model preflight.",
      model,
    };
  }

  try {
    const client = getOpenAiClient({
      apiKey: apiKey.trim(),
      baseUrl,
    });
    await client.responses.create(
      {
        model,
        input: "ping",
        max_output_tokens: 5,
        temperature: 0,
      },
      {
        timeout: 8000,
        maxRetries: 1,
      },
    );

    return {
      status: "ok" as const,
      message: `Model ${model} is callable.`,
      model,
    };
  } catch (error) {
    const classified = classifyOpenAiError(error);
    return {
      status: classified.category,
      message: classified.message,
      model,
    };
  }
}

export async function generateAgentReply({
  persona,
  history,
  latestMessage,
  mode,
  apiKey,
  liveStructuredCall = callLiveStructured,
}: {
  persona: Persona | null;
  history: ChatMessage[];
  latestMessage: string;
  mode: RouteLlmMode;
  apiKey?: string | null;
  liveStructuredCall?: LiveStructuredCall;
}): Promise<
  | { ok: true; data: AgentReply }
  | {
      ok: false;
      errorCategory: string;
      errorMessage: string;
      data: AgentReply;
    }
> {
  const fallback = buildMockAgentReply({
    persona,
    history,
    latestMessage,
  });

  if (mode !== "active_live") {
    return {
      ok: true,
      data: fallback,
    };
  }

  if (!apiKey?.trim()) {
    return {
      ok: false,
      errorCategory: "missing_api_key",
      errorMessage: "OPENAI_API_KEY is missing.",
      data: {
        ...fallback,
        diagnostics: {
          ...fallback.diagnostics,
          providerState: "openai_not_called_missing_key",
          configuredMode: "active_live",
          activeLiveAllowed: false,
          blockingGate: "missing_api_key",
          fallbackReason: "missing_api_key",
        },
      },
    };
  }

  const response = await liveStructuredCall({
    apiKey: apiKey.trim(),
    baseUrl: process.env.OPENAI_BASE_URL || null,
    model: getConfiguredModel(),
    timeoutMs: Number.parseInt(process.env.LLM_TIMEOUT_MS || "", 10) || 8000,
    instructions: buildSystemPrompt(persona),
    prompt: [
      `Persona: ${persona ?? "router"}`,
      "Conversation so far:",
      summarizeTranscript(history, latestMessage),
      "Reply with Sagasan's next message and include nextStep only once the brief is ready to review.",
    ].join("\n\n"),
    temperature: 0.6,
    maxOutputTokens: 400,
  });

  if (!response.ok) {
    const providerState =
      response.errorCategory === "validation_failed"
        ? "openai_called_validation_failed"
        : "openai_called_failed";
    return {
      ok: false,
      errorCategory: response.errorCategory,
      errorMessage: response.errorMessage,
      data: {
        ...fallback,
        diagnostics: {
          ...fallback.diagnostics,
          providerState,
          configuredMode: "active_live",
          effectiveMode: "autonomous_mock",
          openAiCalled: true,
          openAiConfigured: true,
          activeLiveAllowed: true,
          shadowMode: false,
          model: getConfiguredModel(),
          fallbackReason: response.errorCategory,
          blockingGate: response.errorCategory,
        },
      },
    };
  }

  const extractedFields = extractStructuredFields({
    persona,
    history,
    latestMessage,
  });
  const sanitizedNextStep =
    sanitizeNextStepPayload(response.data.nextStep) ||
    deriveNextStep(persona, history, latestMessage);

  const reply = trimSentence(response.data.message, 260);
  return {
    ok: true,
    data: {
      reply,
      nextStep: sanitizedNextStep,
      persona,
      extractedFields: {
        ...extractedFields,
        nextRoute: sanitizedNextStep?.route || extractedFields.nextRoute,
      },
      diagnostics: {
        operation: persona ? `sagasan_${persona}_intake` : "sagasan_router",
        selectedReplySource: "openai_selected",
        fallbackReason: null,
        providerState: "openai_called_succeeded",
        model: getConfiguredModel(),
        configuredMode: "active_live",
        effectiveMode: "autonomous_live",
        openAiConfigured: true,
        openAiCalled: true,
        activeLiveAllowed: true,
        shadowMode: false,
        blockingGate: null,
        publicLaunchGate: process.env.PUBLIC_LAUNCH_ENABLED === "true",
      },
    },
  };
}
