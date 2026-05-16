import { z } from "zod";
import type { Persona } from "@/lib/sagasanPersonas";

export const webChatRouteSchema = z.union([
  z.literal("/me"),
  z.literal("/spaces"),
  z.literal("/feed"),
  z.literal("/explore"),
  z.literal("/projects/new"),
  z.string().regex(/^\/projects\/[^/?#]+$/),
]);

export const webChatPrefillSchema = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
);

export const webChatNextStepSchema = z.object({
  label: z.string().trim().min(1).max(60),
  route: webChatRouteSchema,
  prefill: webChatPrefillSchema.default({}),
});

export type WebChatNextStep = z.infer<typeof webChatNextStepSchema>;
export type WebChatPrefill = z.infer<typeof webChatPrefillSchema>;
const MAX_PREFILL_BYTES = 1200;
export const WEB_CHAT_PENDING_NEXT_STEP_KEY = "saga-web-chat-pending-next-step";
export const WEB_CHAT_PENDING_NEXT_STEP_EVENT = "saga:web-chat-next-step";

const ALLOWED_PREFILL_KEYS: Record<string, string[]> = {
  "/projects/new": [
    "eventType",
    "city",
    "scale",
    "vibe",
    "themeVibe",
    "projectType",
    "suggestedRoles",
    "date",
    "helpNeeded",
    "projectIdea",
    "scopeFormat",
    "expectedAttendance",
    "lineupStatus",
    "budget",
    "budgetStatus",
    "inspirationStatus",
    "inspirationRefs",
    "readinessStage",
    "missingRequiredFields",
    "missingImportantFields",
    "userRole",
    "userIdentity",
    "organization",
    "socials",
    "audience",
    "ticketingModel",
    "safetyFlags",
    "urgency",
    "desiredTalentRoles",
  ],
  "/me": ["city", "roles", "portfolio", "availability", "rates"],
  "/spaces": ["city", "capacity", "neighborhood", "availabilityHint", "venueType"],
  "/feed": ["city", "interests"],
  "/explore": ["projectId", "role", "city"],
};

const PREFILL_PRIORITY_KEYS: Record<string, string[]> = {
  "/projects/new": [
    "projectIdea",
    "city",
    "date",
    "scopeFormat",
    "eventType",
    "projectType",
    "scale",
    "expectedAttendance",
    "themeVibe",
    "vibe",
    "lineupStatus",
    "helpNeeded",
    "budget",
    "budgetStatus",
    "inspirationStatus",
    "suggestedRoles",
    "desiredTalentRoles",
    "readinessStage",
    "missingRequiredFields",
    "inspirationRefs",
  ],
};

function toBase64Url(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const base64 = `${normalized}${padding}`;

  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(base64, "base64"));
  }

  const binary = window.atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodePrefillPayload(prefill: WebChatPrefill) {
  const serialized = JSON.stringify(prefill);
  return toBase64Url(new TextEncoder().encode(serialized));
}

export function decodePrefillPayload(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const decoded = new TextDecoder().decode(fromBase64Url(value));
    return webChatPrefillSchema.parse(JSON.parse(decoded));
  } catch {
    return null;
  }
}

export function buildNextStepHref(nextStep: WebChatNextStep) {
  const params = new URLSearchParams();
  const sanitizedPrefill = sanitizePrefillForRoute(nextStep.route, nextStep.prefill);
  const prefill =
    Object.keys(sanitizedPrefill).length > 0
      ? encodePrefillPayload(sanitizedPrefill)
      : "";

  if (prefill) {
    params.set("prefill", prefill);
  }

  return params.size ? `${nextStep.route}?${params.toString()}` : nextStep.route;
}

export function persistPendingNextStep(nextStep: WebChatNextStep | null | undefined) {
  if (typeof window === "undefined") {
    return;
  }

  const sanitized = sanitizeNextStepPayload(nextStep);
  if (!sanitized) {
    return;
  }

  window.sessionStorage.setItem(
    WEB_CHAT_PENDING_NEXT_STEP_KEY,
    JSON.stringify(sanitized),
  );
  window.dispatchEvent(
    new CustomEvent(WEB_CHAT_PENDING_NEXT_STEP_EVENT, {
      detail: { nextStep: sanitized },
    }),
  );
}

export function readPendingNextStep(route?: string | null) {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(WEB_CHAT_PENDING_NEXT_STEP_KEY);
  if (!raw) {
    return null;
  }

  try {
    const sanitized = sanitizeNextStepPayload(JSON.parse(raw));
    if (!sanitized) {
      return null;
    }
    if (route && sanitized.route !== route) {
      return null;
    }
    return sanitized;
  } catch {
    return null;
  }
}

export function clearPendingNextStep() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(WEB_CHAT_PENDING_NEXT_STEP_KEY);
  window.dispatchEvent(
    new CustomEvent(WEB_CHAT_PENDING_NEXT_STEP_EVENT, {
      detail: { nextStep: null },
    }),
  );
}

export function clampNextStepLabel(label: string | null | undefined) {
  const cleaned = (label || "").trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return "Continue";
  }

  const words = cleaned.split(" ");
  return words.length <= 5 ? cleaned : words.slice(0, 5).join(" ");
}

export function sanitizePrefillForRoute(
  route: string,
  prefill: WebChatPrefill | null | undefined,
) {
  const allowedKeys = ALLOWED_PREFILL_KEYS[route];
  if (!allowedKeys || !prefill) {
    return {};
  }

  const sanitizedEntries = Object.entries(prefill)
    .filter(([key]) => allowedKeys.includes(key))
    .map(([key, value]) => [
      key,
      Array.isArray(value)
        ? value
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 8)
        : value.trim().slice(0, 180),
    ])
    .filter(([, value]) =>
      Array.isArray(value) ? value.length > 0 : value.length > 0,
    );

  const sanitized = Object.fromEntries(sanitizedEntries);
  const encoded = encodePrefillPayload(sanitized);
  if (encoded.length > MAX_PREFILL_BYTES) {
    const priorityKeys = PREFILL_PRIORITY_KEYS[route];
    if (!priorityKeys) {
      return {};
    }

    const trimmed: WebChatPrefill = {};
    for (const key of priorityKeys) {
      if (!(key in sanitized)) {
        continue;
      }
      const candidate = {
        ...trimmed,
        [key]: sanitized[key],
      } satisfies WebChatPrefill;
      if (
        Object.keys(trimmed).length === 0 ||
        encodePrefillPayload(candidate).length <= MAX_PREFILL_BYTES
      ) {
        Object.assign(trimmed, { [key]: sanitized[key] });
      }
    }

    return trimmed;
  }

  return sanitized;
}

export function sanitizeNextStepPayload(value: unknown) {
  const parsed = webChatNextStepSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  const prefill = sanitizePrefillForRoute(parsed.data.route, parsed.data.prefill);
  return {
    label: clampNextStepLabel(parsed.data.label),
    route: parsed.data.route,
    prefill,
  } satisfies WebChatNextStep;
}

export function getPersonaFromNextStep(nextStep: WebChatNextStep | null | undefined): Persona | null {
  if (!nextStep) {
    return null;
  }

  if (nextStep.route === "/projects/new") {
    return "host";
  }

  if (nextStep.route === "/me") {
    return "creative";
  }

  if (nextStep.route === "/spaces") {
    return "venue";
  }

  if (nextStep.route === "/feed") {
    return "fan";
  }

  return null;
}
