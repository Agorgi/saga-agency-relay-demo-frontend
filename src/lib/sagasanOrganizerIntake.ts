import type { WebChatPrefill } from "@/lib/webChatNextStep";

export type OrganizerReadinessStage =
  | "seed_idea"
  | "intake_in_progress"
  | "draft_brief_ready"
  | "production_plan_ready"
  | "talent_search_ready";

export type OrganizerReferenceStatus = "provided" | "requested" | "unknown";
export type OrganizerBudgetStatus = "known" | "unknown";

export type OrganizerRequiredField =
  | "projectIdea"
  | "locationMarket"
  | "timing"
  | "scopeFormat"
  | "themeVibe"
  | "expectedAttendance"
  | "lineupStatus"
  | "helpNeeded"
  | "budget"
  | "inspirationStatus";

export type OrganizerImportantField =
  | "userRole"
  | "userIdentity"
  | "organization"
  | "socials"
  | "audience"
  | "ticketingModel"
  | "safetyFlags"
  | "urgency"
  | "desiredTalentRoles";

export type OrganizerIntakeFields = {
  projectIdea: string | null;
  locationMarket: string | null;
  timing: string | null;
  scopeFormat: string | null;
  themeVibe: string | null;
  expectedAttendance: string | null;
  lineupStatus: string | null;
  helpNeeded: string | null;
  budget: string | null;
  budgetStatus: OrganizerBudgetStatus | null;
  inspirationStatus: OrganizerReferenceStatus | null;
  inspirationReferences: string[];
  userRole: string | null;
  userIdentity: string | null;
  organization: string | null;
  socials: string[];
  audience: string | null;
  ticketingModel: string | null;
  safetyFlags: string[];
  urgency: string | null;
  desiredTalentRoles: string[];
};

export type OrganizerBriefReadiness = {
  stage: OrganizerReadinessStage;
  enoughInfoForDraftBrief: boolean;
  enoughInfoForProductionPlan: boolean;
  enoughInfoForTalentSearch: boolean;
  missingRequiredFields: OrganizerRequiredField[];
  missingImportantFields: OrganizerImportantField[];
  knownFields: Partial<Record<OrganizerRequiredField | OrganizerImportantField, string>>;
  confidence: number;
  nextBestQuestion: string;
  reason: string;
  essentialsAnswered: number;
  essentialsTotal: number;
};

const ORGANIZER_REQUIRED_FIELDS: OrganizerRequiredField[] = [
  "projectIdea",
  "locationMarket",
  "timing",
  "scopeFormat",
  "themeVibe",
  "expectedAttendance",
  "lineupStatus",
  "helpNeeded",
  "budget",
  "inspirationStatus",
];

const ORGANIZER_IMPORTANT_FIELDS: OrganizerImportantField[] = [
  "userRole",
  "userIdentity",
  "organization",
  "socials",
  "audience",
  "ticketingModel",
  "safetyFlags",
  "urgency",
  "desiredTalentRoles",
];

const REQUIRED_FIELD_LABELS: Record<OrganizerRequiredField, string> = {
  projectIdea: "project idea",
  locationMarket: "location",
  timing: "timing",
  scopeFormat: "format",
  themeVibe: "vibe",
  expectedAttendance: "attendance",
  lineupStatus: "crew or venue status",
  helpNeeded: "help needed",
  budget: "budget",
  inspirationStatus: "references",
};

const IMPORTANT_FIELD_LABELS: Record<OrganizerImportantField, string> = {
  userRole: "role",
  userIdentity: "identity",
  organization: "organization",
  socials: "socials",
  audience: "audience",
  ticketingModel: "ticketing",
  safetyFlags: "safety flags",
  urgency: "urgency",
  desiredTalentRoles: "target roles",
};

const PERSONA_STARTERS = new Set([
  "i want to host something.",
  "i want to host something",
  "i'm a creative looking for work.",
  "i'm a creative looking for work",
  "i run a space.",
  "i run a space",
  "i'm here to find cool stuff.",
  "i'm here to find cool stuff",
]);

const CORRECTION_PATTERNS = [
  /\bdon'?t you need more info\b/i,
  /\bwhat else do you need\b/i,
  /\bis that enough\b/i,
  /\baren'?t you missing something\b/i,
  /\bdo you need more info\b/i,
];

