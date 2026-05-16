"use client";

import { normalizePersona, type Persona } from "@/lib/sagasanPersonas";
import {
  sanitizeNextStepPayload,
  type WebChatNextStep,
} from "@/lib/webChatNextStep";

export const SAGASAN_TELEMETRY_STORAGE_KEY = "saga-sagasan-telemetry";
export const SAGASAN_TELEMETRY_EVENT = "saga:sagasan-telemetry";

export type SagasanTelemetryEventName =
  | "chat_opened"
  | "persona_chip_clicked"
  | "persona_inferred"
  | "persona_pivoted"
  | "sagasan_reply_generated"
  | "fallback_used"
  | "next_step_emitted"
  | "next_step_clicked"
  | "handoff_loaded"
  | "prefill_hydrated"
  | "validation_failed"
  | "reset_to_landing_clicked";

export type SagasanTelemetryEvent = {
  name: SagasanTelemetryEventName;
  at: string;
  persona: Persona | null;
  route: string | null;
  label: string | null;
  conversationId: string | null;
  fallbackReason: string | null;
  selectedReplySource: string | null;
  details: Record<string, string | number | boolean | string[]>;
};

const MAX_EVENTS = 120;

function safeText(value: unknown, maxLength = 120) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : null;
}

function safeDetails(
  details: Record<string, unknown> | null | undefined,
): Record<string, string | number | boolean | string[]> {
  if (!details) {
    return {};
  }

  const sanitized: Record<string, string | number | boolean | string[]> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string") {
      const cleaned = safeText(value, 180);
      if (cleaned) {
        sanitized[key] = cleaned;
      }
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      const cleaned = value
        .map((item) => safeText(item, 80))
        .filter((item): item is string => Boolean(item))
        .slice(0, 8);
      if (cleaned.length > 0) {
        sanitized[key] = cleaned;
      }
    }
  }

  return sanitized;
}

function normalizeRoute(value: unknown) {
  return safeText(value, 120);
}

function normalizeLabel(value: unknown) {
  return safeText(value, 60);
}

function readStoredEvents() {
  if (typeof window === "undefined") {
    return [] as SagasanTelemetryEvent[];
  }

  const raw = window.sessionStorage.getItem(SAGASAN_TELEMETRY_STORAGE_KEY);
  if (!raw) {
    return [] as SagasanTelemetryEvent[];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((event) => sanitizeSagasanTelemetryEvent(event))
      .filter((event): event is SagasanTelemetryEvent => Boolean(event));
  } catch {
    return [];
  }
}

function writeStoredEvents(events: SagasanTelemetryEvent[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    SAGASAN_TELEMETRY_STORAGE_KEY,
    JSON.stringify(events.slice(-MAX_EVENTS)),
  );
}

export function sanitizeSagasanTelemetryEvent(
  value: unknown,
): SagasanTelemetryEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const name = safeText(record.name, 64);
  const at = safeText(record.at, 64);

  if (!name || !at) {
    return null;
  }

  return {
    name: name as SagasanTelemetryEventName,
    at,
    persona:
      typeof record.persona === "string"
        ? normalizePersona(record.persona)
        : null,
    route: normalizeRoute(record.route),
    label: normalizeLabel(record.label),
    conversationId: safeText(record.conversationId, 80),
    fallbackReason: safeText(record.fallbackReason, 120),
    selectedReplySource: safeText(record.selectedReplySource, 80),
    details:
      record.details && typeof record.details === "object"
        ? safeDetails(record.details as Record<string, unknown>)
        : {},
  };
}

export function recordSagasanTelemetry(input: {
  name: SagasanTelemetryEventName;
  persona?: Persona | null;
  route?: string | null;
  label?: string | null;
  conversationId?: string | null;
  fallbackReason?: string | null;
  selectedReplySource?: string | null;
  nextStep?: WebChatNextStep | null;
  details?: Record<string, unknown>;
}) {
  if (typeof window === "undefined") {
    return;
  }

  const nextStep = sanitizeNextStepPayload(input.nextStep);
  const event: SagasanTelemetryEvent = {
    name: input.name,
    at: new Date().toISOString(),
    persona: normalizePersona(input.persona),
    route: nextStep?.route ?? normalizeRoute(input.route),
    label: nextStep?.label ?? normalizeLabel(input.label),
    conversationId: safeText(input.conversationId, 80),
    fallbackReason: safeText(input.fallbackReason, 120),
    selectedReplySource: safeText(input.selectedReplySource, 80),
    details: safeDetails({
      ...input.details,
      ...(nextStep
        ? {
            nextStepRoute: nextStep.route,
            prefillKeys: Object.keys(nextStep.prefill),
          }
        : null),
    }),
  };

  const nextEvents = [...readStoredEvents(), event].slice(-MAX_EVENTS);
  writeStoredEvents(nextEvents);
  window.dispatchEvent(
    new CustomEvent(SAGASAN_TELEMETRY_EVENT, {
      detail: event,
    }),
  );
}

export function readSagasanTelemetryEvents() {
  return readStoredEvents();
}

export function clearSagasanTelemetryEvents() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(SAGASAN_TELEMETRY_STORAGE_KEY);
}
