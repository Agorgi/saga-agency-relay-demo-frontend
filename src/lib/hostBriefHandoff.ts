"use client";

import {
  buildBriefDraftFromHostPrefill,
  buildProjectFromDraft,
} from "@/data/sagaAgencyData";
import {
  decodePrefillPayload,
  encodePrefillPayload,
  sanitizePrefillForRoute,
  type WebChatPrefill,
} from "@/lib/webChatNextStep";

export const HOST_BRIEF_HANDOFF_KEY = "saga-host-brief-handoff";

export type HostBriefHandoff = {
  projectId: string;
  prefill: WebChatPrefill;
};

export function sanitizeHostBriefPrefill(prefill: WebChatPrefill | null | undefined) {
  return sanitizePrefillForRoute("/projects/new", prefill || {});
}

export function buildHostBriefDraft(prefill: WebChatPrefill | null | undefined) {
  const sanitized = sanitizeHostBriefPrefill(prefill);

  return buildBriefDraftFromHostPrefill({
    eventType:
      typeof sanitized.eventType === "string" ? sanitized.eventType : null,
    city: typeof sanitized.city === "string" ? sanitized.city : null,
    scale: typeof sanitized.scale === "string" ? sanitized.scale : null,
    vibe: typeof sanitized.vibe === "string" ? sanitized.vibe : null,
    date: typeof sanitized.date === "string" ? sanitized.date : null,
    helpNeeded:
      typeof sanitized.helpNeeded === "string" ? sanitized.helpNeeded : null,
    projectType:
      typeof sanitized.projectType === "string" ? sanitized.projectType : null,
    suggestedRoles:
      Array.isArray(sanitized.suggestedRoles) &&
      sanitized.suggestedRoles.every((item: unknown) => typeof item === "string")
        ? sanitized.suggestedRoles
        : null,
    projectIdea:
      typeof sanitized.projectIdea === "string" ? sanitized.projectIdea : null,
  });
}

export function buildHostBriefProject(prefill: WebChatPrefill | null | undefined) {
  return buildProjectFromDraft(buildHostBriefDraft(prefill));
}

export function encodeHostBriefPrefill(prefill: WebChatPrefill | null | undefined) {
  const sanitized = sanitizeHostBriefPrefill(prefill);
  return Object.keys(sanitized).length ? encodePrefillPayload(sanitized) : "";
}

export function readHostBriefHandoff(projectId?: string | null) {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(HOST_BRIEF_HANDOFF_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as HostBriefHandoff;
    const prefill = sanitizeHostBriefPrefill(parsed.prefill);
    if (!parsed.projectId || Object.keys(prefill).length === 0) {
      return null;
    }
    if (projectId && parsed.projectId !== projectId) {
      return null;
    }
    return {
      projectId: parsed.projectId,
      prefill,
    } satisfies HostBriefHandoff;
  } catch {
    return null;
  }
}

export function persistHostBriefHandoff(handoff: HostBriefHandoff | null | undefined) {
  if (typeof window === "undefined") {
    return;
  }

  if (!handoff) {
    window.sessionStorage.removeItem(HOST_BRIEF_HANDOFF_KEY);
    return;
  }

  const prefill = sanitizeHostBriefPrefill(handoff.prefill);
  if (!handoff.projectId || Object.keys(prefill).length === 0) {
    window.sessionStorage.removeItem(HOST_BRIEF_HANDOFF_KEY);
    return;
  }

  window.sessionStorage.setItem(
    HOST_BRIEF_HANDOFF_KEY,
    JSON.stringify({
      projectId: handoff.projectId,
      prefill,
    } satisfies HostBriefHandoff),
  );
}

export function clearHostBriefHandoff() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(HOST_BRIEF_HANDOFF_KEY);
}

export function resolveHostBriefPrefill({
  encodedPrefill,
  projectId,
}: {
  encodedPrefill?: string | null;
  projectId?: string | null;
}) {
  const fromQuery = sanitizeHostBriefPrefill(
    decodePrefillPayload(encodedPrefill || null),
  );
  if (Object.keys(fromQuery).length > 0) {
    return fromQuery;
  }

  return readHostBriefHandoff(projectId || null)?.prefill ?? null;
}
