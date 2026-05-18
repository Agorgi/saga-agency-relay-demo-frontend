import assert from "node:assert/strict";
import test from "node:test";
import {
  bindNextStepToProject,
  buildNextStepHref,
  clearPendingNextStep,
  decodePrefillPayload,
  getPersonaFromNextStep,
  persistPendingNextStep,
  readPendingNextStep,
  sanitizeNextStepPayload,
  type WebChatNextStep,
} from "@/lib/webChatNextStep";

function installWindowStorageMock() {
  const storage = new Map<string, string>();
  const mockWindow = {
    dispatchEvent: () => true,
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() {
        return storage.size;
      },
    } satisfies Storage,
  };

  Object.defineProperty(globalThis, "window", {
    value: mockWindow,
    configurable: true,
    writable: true,
  });

  return () => {
    Reflect.deleteProperty(globalThis, "window");
  };
}

test("invalid next-step routes are rejected", () => {
  const nextStep = sanitizeNextStepPayload({
    label: "Send me somewhere unsafe",
    route: "https://evil.example",
    prefill: {
      city: "Los Angeles",
    },
  });

  assert.equal(nextStep, null);
});

test("next-step labels are clamped to five words when no canonical label exists", () => {
  // For routes that have a canonical label (/me, /spaces, /feed,
  // /projects/new) the sanitizer forces the canonical value
  // verbatim and the clamp is moot. The bound /projects/<cuid>
  // form has no canonical label and falls through to the clamp,
  // which is what this test exercises.
  const nextStep = sanitizeNextStepPayload({
    label: "Open the full project review and outreach dashboard",
    route: "/projects/cm0abc123def456ghi789jkl",
    prefill: {},
  });

  assert.ok(nextStep);
  assert.equal(nextStep?.label.split(/\s+/).length, 5);
});

test("prefill payload keeps only allowed keys and routes correctly", () => {
  const nextStep = sanitizeNextStepPayload({
    label: "Review brief",
    route: "/projects/new",
    prefill: {
      city: "Los Angeles",
      eventType: "Pop-up / activation",
      scopeFormat: "Anime picnic",
      budget: "$15k",
      readinessStage: "draft_brief_ready",
      missingRequiredFields: ["budget"],
      secret: "should-not-pass",
      email: "private@example.com",
      suggestedRoles: ["Producer", "Photographer"],
    },
  });

  assert.ok(nextStep);
  const href = buildNextStepHref(nextStep!);
  const url = new URL(href, "https://demo.try-saga.com");
  const prefill = decodePrefillPayload(url.searchParams.get("prefill"));

  assert.equal(url.pathname, "/projects/new");
  assert.deepEqual(prefill, {
    city: "Los Angeles",
    eventType: "Pop-up / activation",
    scopeFormat: "Anime picnic",
    budget: "$15k",
    readinessStage: "draft_brief_ready",
    missingRequiredFields: ["budget"],
    suggestedRoles: ["Producer", "Photographer"],
  });
});

test("pending next-step handoff survives navigation state", () => {
  const teardown = installWindowStorageMock();

  try {
    persistPendingNextStep({
      label: "Build my event",
      route: "/projects/new",
      prefill: {
        city: "Los Angeles",
        eventType: "Pop-up / activation",
        date: "next month",
        projectIdea: "Anime pop-up",
      },
    });

    const nextStep = readPendingNextStep("/projects/new");
    assert.ok(nextStep);
    // The sanitizer forces the canonical label for /projects/new
    // ("Review brief"), so the "Build my event" the persist call
    // wrote gets normalized on read. The prefill payload is
    // unaffected — the brief data survives the round-trip.
    assert.equal(nextStep?.label, "Review brief");
    assert.equal(nextStep?.prefill.city, "Los Angeles");
    assert.equal(nextStep?.prefill.projectIdea, "Anime pop-up");

    clearPendingNextStep();
    assert.equal(readPendingNextStep("/projects/new"), null);
  } finally {
    teardown();
  }
});

