import { z } from "zod";

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
  const prefill = encodePrefillPayload(nextStep.prefill);

  if (prefill) {
    params.set("prefill", prefill);
  }

  return params.size ? `${nextStep.route}?${params.toString()}` : nextStep.route;
}

export function clampNextStepLabel(label: string | null | undefined) {
  const cleaned = (label || "").trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return "Continue";
  }

  const words = cleaned.split(" ");
  return words.length <= 5 ? cleaned : words.slice(0, 5).join(" ");
}
