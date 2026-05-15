import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getSuggestedRoles } from "@/data/sagaAgencyData";
import {
  PERSONA_OPTIONS,
  normalizePersona,
  type Persona,
} from "@/lib/sagasanPersonas";
import { buildSystemPrompt } from "@/lib/sagasanSystemPrompt";
import {
  clampNextStepLabel,
  webChatNextStepSchema,
  type WebChatNextStep,
  type WebChatPrefill,
} from "@/lib/webChatNextStep";
import type { ProjectType } from "@/types/sagaAgency";

export type ChatRole = "user" | "assistant";
export type RouteLlmMode = "active_mock" | "active_live";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type AgentReply = {
  reply: string;
  nextStep: WebChatNextStep | null;
  persona: Persona | null;
};

type OpenAiStructuredResult<T> =
  | {
      ok: true;
      data: T;
      responseId: string | null;
    }
  | {
      ok: false;
      errorCategory: string;
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

type BaseFields = {
  city: string | null;
};

type HostPrefill = BaseFields & {
  eventType: string | null;
  scale: string | null;
  vibe: string | null;
  date: string | null;
  helpNeeded: string | null;
  projectType: ProjectType;
  suggestedRoles: string[];
};

type CreativePrefill = BaseFields & {
  roles: string[];
  portfolio: string | null;
  availability: string | null;
  rates: string | null;
};

type VenuePrefill = {
  capacity: string | null;
  neighborhood: string | null;
  availabilityHint: string | null;
};

type FanPrefill = BaseFields & {
  interests: string[];
  email: string | null;
};

const liveAgentReplySchema = z.object({
  message: z.string().trim().min(1),
  nextStep: webChatNextStepSchema.nullable().optional(),
});

type LiveAgentReply = z.infer<typeof liveAgentReplySchema>;

const TICKET_REPLY = "Tickets live elsewhere — Saga doesn't handle those.";

const CITY_PATTERNS = [
  "Los Angeles",
  "LA",
  "Pasadena",
  "New York",
  "NYC",
  "Brooklyn",
  "Miami",
  "San Francisco",
  "SF",
  "Oakland",
  "Chicago",
  "Seattle",
];

const ROLE_KEYWORDS = [
  "photographer",
  "producer",
  "host",
  "dj",
  "stylist",
  "hmua",
  "editor",
  "director",
  "dp",
  "set designer",
  "vendor lead",
  "vendor",
  "cosplayer",
  "social producer",
  "social manager",
  "art director",
  "creative director",
  "creator",
  "performer",
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
]);

const GENERIC_PERSONA_STARTERS = new Set(
  PERSONA_OPTIONS.map((option) => option.firstTurn.toLowerCase()),
);

