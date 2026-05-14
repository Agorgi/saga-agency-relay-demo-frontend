import { assessMessageSafety } from "@/sms-engine/safety";
import {
  projectUnderstandingSchema,
  type ProjectUnderstanding,
  type ProjectUnderstandingInput,
} from "@/sms-engine/producer/producerAgentTypes";

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function unique(items: Array<string | null | undefined>) {
  return [...new Set(items.filter((item): item is string => Boolean(item)))];
}

function textFromInput(input: ProjectUnderstandingInput) {
  return [
    input.text,
    input.projectBrief?.title,
    input.projectBrief?.projectType,
    input.projectBrief?.description,
    input.projectBrief?.scope,
    input.projectBrief?.vibe,
    input.projectBrief?.helpNeeded,
    input.project?.title,
    input.project?.description,
    ...(input.project?.fandoms || []),
    ...(input.recentMessages || []).map((message) => message.body),
    input.organizerContext,
  ]
    .filter(Boolean)
    .join(" ");
}

function inferCity(input: ProjectUnderstandingInput, text: string) {
  const direct = clean(input.projectBrief?.city) || clean(input.project?.city);
  if (direct) return direct;

  if (/\b(LA|Los Angeles|Silver Lake|Hollywood|Echo Park)\b/i.test(text)) {
    return /Silver Lake/i.test(text) ? "Silver Lake / Los Angeles" : "Los Angeles";
  }
  if (/\b(NYC|New York|Brooklyn|Queens|Manhattan)\b/i.test(text)) {
    return /Brooklyn/i.test(text) ? "Brooklyn / New York" : "New York";
  }
  if (/\bAtlanta\b/i.test(text)) return "Atlanta";
  if (/\bChicago\b/i.test(text)) return "Chicago";
  if (/\bSeattle\b/i.test(text)) return "Seattle";
  if (/\bAustin\b/i.test(text)) return "Austin";

  return (
    text.match(
      /\bin\s+([A-Z][A-Za-z .-]+?)(?:$|,|\.|\s+for|\s+with|\s+next|\s+this)/,
    )?.[1]?.trim() || null
  );
}

function inferFandoms(text: string, projectFandoms: string[] = []) {
  const lower = text.toLowerCase();
  const pairs = [
    ["anime", "anime"],
    ["cosplay", "cosplay"],
    ["gaming", "gaming"],
    ["game", "gaming"],
    ["k-pop", "K-pop"],
    ["kpop", "K-pop"],
    ["one piece", "One Piece"],
    ["jjk", "JJK"],
    ["jujutsu", "JJK"],
    ["love and deepspace", "Love and Deepspace"],
    ["horror", "horror"],
    ["comic", "comics"],
    ["maid cafe", "maid cafe"],
    ["creator", "creator community"],
  ];

  return unique([
    ...projectFandoms,
    ...pairs.filter(([needle]) => lower.includes(needle)).map(([, value]) => value),
  ]);
}

function inferFormat(text: string) {
  const formats = [
    "brand launch party",
    "launch party",
    "picnic",
    "cafe night",
    "maid cafe",
    "cupsleeve",
    "beach day",
    "pop-up",
    "market",
    "meetup",
    "photoshoot",
    "rave",
    "party",
    "screening",
    "workshop",
  ];
  const lower = text.toLowerCase();
  return formats.find((format) => lower.includes(format)) || null;
}

function inferProjectType(text: string, explicit?: string | null) {
  if (clean(explicit)) return clean(explicit);
  const format = inferFormat(text);
  if (format) return format;
  if (/\bevent|host|throw|produce|make|putting on\b/i.test(text)) return "event";
  if (/\bproject\b/i.test(text)) return "project";
  return null;
}

function inferSourceKind(text: string): ProjectUnderstanding["sourceKind"] {
  const lower = text.toLowerCase();
  if (
    /\b(i want gigs|looking for gigs|book me|join the network|i'm a photographer|i am a photographer|i'm a cosplayer|i am a cosplayer)\b/.test(
      lower,
    )
  ) {
    return "gig_seeker";
  }
  if (
    /\b(i wish someone|would people come|can saga (see|check) if|i'd go to|i dont want to host|i don't want to host|someone should)\b/.test(
      lower,
    )
  ) {
    return "interest_check";
  }
  if (
    /\b(i want to|i have .*idea|i'm thinking of|im thinking of|we want to|can you help me|throw|host|produce|make|put on|putting on)\b/.test(
      lower,
    )
  ) {
    return "organizer_project";
  }
  return "unknown";
}

