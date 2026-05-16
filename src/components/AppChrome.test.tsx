import assert from "node:assert/strict";
import test from "node:test";
import { resolveChromePersona } from "@/components/AppChrome";
import { getPrimaryCta } from "@/lib/sagasanPersonas";

test("creative pending handoff overrides stale host persona in the app chrome", () => {
  const persona = resolveChromePersona({
    persona: "host",
    pendingNextStep: {
      label: "Open my feed",
      route: "/me",
      prefill: {
        city: "Los Angeles",
        roles: ["Photographer"],
      },
    },
    pathname: "/",
  });

  assert.equal(persona, "creative");
});

test("landing hides stale persona CTA when no handoff is active", () => {
  const persona = resolveChromePersona({
    persona: "host",
    pendingNextStep: null,
    pathname: "/",
  });

  assert.equal(persona, null);
});

test("non-landing routes still use the stored persona when no handoff is active", () => {
  const persona = resolveChromePersona({
    persona: "venue",
    pendingNextStep: null,
    pathname: "/spaces",
  });

  assert.equal(persona, "venue");
});

test("creative handoff maps to the creative chrome CTA", () => {
  const persona = resolveChromePersona({
    persona: "host",
    pendingNextStep: {
      label: "Open my feed",
      route: "/me",
      prefill: {
        city: "Los Angeles",
        roles: ["Photographer"],
      },
    },
    pathname: "/",
  });

  assert.equal(getPrimaryCta(persona)?.label, "Add portfolio piece");
});

test("fan handoff maps to the fan chrome CTA", () => {
  const persona = resolveChromePersona({
    persona: "host",
    pendingNextStep: {
      label: "See events",
      route: "/feed",
      prefill: {
        city: "Brooklyn",
        interests: ["Anime"],
      },
    },
    pathname: "/",
  });

  assert.equal(getPrimaryCta(persona)?.label, "Find something tonight");
});