const URL_PATTERN = /https?:\/\/\S+/gi;
const HANDLE_PATTERN = /(^|\s)@([a-z0-9._]{2,30})\b/gi;

const CITY_PATTERNS: Array<[RegExp, string]> = [
  [/\blos angeles\b|\bla\b/i, "Los Angeles"],
  [/\bsilver lake\b/i, "Silver Lake"],
  [/\bbrooklyn\b/i, "Brooklyn"],
  [/\bnew york\b|\bnyc\b/i, "New York"],
  [/\bmiami\b/i, "Miami"],
  [/\bseattle\b/i, "Seattle"],
  [/\bchicago\b/i, "Chicago"],
  [/\bsan francisco\b|\bsf\b/i, "San Francisco"],
  [/\boakland\b/i, "Oakland"],
  [/\bpasadena\b/i, "Pasadena"],
];

const FORMAT_PATTERNS: Array<[RegExp, string]> = [
  [/\bformal ball\b/i, "Formal ball"],
  [/\bcosplay cafe night\b/i, "Cosplay cafe night"],
  [/\bcafe night\b/i, "Cafe night"],
  [/\bcreator launch party\b/i, "Creator launch party"],
  [/\blaunch party\b/i, "Launch party"],
  [/\banime picnic\b/i, "Anime picnic"],
  [/\bpop-?up\b/i, "Pop-up"],
  [/\bactivation\b/i, "Activation"],
  [/\bmeetup\b/i, "Meetup"],
  [/\bnight market\b/i, "Night market"],
  [/\bparty\b/i, "Party"],
  [/\bshow\b/i, "Show"],
  [/\bpicnic\b/i, "Picnic"],
  [/\bgala\b/i, "Gala"],
  [/\bball\b/i, "Ball"],
];

const VIBE_PATTERNS: Array<[RegExp, string[]]> = [
  [/\blove and deepspace\b/i, ["romantic", "elegant", "fandom-inspired", "space/fantasy-inspired"]],
  [/\bformal\b/i, ["formal"]],
  [/\bball\b/i, ["elegant"]],
  [/\bplayful\b/i, ["playful"]],
  [/\bneon\b/i, ["neon"]],
  [/\banime\b/i, ["anime-inspired"]],
  [/\bcosplay\b/i, ["cosplay-friendly"]],
  [/\bfandom\b/i, ["fandom-led"]],
  [/\bcreator\b/i, ["creator-led"]],
  [/\bcommunity\b/i, ["community-driven"]],
  [/\bintimate\b/i, ["intimate"]],
  [/\bpolished\b/i, ["polished"]],
  [/\bromantic\b/i, ["romantic"]],
  [/\bspace\b|\bgalaxy\b|\bfantasy\b/i, ["space/fantasy-inspired"]],
];

const ROLE_PATTERNS: Array<[RegExp, string]> = [
  [/\bproducer\b/i, "Producer"],
  [/\bstylist\b/i, "Stylist"],
  [/\bvenue lead\b/i, "Venue Lead"],
  [/\bperformers?\b/i, "Performer"],
  [/\bphotographer\b/i, "Photographer"],
  [/\bdj\b/i, "DJ"],
  [/\bhost\b/i, "Host"],
  [/\bvendor\b/i, "Vendor"],
  [/\bvendor lead\b/i, "Vendor Lead"],
  [/\bsocial manager\b/i, "Social Manager"],
  [/\bset designer\b/i, "Set Designer"],
  [/\bart director\b/i, "Art Director"],
];

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function trimSentence(value: string, maxLength = 180) {
  return normalizeWhitespace(value).slice(0, maxLength);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatList(parts: string[]) {
  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0] || "";
  }
  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}

function extractCity(value: string) {
  for (const [pattern, label] of CITY_PATTERNS) {
    if (pattern.test(value)) {
      return label;
    }
  }
  return null;
}

