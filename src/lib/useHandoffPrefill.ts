"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  decodePrefillPayload,
  readPendingNextStep,
  type WebChatPrefill,
} from "@/lib/webChatNextStep";
import { recordSagasanTelemetry } from "@/lib/sagasanTelemetry";

export function resolveHandoffPrefill({
  encodedPrefill,
  route,
}: {
  encodedPrefill: string | null;
  route: string;
}) {
  const decoded = decodePrefillPayload(encodedPrefill);
  if (decoded) {
    return decoded;
  }

  return readPendingNextStep(route)?.prefill ?? null;
}

export function useHandoffPrefill({
  encodedPrefill,
  route,
}: {
  encodedPrefill: string | null;
  route: string;
}) {
  const hasLoggedRef = useRef(false);
  const prefill = useMemo(
    () => resolveHandoffPrefill({ encodedPrefill, route }),
    [encodedPrefill, route],
  );

  useEffect(() => {
    if (hasLoggedRef.current) {
      return;
    }

    const pendingNextStep = readPendingNextStep(route);
    if (pendingNextStep) {
      recordSagasanTelemetry({
        name: "handoff_loaded",
        nextStep: pendingNextStep,
        details: {
          source: encodedPrefill ? "query_prefill" : "pending_next_step",
        },
      });
    }

    if (prefill) {
      recordSagasanTelemetry({
        name: "prefill_hydrated",
        route,
        details: {
          prefillKeys: Object.keys(prefill),
          source: encodedPrefill ? "query_prefill" : "pending_next_step",
        },
      });
    }

    hasLoggedRef.current = true;
  }, [encodedPrefill, prefill, route]);

  return prefill as WebChatPrefill | null;
}
