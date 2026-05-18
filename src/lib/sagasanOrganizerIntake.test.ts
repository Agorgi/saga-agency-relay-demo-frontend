import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrganizerCorrectionReply,
  evaluateOrganizerBriefReadiness,
  extractOrganizerIntakeFieldsFromMessages,
  formatOrganizerKnownSummary,
  formatOrganizerReflectiveSummary,
} from "@/lib/sagasanOrganizerIntake";

test("organizer intake keeps asking for high-signal context after idea plus city", () => {
  const fields = extractOrganizerIntakeFieldsFromMessages([
    "I want to throw a formal ball inspired by Love and Deepspace in July",
    "LA",
    "don't you need more info?",
  ]);
  const readiness = evaluateOrganizerBriefReadiness(fields);
  const correctionReply = buildOrganizerCorrectionReply(fields, readiness);

  assert.equal(fields.projectIdea, "Formal ball inspired by Love and Deepspace");
  assert.equal(fields.locationMarket, "Los Angeles");
  assert.equal(fields.timing, "July");
  assert.match(fields.themeVibe || "", /romantic/i);
  assert.equal(fields.expectedAttendance, null);
  assert.equal(fields.lineupStatus, null);
  assert.equal(fields.helpNeeded, null);
  assert.equal(fields.budget, null);
  assert.equal(fields.inspirationStatus, "requested");
  assert.equal(readiness.enoughInfoForDraftBrief, false);
  assert.equal(readiness.enoughInfoForProductionPlan, false);
  assert.equal(readiness.enoughInfoForTalentSearch, false);
  assert.equal(readiness.stage, "intake_in_progress");
  assert.ok(readiness.missingRequiredFields.includes("expectedAttendance"));
  assert.ok(readiness.missingRequiredFields.includes("lineupStatus"));
  assert.ok(readiness.missingRequiredFields.includes("helpNeeded"));
  assert.ok(readiness.missingRequiredFields.includes("budget"));
  assert.match(correctionReply, /You're right/i);
  // Layer B: the reply reflects the user's actual project idea phrase
  // rather than the category label "project idea" / "concept".
  assert.match(correctionReply, /formal ball/i);
  assert.match(correctionReply, /Love and Deepspace/i);
  assert.match(correctionReply, /attendance|venue status|budget/i);
  // And it doesn't fall back to listing category names.
  assert.equal(
    /\bI only have project idea\b/i.test(correctionReply),
    false,
    "Layer B reply must not name the category 'project idea' instead of the actual phrase",
  );
  assert.equal(
    fields.projectIdea?.includes("don't you need more info"),
    false,
  );
});

test("organizer intake unlocks production plan and talent search only after high-signal context is present", () => {
  const fields = extractOrganizerIntakeFieldsFromMessages([
    "I want to throw a formal ball inspired by Love and Deepspace in LA in July. Probably 150 people. I don't have a venue yet. I have one photographer friend but no production crew. Budget is maybe $15k. Here's a Pinterest board / Instagram reference. I want Saga to help find a producer, stylist, venue lead, and maybe performers.",
  ]);
  const readiness = evaluateOrganizerBriefReadiness(fields);

  assert.equal(fields.projectIdea, "Formal ball inspired by Love and Deepspace");
  assert.equal(fields.locationMarket, "Los Angeles");
  assert.equal(fields.timing, "July");
  assert.equal(fields.expectedAttendance, "150 people");
  assert.match(fields.lineupStatus || "", /No venue yet/i);
  assert.match(fields.lineupStatus || "", /One photographer friend/i);
  assert.equal(fields.budget, "$15k");
  assert.equal(fields.budgetStatus, "known");
  assert.equal(fields.inspirationStatus, "provided");
  assert.ok(fields.inspirationReferences.length > 0);
  assert.match(fields.helpNeeded || "", /producer/i);
  assert.deepEqual(
    fields.desiredTalentRoles.slice(0, 4),
    ["Producer", "Stylist", "Venue Lead", "Performer"],
  );
  assert.equal(readiness.enoughInfoForDraftBrief, true);
  assert.equal(readiness.enoughInfoForProductionPlan, true);
  assert.equal(readiness.enoughInfoForTalentSearch, true);
  assert.equal(readiness.stage, "talent_search_ready");
  assert.deepEqual(readiness.missingRequiredFields, []);
});

test("idea, city, and timing alone do not unlock a production plan", () => {
  const fields = extractOrganizerIntakeFieldsFromMessages([
    "I want to throw an anime picnic in Silver Lake next month.",
  ]);
  const readiness = evaluateOrganizerBriefReadiness(fields);

  assert.equal(fields.projectIdea, "Anime Picnic");
  assert.equal(fields.locationMarket, "Silver Lake");
  assert.equal(fields.timing, "Next Month");
  assert.equal(readiness.enoughInfoForProductionPlan, false);
  assert.equal(readiness.enoughInfoForTalentSearch, false);
  assert.ok(readiness.missingRequiredFields.includes("expectedAttendance"));
  assert.ok(readiness.missingRequiredFields.includes("lineupStatus"));
  assert.ok(readiness.missingRequiredFields.includes("helpNeeded"));
  assert.ok(readiness.missingRequiredFields.includes("budget"));
});

test("Layer B reflective summary surfaces the user's actual phrasing, not category names", () => {
  // The Step 6 P0 scenario: rich brief, multiple captured fields. The
  // reflective summary should read "formal ball, LA, July, 150 people,
  // romantic/elegant…" rather than the legacy "project idea, location,
  // timing, attendance, vibe".
  const fields = extractOrganizerIntakeFieldsFromMessages([
    "I want to throw a formal ball inspired by Love and Deepspace in LA in July. Probably 150 people. Budget is $15k. Vibe is romantic, elegant, space-inspired.",
  ]);
  const readiness = evaluateOrganizerBriefReadiness(fields);
  const summary = formatOrganizerReflectiveSummary(fields, readiness);

  // Reflects the user's own words.
  assert.match(summary, /formal ball/i);
  assert.match(summary, /Love and Deepspace/i);
  assert.match(summary, /150 people/i);
  assert.match(summary, /\$15k/i);
  assert.match(summary, /romantic/i);

  // Doesn't fall back to category labels.
  assert.equal(/\bproject idea\b/i.test(summary), false);
  assert.equal(/\blocation\b/i.test(summary), false);
  assert.equal(/\bvibe\b/i.test(summary), false);
  assert.equal(/\battendance\b/i.test(summary), false);
});

test("Layer B reflective summary dedupes references already inside the project idea", () => {
  // When the project idea text already contains an inspiration reference
  // ("Formal ball inspired by Love and Deepspace"), the reflective summary
  // shouldn't append "inspired by Love and Deepspace" again as a separate
  // facet — that's awkward duplication.
  const fields = extractOrganizerIntakeFieldsFromMessages([
    "I want to throw a formal ball inspired by Love and Deepspace in July.",
  ]);
  const readiness = evaluateOrganizerBriefReadiness(fields);
  const summary = formatOrganizerReflectiveSummary(fields, readiness);

  // The phrase "Love and Deepspace" appears exactly once.
  const matches = summary.match(/Love and Deepspace/gi) || [];
  assert.equal(matches.length, 1);
});

test("Layer B reflective summary falls back to category labels when no string values exist", () => {
  // Defensive: if a brief is "known" only via boolean signals (e.g.
  // inspirationStatus="provided" but inspirationReferences is empty),
  // there's nothing to reflect. Fall back to the legacy summary so the
  // reply still reads coherently.
  const fields = extractOrganizerIntakeFieldsFromMessages([
    "Yeah, I have references I can share.",
  ]);
  const readiness = evaluateOrganizerBriefReadiness(fields);
  const summary = formatOrganizerReflectiveSummary(fields, readiness);

  // Either way the summary is non-empty (never produces a dangling
  // "Got it — . " reply).
  assert.ok(summary.length > 0);
});

test("OI-40: BRIEF PROGRESS counter and Known list reconcile when ≥ 6 essentials are answered", () => {
  // Regression: the prior `.slice(0, 5)` cap in formatOrganizerKnownSummary
  // capped the displayed Known list at 5 labels even when essentialsAnswered
  // climbed to 6 / 7 / 8 / 9. The counter and visible list disagreed.
  // After the fix, the count of labels in the Known summary equals
  // essentialsAnswered.
  const fields = extractOrganizerIntakeFieldsFromMessages([
    "I want to throw a formal ball inspired by Love and Deepspace in LA in July. Probably 150 people. I don't have a venue yet. I have one photographer friend but no production crew. Budget is maybe $15k. Here's a Pinterest board. I want Saga to help find a producer, stylist, venue lead, and maybe performers.",
  ]);
  const readiness = evaluateOrganizerBriefReadiness(fields);
  const summary = formatOrganizerKnownSummary(readiness);

  // This brief should answer all 9 essentials.
  assert.ok(
    readiness.essentialsAnswered >= 6,
    `expected ≥ 6 essentials answered, got ${readiness.essentialsAnswered}`,
  );
  // The Known summary is a comma-separated list. Count by splitting.
  const labels = summary.split(/,\s*|\s+and\s+/).filter(Boolean);
  assert.equal(
    labels.length,
    readiness.essentialsAnswered,
    `Known list has ${labels.length} labels but counter says ${readiness.essentialsAnswered} essentials answered. They must match.`,
  );
});
