import type { ProducerRole, ProjectUnderstanding, RoleMap } from "@/sms-engine/producer/producerAgentTypes";

export type MatchingEvalFixture = {
  id: string;
  projectType: string;
  title: string;
  requesterId: string;
  city: string | null;
  metro: string | null;
  fandoms: string[];
  communities: string[];
  format: string | null;
  scope: string | null;
  vibe: string | null;
  expectedTopCandidateTraits: string[];
  expectedDisallowedCandidates: string[];
  expectedSafetyBehavior: string[];
  expectedScoringEmphasis: string[];
  maxRolesToSource?: number;
  projectUnderstanding: ProjectUnderstanding;
  roleMap: RoleMap;
};

function role(input: {
  roleType: string;
  title?: string;
  priority?: "required" | "optional";
  skills?: string[];
  fandoms?: string[];
  localRequired?: boolean;
  description?: string;
}): ProducerRole {
  return {
    roleType: input.roleType,
    title: input.title || input.roleType,
    priority: input.priority || "required",
    description: input.description || `Evaluate candidates for ${input.roleType}.`,
    requiredSkills: input.skills || [input.roleType],
    preferredFandoms: input.fandoms || [],
    localRequired: Boolean(input.localRequired),
    whyThisRoleMatters: `${input.roleType} helps make the project operationally feasible.`,
    roleFitCriteria: [
      `${input.roleType} evidence`,
      "review status",
      "source quality",
      "safe admin review",
    ],
    missingInfoForRole: [],
    confidence: 0.85,
  };
}

function fixture(input: {
  id: string;
  title: string;
  projectType: string;
  requesterId: string;
  city: string | null;
  metro: string | null;
  fandoms: string[];
  communities?: string[];
  format?: string | null;
  scope?: string | null;
  vibe?: string | null;
  roles: ProducerRole[];
  optionalRoles?: ProducerRole[];
  expectedTopCandidateTraits: string[];
  expectedDisallowedCandidates: string[];
  expectedSafetyBehavior: string[];
  expectedScoringEmphasis: string[];
  maxRolesToSource?: number;
}): MatchingEvalFixture {
  const communities = input.communities || [];
  const projectUnderstanding: ProjectUnderstanding = {
    title: input.title,
    projectType: input.projectType,
    city: input.city,
    fandoms: input.fandoms,
    communities,
    format: input.format || null,
    scope: input.scope || null,
    vibe: input.vibe || null,
    targetDate: null,
    timing: null,
    budgetRange: null,
    expectedAudienceSize: null,
    audience: input.fandoms.join(", "),
    helpNeeded: input.roles.map((item) => item.roleType).join(", "),
    riskFlags: input.expectedSafetyBehavior.includes("safety_escalation_expected")
      ? ["safety_or_security"]
      : [],
    missingInfo: input.projectType === "interest_check" ? ["project_not_confirmed"] : [],
    sourceKind: input.projectType === "interest_check" ? "interest_check" : "organizer_project",
    confidence: input.projectType === "edge_safety" ? 0.45 : 0.86,
    explanationForAudit: [`Synthetic matching evaluation fixture ${input.id}.`],
  };
  const roleMap: RoleMap = {
    requiredRoles: input.roles,
    optionalRoles: input.optionalRoles || [],
    rolePriority: [...input.roles, ...(input.optionalRoles || [])].map((item) => item.roleType),
    roleDescriptions: Object.fromEntries(
      [...input.roles, ...(input.optionalRoles || [])].map((item) => [item.roleType, item.description]),
    ),
    roleFitCriteria: Object.fromEntries(
      [...input.roles, ...(input.optionalRoles || [])].map((item) => [
        item.roleType,
        item.roleFitCriteria,
      ]),
    ),
    localRequired: Object.fromEntries(
      [...input.roles, ...(input.optionalRoles || [])].map((item) => [
        item.roleType,
        item.localRequired,
      ]),
    ),
    whyThisRoleMatters: Object.fromEntries(
      [...input.roles, ...(input.optionalRoles || [])].map((item) => [
        item.roleType,
        item.whyThisRoleMatters,
      ]),
    ),
    missingInfoForRole: Object.fromEntries(
      [...input.roles, ...(input.optionalRoles || [])].map((item) => [
        item.roleType,
        item.missingInfoForRole,
      ]),
    ),
    confidence: 0.84,
    humanReviewRequired: true,
    explanationForAudit: [`Synthetic role map for ${input.id}.`],
  };
  return {
    ...input,
    communities,
    format: input.format || null,
    scope: input.scope || null,
    vibe: input.vibe || null,
    projectUnderstanding,
    roleMap,
  };
}

