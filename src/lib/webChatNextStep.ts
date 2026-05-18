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

// Canonical labels for the four persona destinations. Forced over
// whatever the LLM provides during sanitization so live mode can't
// drift back to mismatched copy (e.g. "Open my feed" pointing at
// /me, which is the creative's dashboard not a feed surface).
// Closes the live-mode side of P2-OI-11 that Codex flagged on PR #42.
//
// Why force vs trust the model: the model is reliable on the route
// shape but its label often mirrors training-data phrases that don't
// match our current copy. The destination is determined by the
// route; the label is descriptive of that destination. Keeping them
// in lockstep at the sanitization layer is cheaper than re-running
// prompt iterations every time we rename a button.
const CANONICAL_ROUTE_LABELS: Record<string, string> = {
  "/me": "Open my profile",
  "/spaces": "List my space",
  "/feed": "Open my feed",
  "/projects/new": "Review brief",
};

export function sanitizeNextStepPayload(value: unknown) {
  const parsed = webChatNextStepSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  const prefill = sanitizePrefillForRoute(parsed.data.route, parsed.data.prefill);
  const canonicalLabel = CANONICAL_ROUTE_LABELS[parsed.data.route];
  // Use the canonical label when one exists for this route. For
  // cuid-shaped /projects/<id> routes (set by bindNextStepToProject)
  // we fall back to clamping the model-supplied label since the
  // bound route doesn't have a static label baked in here.
  return {
    label: canonicalLabel || clampNextStepLabel(parsed.data.label),
    route: parsed.data.route,
    prefill,
  } satisfies WebChatNextStep;
}

export function getPersonaFromNextStep(nextStep: WebChatNextStep | null | undefined): Persona | null {
  if (!nextStep) {
    return null;
  }

  // /projects/<anything> is the host surface (intake → brief review →
  // crew → outreach). The cuid form is what bindNextStepToProject
  // rewrites the default /projects/new to once the brief persists.
  if (nextStep.route.startsWith("/projects/")) {
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

/**
 * Rewrite a chat nextStep so the user lands on a real Project page
 * after the brief persists.
 *
 * Sagasan composes replies with `nextStep.route = "/projects/new"` by
 * default — that's the right destination before persistence happens.
 * Once the web-chat API has called `upsertProjectFromBrief` and gotten
 * a real `projectId` back, this helper rewrites the route to
 * `/projects/<projectId>` so the "Review brief" CTA opens the
 * server-rendered brief view, not the form. Prefill is stripped:
 * `/projects/[id]` is a server-rendered surface that reads from the
 * Project row, not from URL params.
 *
 * No-op when:
 * - nextStep is null/undefined
 * - projectId is null
 * - the route is anything other than `/projects/new`
 *
 * Idempotent: passing a nextStep that's already on `/projects/<cuid>`
 * returns it unchanged.
 */
export function bindNextStepToProject(
  nextStep: WebChatNextStep | null | undefined,
  projectId: string | null,
): WebChatNextStep | null {
  if (!nextStep) {
    return null;
  }
  if (!projectId || nextStep.route !== "/projects/new") {
    return nextStep;
  }
  return {
    ...nextStep,
    route: `/projects/${projectId}`,
    prefill: {},
  };
}

/**
 * Project-id-shaped route pattern: `/projects/<cuid>` (NOT `/projects/new`
 * — that one is the pre-persistence intake-form route every Sagasan
 * reply emits before `upsertProjectFromBrief` lands the row).
 *
 * Used by the chat GET handler to detect whether a conversation was
 * "about a project" — i.e., did Sagasan ever route the user at a
 * bound project URL? If yes AND the session's `projectId` is now
 * null, the project must have been archived (PR #54) and the
 * conversation should not be restored.
 */
const PROJECT_BOUND_ROUTE_PATTERN = /^\/projects\/c[a-z0-9]{20,}(?:\/|$)/i;

export function isProjectBoundRoute(value: string | null | undefined): boolean {
  if (!value) return false;
  return PROJECT_BOUND_ROUTE_PATTERN.test(value);
}

/**
 * Return true if any message in the conversation has a `route` field
 * or a `nextStep.route` that points at a bound project URL
 * (`/projects/<cuid>` or any subpath like `/projects/<cuid>/crew`).
 *
 * The chat GET handler uses this in combination with
 * `session.projectId === null` to detect the "user archived their
 * project, then navigated to /chat directly without the ?fresh=1
 * flag" case. In that case the latest conversation references a
 * project the session can no longer reach, so the right behavior
 * is to render an empty chat rather than restore the discarded
 * brief's history.
 *
 * Defensive on shape: tolerates `nextStep` being null, a string,
 * or a partially-typed object. The schema is enforced elsewhere;
 * this helper just needs to find a project-bound route if one is
 * present.
 */
export function conversationReferencesBoundProject(
  messages: ReadonlyArray<{
    route?: string | null;
    nextStep?: unknown;
  }>,
): boolean {
  for (const message of messages) {
    if (isProjectBoundRoute(message.route ?? null)) return true;
    const nextStep = message.nextStep;
    if (nextStep && typeof nextStep === "object" && "route" in nextStep) {
      const route = (nextStep as { route?: unknown }).route;
      if (typeof route === "string" && isProjectBoundRoute(route)) return true;
    }
  }
  return false;
}