test("bindNextStepToProject rewrites /projects/new to /projects/<id> when projectId is present", () => {
  const projectId = "cm0abc123def456ghi789jkl";
  const before: WebChatNextStep = {
    label: "Review brief",
    route: "/projects/new",
    prefill: { city: "Los Angeles", projectIdea: "Anime pop-up" },
  };
  const after = bindNextStepToProject(before, projectId);
  assert.equal(after?.route, `/projects/${projectId}`);
  assert.equal(after?.label, "Review brief");
  // Prefill is stripped — the brief review page reads from the DB,
  // not from URL params.
  assert.deepEqual(after?.prefill, {});
});

test("bindNextStepToProject is a no-op when projectId is null", () => {
  const before: WebChatNextStep = {
    label: "Review brief",
    route: "/projects/new",
    prefill: { city: "Los Angeles" },
  };
  const after = bindNextStepToProject(before, null);
  assert.equal(after, before);
});

test("bindNextStepToProject is a no-op when nextStep is null", () => {
  const after = bindNextStepToProject(null, "cm0abc123def456ghi789jkl");
  assert.equal(after, null);
});

test("bindNextStepToProject normalises undefined input to null", () => {
  // Helper's contract is WebChatNextStep | null (never undefined),
  // so route.ts can assign the result directly into assistantMeta.nextStep.
  const after = bindNextStepToProject(undefined, "cm0abc123def456ghi789jkl");
  assert.equal(after, null);
});

test("bindNextStepToProject is a no-op when route is not /projects/new", () => {
  const meStep: WebChatNextStep = {
    label: "Open my profile",
    route: "/me",
    prefill: { city: "Los Angeles" },
  };
  const exploreStep: WebChatNextStep = {
    label: "Browse talent",
    route: "/explore",
    prefill: { city: "Los Angeles" },
  };
  const meResult = bindNextStepToProject(meStep, "cm0xyz");
  const exploreResult = bindNextStepToProject(exploreStep, "cm0xyz");
  assert.ok(meResult);
  assert.ok(exploreResult);
  assert.equal(meResult?.route, "/me");
  assert.equal(exploreResult?.route, "/explore");
});

test("bindNextStepToProject is idempotent — already-bound routes pass through unchanged", () => {
  const already: WebChatNextStep = {
    label: "Review brief",
    route: "/projects/cm0abc123def456ghi789jkl",
    prefill: {},
  };
  const result = bindNextStepToProject(already, "cm0newproject");
  // Route is NOT /projects/new, so it doesn't get rewritten — even
  // if the caller passes a different projectId.
  assert.equal(result?.route, "/projects/cm0abc123def456ghi789jkl");
});

test("bindNextStepToProject output still validates against the next-step schema", () => {
  const before: WebChatNextStep = {
    label: "Review brief",
    route: "/projects/new",
    prefill: { city: "LA", projectIdea: "Anime pop-up" },
  };
  const after = bindNextStepToProject(before, "cm0abc123def456ghi789jkl");
  // The cuid form (string-matching-regex variant of the route union)
  // must round-trip through sanitizeNextStepPayload without being
  // rejected.
  const sanitized = sanitizeNextStepPayload(after);
  assert.ok(sanitized);
  assert.equal(sanitized?.route, "/projects/cm0abc123def456ghi789jkl");
});

test("getPersonaFromNextStep returns 'host' for the bound /projects/<id> route", () => {
  // Before this PR, getPersonaFromNextStep only recognised
  // /projects/new as a host route. /projects/<cuid> got null, which
  // broke top-nav persona chips after the rewrite. The check is
  // now prefix-based.
  const bound: WebChatNextStep = {
    label: "Review brief",
    route: "/projects/cm0abc123def456ghi789jkl",
    prefill: {},
  };
  assert.equal(getPersonaFromNextStep(bound), "host");

  // The original /projects/new still maps to host.
  const newStep: WebChatNextStep = {
    label: "Review brief",
    route: "/projects/new",
    prefill: {},
  };
  assert.equal(getPersonaFromNextStep(newStep), "host");
});