function extractTiming(value: string) {
  const match = value.match(
    /\b(next month|next week|this weekend|this month|tonight|tomorrow|next friday|next saturday|next sunday|friday|saturday|sunday|summer|fall|winter|spring|january|february|march|april|may|june|july|august|september|october|november|december|jan(?:uary)?(?:\s+\d{1,2})?|feb(?:ruary)?(?:\s+\d{1,2})?|mar(?:ch)?(?:\s+\d{1,2})?|apr(?:il)?(?:\s+\d{1,2})?|jun(?:e)?(?:\s+\d{1,2})?|jul(?:y)?(?:\s+\d{1,2})?|aug(?:ust)?(?:\s+\d{1,2})?|sep(?:tember)?(?:\s+\d{1,2})?|oct(?:ober)?(?:\s+\d{1,2})?|nov(?:ember)?(?:\s+\d{1,2})?|dec(?:ember)?(?:\s+\d{1,2})?)\b/i,
  );
  return match ? titleCase(match[1]) : null;
}

function extractAttendance(value: string) {
  const explicit =
    value.match(/(\d+)\s*[- ]?(?:person|people|guest|guests|attendees?)/i) ||
    value.match(/\bfor\s+(\d+)\b/i);
  if (explicit) {
    return `${explicit[1]} people`;
  }
  if (/\bintimate\b/i.test(value)) return "Intimate";
  if (/\bsmall\b/i.test(value)) return "Small";
  if (/\bmid(?:-size)?\b|\bmedium\b/i.test(value)) return "Mid-sized";
  if (/\blarge\b|\bbig\b/i.test(value)) return "Large";
  return null;
}

function extractScopeFormat(value: string) {
  for (const [pattern, label] of FORMAT_PATTERNS) {
    if (pattern.test(value)) {
      return label;
    }
  }
  return null;
}

function extractThemeVibe(value: string) {
  return uniqueStrings(
    VIBE_PATTERNS.flatMap(([pattern, labels]) => (pattern.test(value) ? labels : [])),
  )
    .slice(0, 5)
    .join(", ") || null;
}

function extractUrls(value: string) {
  return uniqueStrings(Array.from(value.matchAll(URL_PATTERN), (match) => match[0] || ""));
}

function extractSocials(value: string) {
  const urls = extractUrls(value);
  const handles = Array.from(value.matchAll(HANDLE_PATTERN), (match) =>
    match[2] ? `@${match[2]}` : "",
  );
  return uniqueStrings([...urls, ...handles]);
}

function extractDesiredTalentRoles(value: string) {
  return uniqueStrings(
    ROLE_PATTERNS.filter(([pattern]) => pattern.test(value)).map(([, label]) => label),
  );
}