let cachedClient: OpenAI | null = null;
let cachedApiKey: string | null = null;
let cachedBaseUrl: string | null = null;

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
        errorCategory: "empty_output",
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
    return {
      ok: false,
      errorCategory: "openai_error",
      errorMessage:
        error instanceof Error ? error.message : "Unknown OpenAI error.",
      statusCode:
        error && typeof error === "object" && "status" in error
          ? Number((error as { status?: number }).status) || null
          : null,
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

export function shouldAnswerTickets(message: string) {
  return /\bticket|tickets|admission|entry pass|passes\b/i.test(message);
}

function summarizeTranscript(history: ChatMessage[], latestMessage: string) {
  return [...history, { role: "user" as const, content: latestMessage }]
    .map((message) =>
      `${message.role === "assistant" ? "Sagasan" : "User"}: ${message.content}`,
    )
    .join("\n");
}

function inferCity(value: string) {
  const lower = value.toLowerCase();
  const found = CITY_PATTERNS.find((city) =>
    lower.includes(city.toLowerCase()),
  );

  if (!found) {
    return null;
  }

  if (found === "LA") return "Los Angeles";
  if (found === "NYC") return "New York";
  if (found === "SF") return "San Francisco";
  return found;
}

function inferHostProjectType(value: string): ProjectType {
  const lower = value.toLowerCase();
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

function inferEventTypeLabel(projectType: ProjectType, raw: string) {
  if (projectType !== "Other") {
    return projectType;
  }

  const normalized = raw.trim().replace(/\s+/g, " ");
  return normalized.split(/[.!?]/)[0]?.slice(0, 48) || "Creative project";
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

function inferDateHint(value: string) {
  const match = value.match(
    /\b(next month|next week|this weekend|this month|next season|summer|fall|winter|spring|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan(?:uary)?(?:\s+\d{1,2})?|feb(?:ruary)?(?:\s+\d{1,2})?|mar(?:ch)?(?:\s+\d{1,2})?|apr(?:il)?(?:\s+\d{1,2})?|may(?:\s+\d{1,2})?|jun(?:e)?(?:\s+\d{1,2})?|jul(?:y)?(?:\s+\d{1,2})?|aug(?:ust)?(?:\s+\d{1,2})?|sep(?:tember)?(?:\s+\d{1,2})?|oct(?:ober)?(?:\s+\d{1,2})?|nov(?:ember)?(?:\s+\d{1,2})?|dec(?:ember)?(?:\s+\d{1,2})?)\b/i,
  );
  return match ? match[1] : null;
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

function inferAvailabilityHint(value: string) {
  const match = value.match(
    /\b(available[^.?!,]*|open[^.?!,]*|after \d{1,2}(?::\d{2})?\s*(?:am|pm)?[^.?!,]*|this month[^.?!,]*|next month[^.?!,]*)\b/i,
  );
  return match ? match[1] : null;
}

function inferNeighborhood(value: string) {
  const match =
    value.match(/\b(?:in|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/) ||
    value.match(/\b(downtown|arts district|silver lake|echo park|brooklyn|hollywood|dtla|soho|williamsburg)\b/i);
  return match ? match[1] || match[0] : null;
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

function normalizeRoleLabel(role: string) {
  return role
    .split(/[,/]| and /i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/\b\w/g, (char) => char.toUpperCase()))
    .join(", ");
}

function inferCreativeRoles(value: string) {
  const lower = value.toLowerCase();
  return ROLE_KEYWORDS.filter((role) => lower.includes(role)).map((role) =>
    normalizeRoleLabel(role),
  );
}

function inferFanInterests(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9,\s/-]/g, " ")
    .split(/[,\s/]+/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        (part.length > 2 || part === "dj") &&
        !FAN_INTEREST_STOP_WORDS.has(part),
    )
    .slice(0, 3)
    .map((part) => part.replace(/\b\w/g, (char) => char.toUpperCase()));
}

function inferEmail(value: string) {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
}

function getUserTranscript(
  history: ChatMessage[],
  latestMessage: string,
  persona: Persona | null,
) {
  const baseTranscript = [...history, { role: "user" as const, content: latestMessage }]
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean);

  const filtered = baseTranscript.filter((content) => {
    if (!GENERIC_PERSONA_STARTERS.has(content.toLowerCase())) {
      return true;
    }

    return false;
  });

  if (filtered.length > 0) {
    return filtered.join("\n");
  }

  if (!persona) {
    return baseTranscript.join("\n");
  }

  return "";
}

function extractHostPrefill(
  history: ChatMessage[],
  latestMessage: string,
): HostPrefill {
  const transcript = getUserTranscript(history, latestMessage, "host");
  const projectType = inferHostProjectType(transcript);
  return {
    eventType: transcript ? inferEventTypeLabel(projectType, transcript) : null,
    city: inferCity(transcript),
    scale: inferScale(transcript),
    vibe:
      transcript
        .split(/[.!?]/)
        .map((part) => part.trim())
        .find(Boolean) || null,
    date: inferDateHint(transcript),
    helpNeeded: /need ([^.?!]+)/i.test(transcript)
      ? transcript.match(/need ([^.?!]+)/i)?.[1] || null
      : null,
    projectType,
    suggestedRoles: getSuggestedRoles(projectType),
  };
}

function extractCreativePrefill(
  history: ChatMessage[],
  latestMessage: string,
): CreativePrefill {
  const transcript = getUserTranscript(history, latestMessage, "creative");
  return {
    roles: inferCreativeRoles(transcript),
    city: inferCity(transcript),
    portfolio: inferPortfolioLink(transcript),
    availability: inferAvailabilityHint(transcript),
    rates: inferRateHint(transcript),
  };
}

function extractVenuePrefill(
  history: ChatMessage[],
  latestMessage: string,
): VenuePrefill {
  const transcript = getUserTranscript(history, latestMessage, "venue");
  return {
    capacity: inferCapacity(transcript),
    neighborhood: inferNeighborhood(transcript),
    availabilityHint: inferDateHint(transcript) || inferAvailabilityHint(transcript),
  };
}

function extractFanPrefill(
  history: ChatMessage[],
  latestMessage: string,
): FanPrefill {
  const transcript = getUserTranscript(history, latestMessage, "fan");
  const city = inferCity(transcript);
  const blockedInterestTokens = new Set(
    (city || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean),
  );

  return {
    city,
    interests: inferFanInterests(transcript).filter(
      (interest) => !blockedInterestTokens.has(interest.toLowerCase()),
    ),
    email: inferEmail(transcript),
  };
}

function hostNeeds(prefill: HostPrefill) {
  const missing: string[] = [];
  if (!prefill.eventType) missing.push("eventType");
  if (!prefill.city) missing.push("city");
  if (!prefill.scale) missing.push("scale");
  if (!prefill.vibe) missing.push("vibe");
  return missing;
}

function creativeNeeds(prefill: CreativePrefill) {
  const missing: string[] = [];
  if (!prefill.roles.length) missing.push("roles");
  if (!prefill.city) missing.push("city");
  if (!prefill.portfolio) missing.push("portfolio");
  return missing;
}

function venueNeeds(prefill: VenuePrefill) {
  const missing: string[] = [];
  if (!prefill.capacity) missing.push("capacity");
  if (!prefill.neighborhood) missing.push("neighborhood");
  if (!prefill.availabilityHint) missing.push("availabilityHint");
  return missing;
}

function fanNeeds(prefill: FanPrefill) {
  const missing: string[] = [];
  if (!prefill.city) missing.push("city");
  if (!prefill.interests.length) missing.push("interests");
  return missing;
}

function buildHostNextStep(prefill: HostPrefill): WebChatNextStep | null {
  if (hostNeeds(prefill).length > 0 || !prefill.eventType || !prefill.city || !prefill.scale || !prefill.vibe) {
    return null;
  }

  const payload: WebChatPrefill = {
    eventType: prefill.eventType,
    city: prefill.city,
    scale: prefill.scale,
    vibe: prefill.vibe,
    projectType: prefill.projectType,
    suggestedRoles: prefill.suggestedRoles,
  };

  if (prefill.date) payload.date = prefill.date;
  if (prefill.helpNeeded) payload.helpNeeded = prefill.helpNeeded;

  return {
    label: "Build my event",
    route: "/projects/new",
    prefill: payload,
  };
}

function buildCreativeNextStep(prefill: CreativePrefill): WebChatNextStep | null {
  if (creativeNeeds(prefill).length > 0 || !prefill.city || !prefill.portfolio) {
    return null;
  }

  const payload: WebChatPrefill = {
    city: prefill.city,
    roles: prefill.roles,
    portfolio: prefill.portfolio,
  };

  if (prefill.availability) payload.availability = prefill.availability;
  if (prefill.rates) payload.rates = prefill.rates;

  return {
    label: "Open my feed",
    route: "/me",
    prefill: payload,
  };
}

function buildVenueNextStep(prefill: VenuePrefill): WebChatNextStep | null {
  if (
    venueNeeds(prefill).length > 0 ||
    !prefill.capacity ||
    !prefill.neighborhood ||
    !prefill.availabilityHint
  ) {
    return null;
  }

  return {
    label: "Open my spaces",
    route: "/spaces",
    prefill: {
      capacity: prefill.capacity,
      neighborhood: prefill.neighborhood,
      availabilityHint: prefill.availabilityHint,
    },
  };
}

function buildFanNextStep(prefill: FanPrefill): WebChatNextStep | null {
  if (fanNeeds(prefill).length > 0 || !prefill.city || prefill.interests.length === 0) {
    return null;
  }

  const payload: WebChatPrefill = {
    city: prefill.city,
    interests: prefill.interests,
  };

  if (prefill.email) payload.email = prefill.email;

  return {
    label: "See events",
    route: "/feed",
    prefill: payload,
  };
}

export function inferPersonaFromMessage(message: string): PersonaSignal {
  const lower = message.toLowerCase();

  if (/creative looking for work|portfolio|freelance|available for work/.test(lower)) {
    return "creative";
  }

  if (/run a space|our venue|my venue|my space/.test(lower)) {
    return "venue";
  }

  if (/find cool stuff|what's on|looking for events|things to do/.test(lower)) {
    return "fan";
  }

  if (message.trim()) {
    return "host";
  }

  return null;
}

export function resolvePersona({
  explicitPersona,
  cookiePersona,
  latestMessage,
}: {
  explicitPersona: unknown;
  cookiePersona: string | null | undefined;
  latestMessage: string;
}) {
  const normalizedExplicit =
    typeof explicitPersona === "string" ? normalizePersona(explicitPersona) : null;
  return (
    normalizedExplicit ||
    normalizePersona(cookiePersona) ||
    inferPersonaFromMessage(latestMessage)
  );
}

function buildMockFollowUp(persona: Persona, history: ChatMessage[], latestMessage: string) {
  if (persona === "host") {
    const prefill = extractHostPrefill(history, latestMessage);
    const nextStep = buildHostNextStep(prefill);
    if (nextStep) {
      return {
        reply: `That’s enough to start shaping the event. I turned it into a draft crew brief for you.`,
        nextStep,
      };
    }

    const missing = hostNeeds(prefill);
    if (missing[0] === "eventType") {
      return {
        reply: "What are you hosting?",
        nextStep: null,
      };
    }
    if (missing[0] === "city") {
      return {
        reply: "What city should Saga anchor this in?",
        nextStep: null,
      };
    }
    if (missing[0] === "scale") {
      return {
        reply: "About how big should this feel?",
        nextStep: null,
      };
    }
    return {
      reply: "What should the vibe feel like?",
      nextStep: null,
    };
  }

  if (persona === "creative") {
    const prefill = extractCreativePrefill(history, latestMessage);
    const nextStep = buildCreativeNextStep(prefill);
    if (nextStep) {
      return {
        reply: "Perfect. I have enough to start shaping your feed and opportunities.",
        nextStep,
      };
    }

    const missing = creativeNeeds(prefill);
    if (missing[0] === "roles") {
      return {
        reply: "What kind of work do you want most?",
        nextStep: null,
      };
    }
    if (missing[0] === "city") {
      return {
        reply: "What city should I anchor you in?",
        nextStep: null,
      };
    }
    return {
      reply: "Where can Sagasan see your work?",
      nextStep: null,
    };
  }

  if (persona === "venue") {
    const prefill = extractVenuePrefill(history, latestMessage);
    const nextStep = buildVenueNextStep(prefill);
    if (nextStep) {
      return {
        reply: "Perfect. I can start routing requests around that space now.",
        nextStep,
      };
    }

    const missing = venueNeeds(prefill);
    if (missing[0] === "capacity") {
      return {
        reply: "About how many people can the space hold?",
        nextStep: null,
      };
    }
    if (missing[0] === "neighborhood") {
      return {
        reply: "What neighborhood should I pin this to?",
        nextStep: null,
      };
    }
    return {
      reply: "What dates or windows are usually open?",
      nextStep: null,
    };
  }

  const prefill = extractFanPrefill(history, latestMessage);
  const nextStep = buildFanNextStep(prefill);
  if (nextStep) {
    return {
      reply: "Perfect. I can tune the public feed around that taste now.",
      nextStep,
    };
  }

  const missing = fanNeeds(prefill);
  if (missing[0] === "city") {
    return {
      reply: "What city should Saga tune for you?",
      nextStep: null,
    };
  }
  return {
    reply: "What scenes do you want more of?",
    nextStep: null,
  };
}

export function deriveNextStep(persona: Persona | null, history: ChatMessage[], latestMessage: string) {
  if (!persona) {
    return null;
  }

  if (persona === "host") {
    return buildHostNextStep(extractHostPrefill(history, latestMessage));
  }
  if (persona === "creative") {
    return buildCreativeNextStep(extractCreativePrefill(history, latestMessage));
  }
  if (persona === "venue") {
    return buildVenueNextStep(extractVenuePrefill(history, latestMessage));
  }
  return buildFanNextStep(extractFanPrefill(history, latestMessage));
}

export function sanitizeNextStep(
  value: unknown,
  fallback: WebChatNextStep | null,
): WebChatNextStep | null {
  const parsed = webChatNextStepSchema.safeParse(value);
  if (!parsed.success) {
    return fallback;
  }

  return {
    ...parsed.data,
    label: clampNextStepLabel(parsed.data.label),
  };
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
  if (shouldAnswerTickets(latestMessage)) {
    return {
      reply: TICKET_REPLY,
      nextStep: null,
      persona,
    };
  }

  if (!persona) {
    return {
      reply: "Which path fits you best: host, creative, venue, or fan?",
      nextStep: null,
      persona,
    };
  }

  const next = buildMockFollowUp(persona, history, latestMessage);
  return {
    reply: next.reply,
    nextStep: next.nextStep,
    persona,
  };
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
      fallback: AgentReply;
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
      fallback: {
        ...fallback,
        nextStep: null,
      },
    };
  }

  const response = await liveStructuredCall({
    apiKey: apiKey.trim(),
    baseUrl: process.env.OPENAI_BASE_URL || null,
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    timeoutMs: Number.parseInt(process.env.LLM_TIMEOUT_MS || "", 10) || 8000,
    instructions: buildSystemPrompt(persona),
    prompt: [
      `Persona: ${persona ?? "router"}`,
      "Conversation so far:",
      summarizeTranscript(history, latestMessage),
      "Reply with Sagasan's next message and include nextStep once the intake is ready.",
    ].join("\n\n"),
    temperature: 0.6,
    maxOutputTokens: 400,
  });

  if (!response.ok) {
    return {
      ok: false,
      errorCategory: response.errorCategory,
      errorMessage: response.errorMessage,
      fallback: {
        ...fallback,
        nextStep: null,
      },
    };
  }

  return {
    ok: true,
    data: {
      reply: response.data.message,
      nextStep: sanitizeNextStep(
        response.data.nextStep,
        deriveNextStep(persona, history, latestMessage),
      ),
      persona,
    },
  };
}
