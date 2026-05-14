import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { logAudit } from "@/sms-engine/audit";
import { getProviderMode, requestCorrelationId } from "@/sms-engine/safeLogging";

const internalHeader = "x-saga-internal-key";

function safeEqualSecret(received: string, expected: string) {
  const receivedHash = createHash("sha256").update(received).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(receivedHash, expectedHash);
}

export async function requireInternalApiKey(request: Request) {
  const expected = process.env.INTERNAL_API_KEY;
  const received = request.headers.get(internalHeader);
  const url = new URL(request.url);

  if (expected && received && safeEqualSecret(received, expected)) {
    await logAudit({
      actorType: "SYSTEM",
      action: "internal_api.authorized",
      entityType: "InternalAPI",
      entityId: url.pathname,
      metadata: {
        method: request.method,
        providerMode: getProviderMode(),
        requestId: requestCorrelationId(request),
        result: "authorized",
      },
    }).catch(() => undefined);
    return null;
  }

  await logAudit({
    actorType: "SYSTEM",
    action: "internal_api.unauthorized",
    entityType: "InternalAPI",
    entityId: url.pathname,
    metadata: {
      configured: Boolean(expected),
      headerPresent: Boolean(received),
      method: request.method,
      providerMode: getProviderMode(),
      requestId: requestCorrelationId(request),
      result: "unauthorized",
    },
  }).catch(() => undefined);

  return NextResponse.json(
    {
      ok: false,
      error: "Unauthorized internal API request.",
    },
    { status: 401 },
  );
}