test("sanitizeNextStepPayload normalises label to the canonical per-route value", () => {
  // Closes the live-mode half of P2-OI-11 (Codex finding on PR #42).
  // The LLM may emit historical / hallucinated labels like
  // "Open my feed" → /me. The sanitizer must replace those with the
  // current canonical label so live mode can't drift back to the
  // mismatched CTA the fallback path was just fixed to avoid.
  const cases = [
    { input: "Open my feed", route: "/me", expected: "Open my profile" },
    { input: "List your space", route: "/spaces", expected: "List my space" },
    { input: "See your feed", route: "/feed", expected: "Open my feed" },
    { input: "Build my event", route: "/projects/new", expected: "Review brief" },
  ];

  for (const { input, route, expected } of cases) {
    const sanitized = sanitizeNextStepPayload({ label: input, route, prefill: {} });
    assert.ok(sanitized);
    assert.equal(sanitized?.route, route);
    assert.equal(sanitized?.label, expected);
  }
});

test("sanitizeNextStepPayload preserves model-supplied label for bound /projects/<cuid> routes", () => {
  // The /projects/<cuid> route is produced by bindNextStepToProject
  // after persistence and doesn't have a fixed canonical label —
  // its label comes from the upstream "Review brief" CTA carried
  // through the rewrite. The sanitizer should NOT force a label
  // here; clampNextStepLabel keeps the model-supplied (or
  // bind-supplied) value.
  const sanitized = sanitizeNextStepPayload({
    label: "Review brief",
    route: "/projects/cm0abc123def456ghi789jkl",
    prefill: {},
  });
  assert.ok(sanitized);
  assert.equal(sanitized?.label, "Review brief");
});

test("isProjectBoundRoute identifies /projects/<cuid> and rejects everything else", async () => {
  const { isProjectBoundRoute } = await import("@/lib/webChatNextStep");
  // Bound — cuid-shaped
  assert.equal(isProjectBoundRoute("/projects/cm0abc123def456ghi789jkl"), true);
  assert.equal(
    isProjectBoundRoute("/projects/cm0abc123def456ghi789jkl/crew"),
    true,
  );
  assert.equal(
    isProjectBoundRoute("/projects/cm0abc123def456ghi789jkl/outreach"),
    true,
  );
  // Not bound — pre-persistence intake form
  assert.equal(isProjectBoundRoute("/projects/new"), false);
  // Not bound — different surfaces
  assert.equal(isProjectBoundRoute("/me"), false);
  assert.equal(isProjectBoundRoute("/spaces"), false);
  assert.equal(isProjectBoundRoute("/feed"), false);
  assert.equal(isProjectBoundRoute(""), false);
  assert.equal(isProjectBoundRoute(null), false);
  assert.equal(isProjectBoundRoute(undefined), false);
  // Not bound — fixture slugs are kebab-case, not cuids
  assert.equal(isProjectBoundRoute("/projects/anime-picnic-silver-lake"), false);
});

test("conversationReferencesBoundProject scans the route field on messages", async () => {
  const { conversationReferencesBoundProject } = await import(
    "@/lib/webChatNextStep"
  );
  // Empty conversation
  assert.equal(conversationReferencesBoundProject([]), false);
  // No bound routes
  assert.equal(
    conversationReferencesBoundProject([
      { route: null },
      { route: "/projects/new" },
      { route: "/me" },
    ]),
    false,
  );
  // At least one bound route present
  assert.equal(
    conversationReferencesBoundProject([
      { route: null },
      { route: "/projects/cm0abc123def456ghi789jkl" },
    ]),
    true,
  );
});

test("conversationReferencesBoundProject scans nested nextStep.route too", async () => {
  // The chat route handler writes `route` AND a JSON `nextStep`
  // blob — sometimes `route` is null on early-turn messages but
  // the nextStep object carries the bound URL the user was about
  // to navigate to. The guard must catch both.
  const { conversationReferencesBoundProject } = await import(
    "@/lib/webChatNextStep"
  );
  assert.equal(
    conversationReferencesBoundProject([
      { route: null, nextStep: null },
      { route: null, nextStep: { route: "/me" } },
      { route: null, nextStep: { route: "/projects/cm0abc123def456ghi789jkl" } },
    ]),
    true,
  );
  // Defensive: malformed nextStep shapes don't blow up
  assert.equal(
    conversationReferencesBoundProject([
      { route: null, nextStep: "not-an-object" },
      { route: null, nextStep: { label: "missing route" } },
      { route: null, nextStep: { route: 123 } }, // wrong type
    ]),
    false,
  );
});
