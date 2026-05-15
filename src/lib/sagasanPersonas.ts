export type Persona = "host" | "creative" | "venue" | "fan";

export const PERSONA_COOKIE_NAME = "saga_persona";
export const PERSONA_STORAGE_KEY = "saga-persona";
export const PERSONA_CHANGE_EVENT = "saga:persona-change";

export const PERSONA_OPTIONS: Array<{
  persona: Persona;
  label: string;
  firstTurn: string;
}> = [
  {
    persona: "host",
    label: "I want to host something",
    firstTurn: "I want to host something.",
  },
  {
    persona: "creative",
    label: "I'm a creative looking for work",
    firstTurn: "I'm a creative looking for work.",
  },
  {
    persona: "venue",
    label: "I run a space",
    firstTurn: "I run a space.",
  },
  {
    persona: "fan",
    label: "I'm here to find cool stuff",
    firstTurn: "I'm here to find cool stuff.",
  },
];

export function normalizePersona(value: string | null | undefined): Persona | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "host" ||
    normalized === "creative" ||
    normalized === "venue" ||
    normalized === "fan"
  ) {
    return normalized;
  }

  return null;
}

export function getDiscoverPath(persona: Persona | null) {
  if (persona === "fan") {
    return "/feed";
  }

  if (persona === "venue") {
    return "/spaces";
  }

  if (persona === "creative" || persona === "host") {
    return "/explore";
  }

  return null;
}

export function getPrimaryCta(persona: Persona | null) {
  if (persona === "host") {
    return { label: "Post a Project", href: "/post-project" };
  }

  if (persona === "creative") {
    return { label: "Add portfolio piece", href: "/me" };
  }

  if (persona === "venue") {
    return { label: "List a space", href: "/spaces" };
  }

  if (persona === "fan") {
    return { label: "Find something tonight", href: "/feed" };
  }

  return null;
}
