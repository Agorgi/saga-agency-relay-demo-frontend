import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrganizerCorrectionReply,
  evaluateOrganizerBriefReadiness,
  extractOrganizerIntakeFieldsFromMessages,
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
  assert.match(correctionReply, /concept|project idea/i);
  assert.match(correctionReply, /attendance|venue status|budget/i);
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
