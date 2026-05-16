import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const requiredDocs = [
  "docs/sagasan-internal-dogfood-v3.md",
  "docs/sagasan-dogfood-test-script.md",
  "docs/sagasan-dogfood-feedback-form.md",
  "docs/sagasan-dogfood-scoring-rubric.md",
  "docs/sagasan-dogfood-issue-log-template.md",
  "docs/sagasan-dogfood-analytics-checklist.md",
  "docs/sagasan-internal-tester-instructions.md",
] as const;

function read(relativePath: string) {
  const absolutePath = path.join(repoRoot, relativePath);
  assert.ok(existsSync(absolutePath), `${relativePath} should exist`);
  return readFileSync(absolutePath, "utf8");
}

const scriptDoc = read("docs/sagasan-dogfood-test-script.md");
const rubricDoc = read("docs/sagasan-dogfood-scoring-rubric.md");
const feedbackDoc = read("docs/sagasan-dogfood-feedback-form.md");
const issueLogDoc = read("docs/sagasan-dogfood-issue-log-template.md");

for (const relativePath of requiredDocs) {
  const content = read(relativePath);
  assert.ok(content.trim().length > 0, `${relativePath} should not be empty`);

  assert.doesNotMatch(
    content,
    /\bsk-[A-Za-z0-9_-]{10,}\b|OPENAI_API_KEY\s*=|postgres(?:ql)?:\/\//i,
    `${relativePath} should not contain secrets`,
  );
  assert.doesNotMatch(
    content,
    /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/,
    `${relativePath} should not contain raw phone numbers`,
  );
  assert.doesNotMatch(
    content,
    /\bSMS Producer\b|\bTwilio\b/i,
    `${relativePath} should not reference SMS or SMS Producer surfaces`,
  );
}

for (const personaHeading of ["## Host", "## Creative", "## Venue", "## Fan"]) {
  assert.match(scriptDoc, new RegExp(personaHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

for (const prompt of [
  "I want to throw an anime picnic in Silver Lake next month.",
  "I'm a photographer in LA looking for anime event gigs.",
  "I run a small venue in Brooklyn.",
  "I want to find cool anime events near me.",
]) {
  assert.match(scriptDoc, new RegExp(prompt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.match(rubricDoc, /## Green/);
assert.match(rubricDoc, /## Yellow/);
assert.match(rubricDoc, /## Red/);
assert.match(feedbackDoc, /Tester name:/);
assert.match(feedbackDoc, /CTA shown:/);
assert.match(issueLogDoc, /Severity:/);
assert.match(issueLogDoc, /P0: blocks internal testing/);

console.log("Sagasan dogfood docs check passed.");