function inferTitle(input: ProjectUnderstandingInput, text: string, format: string | null) {
  const direct = clean(input.projectBrief?.title) || clean(input.project?.title);
  if (direct) return direct;
  if (format) {
    const city = inferCity(input, text);
    return city ? `${format} in ${city}` : format;
  }
  const first = text.split(/[.!?]/)[0]?.trim();
  if (!first) return null;
  return first.length > 80 ? `${first.slice(0, 77).trimEnd()}...` : first;
}

function inferAudienceSize(input: ProjectUnderstandingInput, text: string) {
  const direct =
    clean(input.projectBrief?.expectedAudienceSize) || clean(input.project?.audience);
  if (direct) return direct;
  return (
    text.match(/\b(?:about|around|for|maybe)?\s*(\d{2,5})\s*(?:people|attendees|fans|guests)\b/i)?.[0] ||
    null
  );
}

function missingInfoFor(understanding: {
  title: string | null;
  city: string | null;
  scope: string | null;
  vibe: string | null;
  sourceKind: ProjectUnderstanding["sourceKind"];
}) {
  if (understanding.sourceKind !== "organizer_project") {
    return ["organizer project confirmation"];
  }

  const missing = [];
  if (!understanding.title) missing.push("project/event concept");
  if (!understanding.city) missing.push("city/location");
  if (!understanding.scope && !understanding.vibe) missing.push("scope/vibe");
  return missing;
}

export function buildProjectUnderstanding(
  input: ProjectUnderstandingInput,
): ProjectUnderstanding {
  const text = textFromInput(input);
  const safety = assessMessageSafety(text);
  const format = inferFormat(text);
  const sourceKind = inferSourceKind(text);
  const city = inferCity(input, text);
  const fandoms = inferFandoms(text, input.project?.fandoms || []);
  const scope = clean(input.projectBrief?.scope);
  const vibe = clean(input.projectBrief?.vibe);
  const title = inferTitle(input, text, format);
  const projectType = inferProjectType(text, input.projectBrief?.projectType);
  const missingInfo = missingInfoFor({ title, city, scope, vibe, sourceKind });
  const explanationForAudit = [
    title ? "Found a project concept/title." : "Project concept is still missing.",
    city ? "Found a city/location." : "City/location is still missing.",
    fandoms.length > 0
      ? `Detected fandom/community signals: ${fandoms.join(", ")}.`
      : "No strong fandom/community signal yet.",
    sourceKind === "organizer_project"
      ? "Message shape looks like an organizer/project-runner brief."
      : `Message shape classified as ${sourceKind}.`,
  ];

  const confidence =
    sourceKind === "organizer_project"
      ? Math.max(0.45, 0.86 - missingInfo.length * 0.12)
      : sourceKind === "unknown"
        ? 0.35
        : 0.72;

  return projectUnderstandingSchema.parse({
    title,
    projectType,
    city,
    fandoms,
    communities: fandoms,
    format,
    scope,
    vibe,
    targetDate: clean(input.projectBrief?.targetDate) || clean(input.project?.targetDate),
    timing: clean(input.projectBrief?.targetDate) || clean(input.project?.targetDate),
    budgetRange:
      clean(input.projectBrief?.budgetRange) || clean(input.project?.budgetRange),
    expectedAudienceSize: inferAudienceSize(input, text),
    audience: inferAudienceSize(input, text),
    helpNeeded:
      clean(input.projectBrief?.helpNeeded) ||
      (input.text && /\b(with|need|needs|looking for|vendors?|djs?|volunteers?)\b/i.test(input.text)
        ? input.text.trim()
        : null),
    riskFlags: safety.flags,
    missingInfo,
    sourceKind,
    confidence,
    explanationForAudit,
  });
}
