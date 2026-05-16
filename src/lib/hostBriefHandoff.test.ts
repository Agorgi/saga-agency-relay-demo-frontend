import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHostBriefDraft,
  buildHostBriefProject,
  encodeHostBriefPrefill,
  sanitizeHostBriefPrefill,
} from "@/lib/hostBriefHandoff";
import { decodePrefillPayload } from "@/lib/webChatNextStep";

const animePicnicPrefill = {
  eventType: "Pop-up / activation",
  city: "Silver Lake",
  scale: "100 people",
  vibe: "playful neon vibe",
  projectType: "Pop-up / activation",
  suggestedRoles: ["Producer", "Photographer", "Host", "Vendor", "Cosplayer"],
  date: "next month",
  projectIdea:
    "throw a 100-person anime picnic in Silver Lake next month with a playful neon vibe",
};

test("host brief handoff rebuilds the current project instead of the Miami beauty-brand seed", () => {
  const draft = buildHostBriefDraft(animePicnicPrefill);
  const project = buildHostBriefProject(animePicnicPrefill);

  assert.notEqual(project.title, "Beauty Brand Creator Content Day");
  assert.notEqual(project.city, "Miami");
  assert.equal(project.city, "Silver Lake");
  assert.equal(project.dateLabel, "next month");
  assert.match(project.title, /Anime Picnic/i);
  assert.match(project.description, /playful neon vibe/i);
  assert.deepEqual(
    draft.roles.slice(0, 3),
    ["Producer", "Photographer", "Host"],
  );
  assert.ok(project.requiredRoles.some((role) => role.name === "Photographer"));
});

test("host brief handoff keeps only safe prefill fields for the explorer flow", () => {
  const encoded = encodeHostBriefPrefill({
    ...animePicnicPrefill,
    helpNeeded: "Need a photographer and host.",
    unsafeField: "ignore me",
  });
  const decoded = decodePrefillPayload(encoded);
  const sanitized = sanitizeHostBriefPrefill(decoded);

  assert.equal(sanitized.city, "Silver Lake");
  assert.equal(sanitized.projectIdea, animePicnicPrefill.projectIdea);
  assert.equal(sanitized.helpNeeded, "Need a photographer and host.");
  assert.equal("unsafeField" in sanitized, false);
});