function extractProjectIdea(value: string) {
  const transcript = normalizeWhitespace(value);
  if (!transcript) {
    return null;
  }

  const starterRemoved = transcript
    .replace(/^i want to (?:throw|host|organize|produce|put on|plan|do)\s+/i, "")
    .replace(/^i(?:'m| am) thinking about\s+/i, "")
    .replace(/^thinking about\s+/i, "")
    .replace(/^we want to (?:throw|host|organize|produce|put on|plan|do)\s+/i, "");

  const inspiration = starterRemoved.match(/\binspired by ([^.?!,]+?)(?=\s+(?:in|for|next|this)\b|[.?!,]|$)/i)?.[1];
  const scopeFormat = extractScopeFormat(starterRemoved);

  if (scopeFormat && inspiration) {
    return trimSentence(`${scopeFormat} inspired by ${normalizeWhitespace(inspiration)}`, 120);
  }

  if (scopeFormat) {
    const themePrefix = /\banime\b/i.test(starterRemoved) && !/anime/i.test(scopeFormat)
      ? `Anime ${scopeFormat.toLowerCase()}`
      : /\bcosplay\b/i.test(starterRemoved) && !/cosplay/i.test(scopeFormat)
        ? `Cosplay ${scopeFormat.toLowerCase()}`
        : scopeFormat;
    return trimSentence(titleCase(themePrefix), 120);
  }

  const stripped = starterRemoved
    .replace(/\b(in|near)\s+(los angeles|la|silver lake|brooklyn|new york|nyc|miami|seattle|chicago|san francisco|sf|oakland|pasadena)\b.*$/i, "")
    .replace(/\b(next month|next week|this weekend|this month|tonight|tomorrow|friday|saturday|sunday|summer|fall|winter|spring|july|august|september|october|november|december)\b.*$/i, "")
    .replace(/\b(probably|around|for about)\s+\d+\s*(?:people|guests|attendees?).*$/i, "")
    .replace(/\bwith\b.*$/i, "")
    .replace(/^[Aa]n?\s+/i, "");

  return stripped ? trimSentence(titleCase(stripped), 120) : null;
}

function extractLineupStatus(value: string) {
  const fragments = uniqueStrings(
    [
      /\b(?:i do not|i don't|we do not|we don't) have a venue yet\b/i.test(value)
        ? "No venue yet"
        : null,
      /\bvenue (?:is )?(?:tbd|unknown|not locked|still scouting)\b/i.test(value)
        ? "Venue still open"
        : null,
      /\b(?:have|got) a venue\b|\bvenue locked\b|\bvenue confirmed\b/i.test(value)
        ? "Venue in progress"
        : null,
      /\bno production crew\b|\bno crew yet\b/i.test(value)
        ? "No production crew yet"
        : null,
      /\bone photographer friend\b/i.test(value)
        ? "One photographer friend in place"
        : null,
      /\bexisting crew\b|\bcrew already lined up\b/i.test(value)
        ? "Crew already in progress"
        : null,
      /\bpartners?\b|\bsponsors?\b|\bcollaborators?\b/i.test(value)
        ? trimSentence(
            value.match(/\b(?:partners?|sponsors?|collaborators?)[^.?!]*/i)?.[0] || "",
            120,
          ) || null
        : null,
    ].filter(Boolean) as string[],
  );

  return fragments.length ? fragments.join(". ") : null;
}

function extractHelpNeeded(value: string) {
  const explicit =
    value.match(/\bi want saga to help ([^.?!]+)/i) ||
    value.match(/\bi need saga to help ([^.?!]+)/i) ||
    value.match(/\bi need help (?:with|finding)\s+([^.?!]+)/i) ||
    value.match(/\bi need ([^.?!]+)/i);

  if (!explicit) {
    return null;
  }

  const cleaned = explicit[1]
    ?.replace(/\b(?:a|an|some)\s+/i, "")
    ?.replace(/^find\s+/i, "find ")
    ?.trim();
  return cleaned ? trimSentence(cleaned, 160) : null;
}

function extractBudget(value: string) {
  const money = value.match(/\$?\d+\s*k\b(?:\s*-\s*\$?\d+\s*k\b)?|\$[\d,]+(?:\s*-\s*\$?[\d,]+)?/i);
  if (money) {
    return {
      budget: trimSentence(money[0], 80),
      budgetStatus: "known" as const,
    };
  }

  if (/\bbudget\b/i.test(value) && /\b(?:unknown|tbd|not sure|no idea|still figuring it out)\b/i.test(value)) {
    return {
      budget: "Unknown",
      budgetStatus: "unknown" as const,
    };
  }

  return {
    budget: null,
    budgetStatus: null,
  };
}

function extractInspiration(value: string) {
  const urls = extractUrls(value);
  const labels = uniqueStrings(
    [
      urls.length ? urls[0] : null,
      /\bpinterest\b/i.test(value) ? "Pinterest board" : null,
      /\binstagram\b|\big\b/i.test(value) ? "Instagram reference" : null,
      /\bmood ?board\b/i.test(value) ? "Moodboard" : null,
      /\breference\b|\brefs\b|\bboard\b|\bpost\b|\bimage\b/i.test(value)
        ? "Reference shared in chat"
        : null,
    ].filter(Boolean) as string[],
  );

  if (labels.length > 0) {
    return {
      inspirationStatus: "provided" as const,
      inspirationReferences: labels.slice(0, 4),
    };
  }

  if (/\bno refs?\b|\bno references?\b|\bnone yet\b|\bnot sure yet\b|\bno moodboard\b/i.test(value)) {
    return {
      inspirationStatus: "unknown" as const,
      inspirationReferences: [],
    };
  }

  if (/\binspired by\b/i.test(value) || /\bvibe\b/i.test(value) || /\bmood\b/i.test(value)) {
    return {
      inspirationStatus: "requested" as const,
      inspirationReferences: [],
    };
  }

  return {
    inspirationStatus: null,
    inspirationReferences: [],
  };
}

function extractUserRole(value: string) {
  const match = value.match(
    /\bi(?:'m| am)\s+(?:an?\s+)?(organizer|producer|artist|creator|brand|venue owner|venue lead|fan)\b/i,
  );
  return match ? titleCase(match[1]) : null;
}

function extractUserIdentity(value: string) {
  const match =
    value.match(/\bi(?:'m| am)\s+([^.?!,]+)/i) ||
    value.match(/\bwe(?:'re| are)\s+([^.?!,]+)/i);
  return match ? trimSentence(match[1], 120) : null;
}

function extractOrganization(value: string) {
  const match =
    value.match(/\b(?:organization|company|brand)\s+(?:is|called)\s+([A-Z][\w& ]{2,40})/i) ||
    value.match(/\bfrom\s+([A-Z][\w& ]{2,40})\b/);
  return match ? trimSentence(match[1], 120) : null;
}

function extractAudience(value: string) {
  const match = value.match(/\bfor\s+([^.?!,]+?(?:fans?|community|audience|crowd))\b/i);
  return match ? trimSentence(match[1], 120) : null;
}

function extractTicketingModel(value: string) {
  if (/\bfree\b/i.test(value)) return "Free";
  if (/\bprivate\b/i.test(value)) return "Private";
  if (/\bticketed\b|\bpaid entry\b/i.test(value)) return "Ticketed";
  return null;
}

function extractSafetyFlags(value: string) {
  return uniqueStrings(
    [
      /\b21\+\b|\balcohol\b|\bbar\b/i.test(value) ? "Alcohol" : null,
      /\bpermit\b/i.test(value) ? "Permit" : null,
      /\ball-ages\b|\bunder 18\b|\bminors?\b/i.test(value) ? "Age-sensitive" : null,
      /\bsecurity\b|\bcrowd control\b/i.test(value) ? "Security" : null,
    ].filter(Boolean) as string[],
  );
}

function extractUrgency(value: string) {
  const match = value.match(/\b(asap|urgent|this week|next week|this month|next month)\b/i);
  return match ? titleCase(match[1]) : null;
}

function normalizeSourceMessages(messages: string[]) {
  return messages
    .map((message) => normalizeWhitespace(message))
    .filter(Boolean)
    .filter((message) => !PERSONA_STARTERS.has(message.toLowerCase()));
}

export function isOrganizerCorrectionPrompt(message: string) {
  return CORRECTION_PATTERNS.some((pattern) => pattern.test(message));
}

export function extractOrganizerIntakeFieldsFromMessages(messages: string[]) {
  const normalizedMessages = normalizeSourceMessages(messages);
  const transcript = normalizedMessages
    .filter((message) => !isOrganizerCorrectionPrompt(message))
    .join(" ");
  const source = transcript || normalizedMessages.join(" ");

  const budget = extractBudget(source);
  const inspiration = extractInspiration(source);

  return {
    projectIdea: extractProjectIdea(source),
    locationMarket: extractCity(source),
    timing: extractTiming(source),
    scopeFormat: extractScopeFormat(source),
    themeVibe: extractThemeVibe(source),
    expectedAttendance: extractAttendance(source),
    lineupStatus: extractLineupStatus(source),
    helpNeeded: extractHelpNeeded(source),
    budget: budget.budget,
    budgetStatus: budget.budgetStatus,
    inspirationStatus: inspiration.inspirationStatus,
    inspirationReferences: inspiration.inspirationReferences,
    userRole: extractUserRole(source),
    userIdentity: extractUserIdentity(source),
    organization: extractOrganization(source),
    socials: extractSocials(source),
    audience: extractAudience(source),
    ticketingModel: extractTicketingModel(source),
    safetyFlags: extractSafetyFlags(source),
    urgency: extractUrgency(source),
    desiredTalentRoles: extractDesiredTalentRoles(source),
  } satisfies OrganizerIntakeFields;
}

export function extractOrganizerIntakeFieldsFromPrefill(prefill: WebChatPrefill | null | undefined) {
  const safe = prefill || {};
  return {
    projectIdea: typeof safe.projectIdea === "string" ? safe.projectIdea : null,
    locationMarket: typeof safe.city === "string" ? safe.city : null,
    timing: typeof safe.date === "string" ? safe.date : null,
    scopeFormat:
      typeof safe.scopeFormat === "string"
        ? safe.scopeFormat
        : typeof safe.eventType === "string"
          ? safe.eventType
          : null,
    themeVibe:
      typeof safe.themeVibe === "string"
        ? safe.themeVibe
        : typeof safe.vibe === "string"
          ? safe.vibe
          : null,
    expectedAttendance:
      typeof safe.expectedAttendance === "string"
        ? safe.expectedAttendance
        : typeof safe.scale === "string"
          ? safe.scale
          : null,
    lineupStatus: typeof safe.lineupStatus === "string" ? safe.lineupStatus : null,
    helpNeeded: typeof safe.helpNeeded === "string" ? safe.helpNeeded : null,
    budget: typeof safe.budget === "string" ? safe.budget : null,
    budgetStatus:
      typeof safe.budgetStatus === "string" && (safe.budgetStatus === "known" || safe.budgetStatus === "unknown")
        ? safe.budgetStatus
        : typeof safe.budget === "string"
          ? "known"
          : null,
    inspirationStatus:
      typeof safe.inspirationStatus === "string" &&
      (safe.inspirationStatus === "provided" ||
        safe.inspirationStatus === "requested" ||
        safe.inspirationStatus === "unknown")
        ? safe.inspirationStatus
        : null,
    inspirationReferences:
      Array.isArray(safe.inspirationRefs) && safe.inspirationRefs.every((item) => typeof item === "string")
        ? safe.inspirationRefs
        : [],
    userRole: typeof safe.userRole === "string" ? safe.userRole : null,
    userIdentity: typeof safe.userIdentity === "string" ? safe.userIdentity : null,
    organization: typeof safe.organization === "string" ? safe.organization : null,
    socials:
      Array.isArray(safe.socials) && safe.socials.every((item) => typeof item === "string")
        ? safe.socials
        : [],
    audience: typeof safe.audience === "string" ? safe.audience : null,
    ticketingModel: typeof safe.ticketingModel === "string" ? safe.ticketingModel : null,
    safetyFlags:
      Array.isArray(safe.safetyFlags) && safe.safetyFlags.every((item) => typeof item === "string")
        ? safe.safetyFlags
        : [],
    urgency: typeof safe.urgency === "string" ? safe.urgency : null,
    desiredTalentRoles:
      Array.isArray(safe.desiredTalentRoles) &&
      safe.desiredTalentRoles.every((item) => typeof item === "string")
        ? safe.desiredTalentRoles
        : Array.isArray(safe.suggestedRoles) &&
            safe.suggestedRoles.every((item) => typeof item === "string")
          ? safe.suggestedRoles
          : [],
  } satisfies OrganizerIntakeFields;
}

function hasRequiredField(fields: OrganizerIntakeFields, key: OrganizerRequiredField) {
  if (key === "budget") {
    return Boolean(fields.budgetStatus || fields.budget);
  }
  if (key === "inspirationStatus") {
    return Boolean(fields.inspirationStatus);
  }
  const value = fields[key];
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function hasImportantField(fields: OrganizerIntakeFields, key: OrganizerImportantField) {
  const value = fields[key];
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function buildKnownFields(fields: OrganizerIntakeFields) {
  const known: OrganizerBriefReadiness["knownFields"] = {};

  for (const key of ORGANIZER_REQUIRED_FIELDS) {
    if (!hasRequiredField(fields, key)) {
      continue;
    }
    if (key === "budget") {
      known[key] = fields.budget || "Unknown";
      continue;
    }
    if (key === "inspirationStatus") {
      const detail =
        fields.inspirationStatus === "provided"
          ? fields.inspirationReferences.join(", ") || "Provided"
          : fields.inspirationStatus === "requested"
            ? "Requested — not yet provided"
            : "Unknown";
      known[key] = detail;
      continue;
    }
    const value = fields[key];
    known[key] = Array.isArray(value) ? value.join(", ") : value || "";
  }

  for (const key of ORGANIZER_IMPORTANT_FIELDS) {
    if (!hasImportantField(fields, key)) {
      continue;
    }
    const value = fields[key];
    known[key] = Array.isArray(value) ? value.join(", ") : value || "";
  }

  return known;
}

function formatMissingGroup(field: OrganizerRequiredField) {
  switch (field) {
    case "locationMarket":
      return "city or market";
    case "timing":
      return "target date or timing window";
    case "scopeFormat":
      return "format";
    case "themeVibe":
      return "theme or vibe";
    case "expectedAttendance":
      return "rough attendance";
    case "lineupStatus":
      return "venue status and any crew or partners already in place";
    case "helpNeeded":
      return "what you want Saga to help with";
    case "budget":
      return "budget range or tell me if it's still unknown";
    case "inspirationStatus":
      return "any inspiration links, boards, or references";
    default:
      return REQUIRED_FIELD_LABELS[field];
  }
}

export function formatOrganizerKnownSummary(readiness: OrganizerBriefReadiness) {
  const knownKeys = ORGANIZER_REQUIRED_FIELDS.filter((key) => key in readiness.knownFields);
  if (knownKeys.length === 0) {
    return "the seed idea";
  }

  const labels = knownKeys
    .slice(0, 5)
    .map((key) => REQUIRED_FIELD_LABELS[key]);
  return formatList(labels);
}

/**
 * Layer B reply composition (fallback mode).
 *
 * Reflects what Sagasan has captured using the user's own language instead
 * of category labels.
 *
 * Bad (the legacy summary): "I have project idea, location, timing, vibe."
 * Good (this function):    "formal ball inspired by Love and Deepspace,
 *                           LA, July, 150 people, romantic and elegant"
 *
 * Used by buildOrganizerProgressReply (host intake replies) and
 * buildOrganizerCorrectionReply (the "you're right" acknowledgment). When
 * LLM mode is on, the agent's prompt does this composition; this function
 * is the deterministic backstop.
 *
 * Design notes:
 * - Project idea leads — it's the strongest anchor and usually reads
 *   naturally as a noun phrase.
 * - Location, timing, attendance, vibe are interpolated as-is (the user's
 *   actual phrasing).
 * - Inspiration references are appended only when they aren't already
 *   inside the project-idea text (e.g. "ball inspired by Love and
 *   Deepspace" already names the reference — don't duplicate).
 * - Budget appears as a quick tail facet.
 * - Falls back to category labels for completeness if no field values
 *   are present (seed-idea stage where evaluation considers a field
 *   "known" via inference like inspirationStatus="provided" but no
 *   string value is set).
 */
export function formatOrganizerReflectiveSummary(
  fields: OrganizerIntakeFields,
  readiness: OrganizerBriefReadiness,
): string {
  const parts: string[] = [];

  const idea = fields.projectIdea?.trim();
  if (idea) {
    parts.push(idea);
  }

  const location = fields.locationMarket?.trim();
  if (location && (!idea || !idea.toLowerCase().includes(location.toLowerCase()))) {
    parts.push(location);
  }

  const timing = fields.timing?.trim();
  if (timing && (!idea || !idea.toLowerCase().includes(timing.toLowerCase()))) {
    parts.push(timing);
  }

  const attendance = fields.expectedAttendance?.trim();
  if (attendance) {
    parts.push(attendance);
  }

  const vibe = fields.themeVibe?.trim();
  if (vibe && (!idea || !idea.toLowerCase().includes(vibe.toLowerCase()))) {
    parts.push(vibe);
  }

  const refs = fields.inspirationReferences
    ?.map((r) => r.trim())
    .filter(
      (r) =>
        r &&
        (!idea ||
          !idea.toLowerCase().includes(r.toLowerCase())),
    )
    .slice(0, 2);
  if (refs && refs.length > 0) {
    parts.push(`inspired by ${refs.join(" and ")}`);
  }

  const budget = fields.budget?.trim();
  if (budget) {
    parts.push(`${budget} budget`);
  }

  if (parts.length === 0) {
    // No string values to reflect — fall back to category labels so the
    // reply still reads coherently. This is rare in practice (means the
    // brief is only "known" via boolean signals like inspirationStatus).
    return formatOrganizerKnownSummary(readiness);
  }

  return parts.slice(0, 6).join(", ");
}

export function formatOrganizerMissingSummary(readiness: OrganizerBriefReadiness) {
  return formatList(
    readiness.missingRequiredFields.map((field) => formatMissingGroup(field)).slice(0, 6),
  );
}

export function buildOrganizerNextBestQuestion(
  fields: OrganizerIntakeFields,
  readiness: Pick<OrganizerBriefReadiness, "stage" | "missingRequiredFields" | "knownFields">,
) {
  if (readiness.missingRequiredFields.length === 0) {
    return "You have enough signal for the next stage.";
  }

  const missingSummary = formatOrganizerMissingSummary({
    ...readiness,
    enoughInfoForDraftBrief: false,
    enoughInfoForProductionPlan: false,
    enoughInfoForTalentSearch: false,
    missingImportantFields: [],
    confidence: 0,
    nextBestQuestion: "",
    reason: "",
    essentialsAnswered: 0,
    essentialsTotal: ORGANIZER_REQUIRED_FIELDS.length,
  });

  if (readiness.stage === "seed_idea") {
    return `To make this useful, send whatever you know in one message: ${missingSummary}.`;
  }

  if (fields.helpNeeded && readiness.missingRequiredFields.includes("budget")) {
    return `I have the concept direction. To turn it into a real plan, send whatever you know about ${missingSummary}.`;
  }

  return `To make this useful, send whatever you know in one message: ${missingSummary}.`;
}

export function evaluateOrganizerBriefReadiness(fields: OrganizerIntakeFields): OrganizerBriefReadiness {
  const missingRequiredFields = ORGANIZER_REQUIRED_FIELDS.filter(
    (field) => !hasRequiredField(fields, field),
  );
  const missingImportantFields = ORGANIZER_IMPORTANT_FIELDS.filter(
    (field) => !hasImportantField(fields, field),
  );
  const essentialsAnswered =
    ORGANIZER_REQUIRED_FIELDS.length - missingRequiredFields.length;
  const confidence = essentialsAnswered / ORGANIZER_REQUIRED_FIELDS.length;
  const enoughInfoForDraftBrief = Boolean(
    fields.projectIdea &&
      fields.locationMarket &&
      fields.timing &&
      (fields.scopeFormat || fields.themeVibe) &&
      (fields.expectedAttendance || fields.lineupStatus),
  );
  const enoughInfoForProductionPlan = missingRequiredFields.length === 0;
  const enoughInfoForTalentSearch = Boolean(
    enoughInfoForProductionPlan &&
      (fields.desiredTalentRoles.length > 0 ||
        /crew|staff|producer|stylist|venue|performer|photographer|dj|host/i.test(
          fields.helpNeeded || "",
        )),
  );

  const stage: OrganizerReadinessStage = enoughInfoForTalentSearch
    ? "talent_search_ready"
    : enoughInfoForProductionPlan
      ? "production_plan_ready"
      : enoughInfoForDraftBrief
        ? "draft_brief_ready"
        : fields.projectIdea && essentialsAnswered <= 2
          ? "seed_idea"
          : "intake_in_progress";

  const knownFields = buildKnownFields(fields);
  const nextBestQuestion = buildOrganizerNextBestQuestion(fields, {
    stage,
    missingRequiredFields,
    knownFields,
  });
  const reason = enoughInfoForTalentSearch
    ? "Enough signal is in place for a clean brief, production plan, and talent search."
    : enoughInfoForProductionPlan
      ? "The brief is strong enough for a production plan, but talent search still needs explicit staffing intent."
      : enoughInfoForDraftBrief
        ? "There is enough signal to review a partial brief, but Saga still needs more production detail before planning or staffing."
        : "Sagasan still needs more high-signal context before it should advance this project.";

  return {
    stage,
    enoughInfoForDraftBrief,
    enoughInfoForProductionPlan,
    enoughInfoForTalentSearch,
    missingRequiredFields,
    missingImportantFields,
    knownFields,
    confidence,
    nextBestQuestion,
    reason,
    essentialsAnswered,
    essentialsTotal: ORGANIZER_REQUIRED_FIELDS.length,
  };
}

export function buildOrganizerCorrectionReply(fields: OrganizerIntakeFields, readiness: OrganizerBriefReadiness) {
  // Layer B: reflective summary first, falls back to category labels.
  // Keeps the "you're right" acknowledgment from sounding like a status
  // report ("I only have project idea, location, timing").
  const reflective = formatOrganizerReflectiveSummary(fields, readiness);
  return `You're right — I only have ${reflective}. To make this useful, I still need ${formatOrganizerMissingSummary(readiness)}. You can send all of that casually in one message.`;
}

export function buildOrganizerProgressLabel(readiness: OrganizerBriefReadiness) {
  return `Brief progress: ${readiness.essentialsAnswered} of ${readiness.essentialsTotal} essentials`;
}

export function organizerFieldLabel(field: OrganizerRequiredField | OrganizerImportantField) {
  if (field in REQUIRED_FIELD_LABELS) {
    return REQUIRED_FIELD_LABELS[field as OrganizerRequiredField];
  }
  return IMPORTANT_FIELD_LABELS[field as OrganizerImportantField];
}
