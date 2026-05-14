import { scoreCreatorForOpportunity } from "@/sms-engine/networkMatching";

const now = new Date("2026-05-06T12:00:00.000Z");

const opportunity = {
  id: "opp_demo",
  roleOpeningId: "role_demo",
  visibility: "FRIENDS",
  applicationMode: "INVITE_AND_APPLY",
  status: "ACTIVE",
  createdAt: now,
  updatedAt: now,
  roleOpening: {
    id: "role_demo",
    projectId: "project_demo",
    roleType: "photographer",
    title: "Photographer",
    description: "Capture cosplay and event moments.",
    requiredSkills: ["photography", "content"],
    preferredFandoms: ["anime", "cosplay"],
    locationRequirement: "Los Angeles",
    remoteAllowed: false,
    compensationType: "PAID",
    budgetRange: "Demo TBD",
    quantityNeeded: 1,
    status: "OPEN",
    createdAt: now,
    updatedAt: now,
    project: {
      id: "project_demo",
      city: "Los Angeles",
      fandoms: ["anime", "cosplay"],
      organizerPersonId: "organizer",
    },
  },
} as Parameters<typeof scoreCreatorForOpportunity>[0]["opportunity"];

const profile = {
  id: "profile_maya",
  personId: "maya",
  displayName: "Maya",
  bio: null,
  city: "Los Angeles",
  roles: ["photographer"],
  skills: ["photography", "events", "content"],
  fandoms: ["anime", "cosplay"],
  communities: ["LA Cosplay Circle"],
  portfolioUrls: ["https://example.com/maya"],
  socialUrls: ["https://instagram.com/maya"],
  availabilityNotes: null,
  rateNotes: null,
  preferredOpportunityTypes: ["paid"],
  reviewStatus: "APPROVED",
  internalNotes: null,
  createdAt: now,
  updatedAt: now,
  person: {
    id: "maya",
    sagaUserId: null,
    phone: "+14155550111",
    email: null,
    name: "Maya",
    city: "Los Angeles",
    state: null,
    country: null,
    source: "IMPORT",
    optedOut: false,
    consentStatus: "IMPLIED",
    createdAt: now,
    updatedAt: now,
  },
} as Parameters<typeof scoreCreatorForOpportunity>[0]["profile"];

const result = scoreCreatorForOpportunity({
  opportunity,
  profile,
  relationshipEdges: [
    {
      id: "edge",
      fromPersonId: "organizer",
      toPersonId: "maya",
      relationshipType: "FRIEND",
      strength: 1,
      metadata: null,
      createdAt: now,
    },
  ],
});

console.log(JSON.stringify(result, null, 2));

if (result.score < 25 || result.proximityTier !== "FRIEND") {
  throw new Error("Matching score did not include proximity, role, city, and fandom fit.");
}
