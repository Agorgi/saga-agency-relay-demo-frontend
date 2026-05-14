import assert from "node:assert/strict";
import { checkProducerDraftSafety } from "@/lib/producer/outboundDrafts";
import {
  briefFieldExtractionSchema,
  candidateFitExplanationSchema,
  gigSeekerProfileExtractionSchema,
  interestCheckExtractionSchema,
  organizerReplyLanguageSchema,
  producerRoleMapRefinementSchema,
  shortlistOutreachDraftLanguageSchema,
} from "@/lib/llm/llmTypes";

function assertSafeText(text: string) {
  const safety = checkProducerDraftSafety({
    type: "ADMIN_MANUAL",
    body: text,
  });
  assert.equal(safety.passed, true, safety.errors.join("; "));
  assert.ok(text.length <= 320, "Expected concise SMS-friendly copy.");
}

function runSchemaFixtures() {
  const organizer = briefFieldExtractionSchema.parse({
    city: "Los Angeles",
    projectConcept: "anime picnic",
    scope: "small community meetup",
    vibe: "casual and friendly",
    timing: "next month",
    budget: "unknown",
    audience: "anime fans",
    rolesHelpNeeded: "photographer and host",
    confidence: 0.82,
    missingFields: [],
    safetyFlags: [],
    needsAdmin: false,
  });
  assert.equal(organizer.city, "Los Angeles");

  const messyOrganizer = briefFieldExtractionSchema.parse({
    projectConcept: "cosplay cafe night",
    confidence: 0.58,
    missingFields: ["city", "scope"],
    safetyFlags: [],
    needsAdmin: false,
  });
  assert.ok(messyOrganizer.missingFields.includes("city"));

  const gigSeeker = gigSeekerProfileExtractionSchema.parse({
    city: "New York",
    desiredRoles: ["photographer"],
    skills: ["portrait photography", "event coverage"],
    fandoms: ["anime", "K-pop"],
    socialLinks: ["https://instagram.com/example"],
    portfolioLinks: [],
    availability: "weekends",
    compensationPreference: "paid_or_collab",
    confidence: 0.8,
    missingFields: [],
    safetyFlags: [],
  });
  assert.equal(gigSeeker.compensationPreference, "paid_or_collab");

  const interestCheck = interestCheckExtractionSchema.parse({
    idea: "Love and Deepspace picnic",
    city: "LA",
    fandoms: ["Love and Deepspace"],
    audience: "fans who would attend but may not organize",
    format: "picnic",
    interestSignal: "wants someone else to host",
    ambiguityWithOrganizer: false,
    confidence: 0.84,
    missingFields: [],
    safetyFlags: [],
  });
  assert.equal(interestCheck.format, "picnic");

  const unsafe = briefFieldExtractionSchema.parse({
    projectConcept: "warehouse party with alcohol",
    confidence: 0.7,
    missingFields: ["permit plan"],
    safetyFlags: ["alcohol", "security", "permits"],
    needsAdmin: true,
  });
  assert.equal(unsafe.needsAdmin, true);

  const roleMap = producerRoleMapRefinementSchema.parse({
    requiredRoles: ["producer", "photographer", "host"],
    optionalRoles: ["DJ", "vendor coordinator"],
    whyEachRoleMatters: {
      producer: "Keeps the plan and handoffs clear.",
      photographer: "Captures the event for recap content.",
      host: "Sets tone and helps guests feel oriented.",
    },
    missingInfo: [],
    confidence: 0.82,
  });
  assert.ok(roleMap.requiredRoles.includes("producer"));

  const fit = candidateFitExplanationSchema.parse({
    roleFitSummary: "Strong photography background.",
    fandomFitSummary: "Works with anime and cosplay communities.",
    locationFitSummary: "Based in LA.",
    risks: ["Availability unknown"],
    organizerFacingSummary:
      "A potential photographer to consider based on local anime event work.",
    confidence: 0.78,
    privateNotesExcluded: true,
  });
  assert.equal(fit.privateNotesExcluded, true);

  const shortlist = shortlistOutreachDraftLanguageSchema.parse({
    body: "Here is a draft shortlist for consideration. These candidates are not confirmed yet.",
    forbiddenClaimsDetected: false,
    privateInfoDetected: false,
    adminReviewRequired: true,
    confidence: 0.86,
  });
  assertSafeText(shortlist.body);

  const reply = organizerReplyLanguageSchema.parse({
    replyText: "Great. What city should this happen in?",
    replyType: "ask_next_question",
    stage: "ASK_LOCATION",
    forbiddenClaimsDetected: false,
    shouldEscalate: false,
    confidence: 0.9,
  });
  assertSafeText(reply.replyText);
}

function runToneFixtures() {
  for (const text of [
    "Saga here. I can help turn this into a project brief. What city should this happen in?",
    "Amazing. What kinds of gigs are you looking for?",
    "I want to make sure we handle that carefully. I’m going to flag this for the Saga team before moving forward.",
  ]) {
    assertSafeText(text);
    assert.ok(!/\bguarantee|confirmed|booked|paid work\b/i.test(text));
  }
}

function main() {
  runSchemaFixtures();
  runToneFixtures();

  console.log(
    "LLM eval fixtures passed with structured schemas, safe tone, and deterministic fallback compatibility.",
  );
}

main();