export const matchingEvalFixtures: MatchingEvalFixture[] = [
  fixture({
    id: "anime-picnic-la",
    title: "Anime picnic in Los Angeles / Silver Lake",
    projectType: "community_event",
    requesterId: "requester-la-anime",
    city: "Los Angeles",
    metro: "Los Angeles",
    fandoms: ["anime", "cosplay"],
    communities: ["artist alley"],
    format: "picnic",
    scope: "small community event",
    vibe: "warm, casual, community-led",
    roles: [
      role({ roleType: "photographer", title: "cosplay photographer", skills: ["photographer", "cosplay photographer"], fandoms: ["anime", "cosplay"] }),
      role({ roleType: "host", title: "community host", skills: ["host", "community host"], fandoms: ["anime"] }),
      role({ roleType: "production assistant", skills: ["production assistant"], localRequired: true }),
      role({ roleType: "volunteer coordinator", skills: ["volunteer coordinator"], localRequired: true }),
    ],
    expectedTopCandidateTraits: ["internal_reviewed", "la", "anime", "cosplay", "contactability_reviewed"],
    expectedDisallowedCandidates: ["candidate-opted-out", "candidate-do-not-contact"],
    expectedSafetyBehavior: ["normal_admin_review"],
    expectedScoringEmphasis: ["role_fit", "location", "fandom", "relationship"],
  }),
  fixture({
    id: "cosplay-cafe-nyc",
    title: "Cosplay cafe night in NYC",
    projectType: "community_event",
    requesterId: "requester-nyc-cosplay",
    city: "New York City",
    metro: "New York City",
    fandoms: ["anime", "cosplay"],
    communities: ["maid cafe"],
    format: "cafe night",
    scope: "small ticketless cafe activation",
    vibe: "cozy and theatrical",
    roles: [
      role({ roleType: "cosplayer", title: "guest cosplayers", skills: ["cosplayer", "host"], fandoms: ["anime", "cosplay"] }),
      role({ roleType: "host", skills: ["host", "community host"], fandoms: ["anime"] }),
      role({ roleType: "photographer", skills: ["photographer"], fandoms: ["cosplay"] }),
      role({ roleType: "venue owner", title: "venue/cafe partner", skills: ["venue owner"], localRequired: true }),
    ],
    expectedTopCandidateTraits: ["nyc", "cosplay", "venue_local_required"],
    expectedDisallowedCandidates: ["candidate-opted-out", "candidate-do-not-contact"],
    expectedSafetyBehavior: ["normal_admin_review"],
    expectedScoringEmphasis: ["role_fit", "location", "fandom"],
  }),
  fixture({
    id: "gaming-popup-atlanta",
    title: "Gaming pop-up in Atlanta",
    projectType: "community_event",
    requesterId: "requester-atl-gaming",
    city: "Atlanta",
    metro: "Atlanta",
    fandoms: ["gaming", "anime-adjacent gaming"],
    communities: ["local gaming"],
    format: "pop-up",
    scope: "weekend afternoon",
    vibe: "hands-on and friendly",
    roles: [
      role({ roleType: "photographer", title: "event photographer", skills: ["photographer"], localRequired: false }),
      role({ roleType: "vendor coordinator", skills: ["vendor coordinator"], localRequired: true }),
      role({ roleType: "host", title: "game demo host", skills: ["host", "game demo host"], fandoms: ["gaming"] }),
      role({ roleType: "production assistant", skills: ["production assistant"], localRequired: true }),
    ],
    expectedTopCandidateTraits: ["atlanta", "gaming", "internal_reviewed"],
    expectedDisallowedCandidates: ["candidate-opted-out", "candidate-do-not-contact"],
    expectedSafetyBehavior: ["normal_admin_review"],
    expectedScoringEmphasis: ["role_fit", "location", "contactability"],
  }),
  fixture({
    id: "maid-cafe-la",
    title: "Maid cafe gig in LA",
    projectType: "performance_event",
    requesterId: "requester-la-maid",
    city: "Los Angeles",
    metro: "Los Angeles",
    fandoms: ["anime", "maid cafe"],
    communities: ["cosplay", "performance"],
    format: "cafe performance",
    scope: "small paid-style rehearsal without payment claims",
    vibe: "playful and hosted",
    roles: [
      role({ roleType: "maid cafe performer", skills: ["maid cafe performer", "host"], fandoms: ["maid cafe", "anime"] }),
      role({ roleType: "host", skills: ["host"], fandoms: ["anime"] }),
      role({ roleType: "photographer", skills: ["photographer"], fandoms: ["cosplay"] }),
      role({ roleType: "production coordinator", skills: ["production coordinator"], localRequired: true }),
    ],
    expectedTopCandidateTraits: ["la", "maid_cafe", "reviewed", "relationship"],
    expectedDisallowedCandidates: ["candidate-opted-out", "candidate-do-not-contact"],
    expectedSafetyBehavior: ["no_paid_work_claims"],
    expectedScoringEmphasis: ["role_fit", "fandom", "review_trust"],
  }),
  fixture({
    id: "artist-alley-market-la",
    title: "Artist alley / fandom market in LA",
    projectType: "market",
    requesterId: "requester-la-artist-market",
    city: "Los Angeles",
    metro: "Los Angeles",
    fandoms: ["anime", "artist alley"],
    communities: ["convention vendor", "illustrator"],
    format: "market",
    scope: "small curated market",
    vibe: "creative and vendor-led",
    roles: [
      role({ roleType: "illustrator", skills: ["illustrator", "artist alley"], fandoms: ["anime"] }),
      role({ roleType: "vendor coordinator", skills: ["vendor coordinator"], localRequired: true }),
      role({ roleType: "photographer", skills: ["photographer"], fandoms: ["anime"] }),
      role({ roleType: "host", title: "community host", skills: ["host"], fandoms: ["artist alley"] }),
    ],
    expectedTopCandidateTraits: ["artist_alley", "illustrator", "la"],
    expectedDisallowedCandidates: ["candidate-opted-out", "candidate-do-not-contact"],
    expectedSafetyBehavior: ["normal_admin_review"],
    expectedScoringEmphasis: ["role_fit", "fandom", "location"],
  }),
  fixture({
    id: "anime-rave-la",
    title: "Anime rave in LA",
    projectType: "higher_risk_event",
    requesterId: "requester-la-rave",
    city: "Los Angeles",
    metro: "Los Angeles",
    fandoms: ["anime", "cosplay"],
    communities: ["music", "performance"],
    format: "rave",
    scope: "large, needs review",
    vibe: "nightlife",
    roles: [
      role({ roleType: "DJ", skills: ["DJ", "anime rave dj"], fandoms: ["anime"] }),
      role({ roleType: "photographer", skills: ["photographer"], fandoms: ["anime"] }),
      role({ roleType: "venue owner", title: "venue partner", skills: ["venue owner"], localRequired: true }),
      role({ roleType: "social content creator", skills: ["social content creator"], fandoms: ["anime"] }),
    ],
    expectedTopCandidateTraits: ["la", "dj", "venue_local_required"],
    expectedDisallowedCandidates: ["candidate-opted-out", "candidate-do-not-contact"],
    expectedSafetyBehavior: ["security_logistics_flag", "human_review_required"],
    expectedScoringEmphasis: ["role_fit", "location", "safety_review"],
  }),
  fixture({
    id: "cosplay-photoshoot-nyc",
    title: "Cosplay photoshoot in NYC",
    projectType: "photoshoot",
    requesterId: "requester-nyc-cosplay",
    city: "New York City",
    metro: "New York City",
    fandoms: ["anime", "cosplay"],
    communities: ["creator photoshoot"],
    format: "photoshoot",
    scope: "small production day",
    vibe: "styled and collaborative",
    roles: [
      role({ roleType: "photographer", skills: ["photographer", "cosplay photographer"], fandoms: ["cosplay"] }),
      role({ roleType: "cosplayer", skills: ["cosplayer"], fandoms: ["anime", "cosplay"] }),
      role({ roleType: "stylist", title: "stylist/MUA optional", priority: "optional", skills: ["stylist", "MUA"], localRequired: true }),
      role({ roleType: "production assistant", skills: ["production assistant"], localRequired: true }),
    ],
    expectedTopCandidateTraits: ["nyc", "cosplay", "photographer"],
    expectedDisallowedCandidates: ["candidate-opted-out", "candidate-do-not-contact"],
    expectedSafetyBehavior: ["normal_admin_review"],
    expectedScoringEmphasis: ["role_fit", "location", "fandom"],
  }),
  fixture({
    id: "brand-community-launch",
    title: "Brand/community launch party",
    projectType: "launch_party",
    requesterId: "requester-la-brand",
    city: "Los Angeles",
    metro: "Los Angeles",
    fandoms: ["creative community"],
    communities: ["brand", "content creator"],
    format: "launch party",
    scope: "small polished gathering",
    vibe: "polished but not corporate",
    roles: [
      role({ roleType: "host", skills: ["host"] }),
      role({ roleType: "photographer", skills: ["photographer"] }),
      role({ roleType: "social content creator", skills: ["social content creator"] }),
      role({ roleType: "DJ", skills: ["DJ"] }),
      role({ roleType: "venue owner", title: "venue", skills: ["venue owner"], localRequired: true }),
    ],
    expectedTopCandidateTraits: ["la", "content", "photographer", "venue"],
    expectedDisallowedCandidates: ["candidate-opted-out", "candidate-do-not-contact"],
    expectedSafetyBehavior: ["normal_admin_review"],
    expectedScoringEmphasis: ["role_fit", "location", "contactability"],
  }),
  fixture({
    id: "love-and-deepspace-interest-picnic",
    title: "Love and Deepspace interest-check picnic",
    projectType: "interest_check",
    requesterId: "requester-la-otome",
    city: "Los Angeles",
    metro: "Los Angeles",
    fandoms: ["Love and Deepspace"],
    communities: ["otome game", "anime-adjacent gaming"],
    format: "interest check",
    scope: "not yet a project",
    vibe: "gentle and speculative",
    roles: [
      role({ roleType: "host", title: "interest-check host", skills: ["host"], fandoms: ["Love and Deepspace"] }),
      role({ roleType: "photographer", priority: "optional", skills: ["photographer"], fandoms: ["anime"] }),
    ],
    expectedTopCandidateTraits: ["otome", "host", "do_not_over_source"],
    expectedDisallowedCandidates: ["candidate-opted-out", "candidate-do-not-contact"],
    expectedSafetyBehavior: ["interest_check_only", "do_not_over_source"],
    expectedScoringEmphasis: ["fandom", "review_trust"],
    maxRolesToSource: 2,
  }),
  fixture({
    id: "low-budget-casual-meetup",
    title: "Low-budget casual meetup",
    projectType: "casual_meetup",
    requesterId: "requester-la-casual",
    city: "Los Angeles",
    metro: "Los Angeles",
    fandoms: ["anime"],
    communities: ["community meetup"],
    format: "meetup",
    scope: "low budget",
    vibe: "casual",
    roles: [
      role({ roleType: "host", skills: ["host"], fandoms: ["anime"] }),
      role({ roleType: "photographer", priority: "optional", skills: ["photographer"], fandoms: ["anime"] }),
    ],
    expectedTopCandidateTraits: ["host", "local", "do_not_overstaff"],
    expectedDisallowedCandidates: ["candidate-opted-out", "candidate-do-not-contact"],
    expectedSafetyBehavior: ["do_not_over_source"],
    expectedScoringEmphasis: ["role_fit", "simplicity"],
    maxRolesToSource: 2,
  }),
  fixture({
    id: "remote-illustration-design",
    title: "Remote-friendly illustration/design need",
    projectType: "creative_support",
    requesterId: "requester-la-design",
    city: "Los Angeles",
    metro: "Los Angeles",
    fandoms: ["anime"],
    communities: ["artist alley"],
    format: "remote creative support",
    scope: "one-off design support",
    vibe: "visual polish",
    roles: [
      role({ roleType: "illustrator", skills: ["illustrator", "artist alley"], fandoms: ["anime"] }),
      role({ roleType: "graphic designer", skills: ["graphic designer", "designer"], fandoms: ["anime"] }),
    ],
    expectedTopCandidateTraits: ["remote_friendly", "portfolio", "illustrator"],
    expectedDisallowedCandidates: ["candidate-opted-out", "candidate-do-not-contact"],
    expectedSafetyBehavior: ["remote_ok"],
    expectedScoringEmphasis: ["role_fit", "evidence", "less_location_penalty"],
  }),
  fixture({
    id: "edge-safety-heavy-project",
    title: "Edge/safety-heavy project",
    projectType: "edge_safety",
    requesterId: "requester-la-safety",
    city: "Los Angeles",
    metro: "Los Angeles",
    fandoms: ["anime"],
    communities: ["youth community"],
    format: "night event",
    scope: "mentions minors, alcohol, security, permits",
    vibe: "safety-sensitive",
    roles: [
      role({ roleType: "production coordinator", skills: ["production coordinator"], localRequired: true }),
      role({ roleType: "venue owner", title: "venue partner", skills: ["venue owner"], localRequired: true }),
    ],
    expectedTopCandidateTraits: ["internal_reviewed", "local", "safety_review"],
    expectedDisallowedCandidates: ["candidate-opted-out", "candidate-do-not-contact"],
    expectedSafetyBehavior: ["safety_escalation_expected", "reduce_matching_confidence"],
    expectedScoringEmphasis: ["review_trust", "location", "safety_review"],
  }),
];
