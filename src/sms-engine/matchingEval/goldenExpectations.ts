export type MatchingGoldenExpectation = {
  fixtureId: string;
  expectedTopRoles: string[];
  candidatesWhoShouldRankHigh: string[];
  candidatesWhoShouldRankLow: string[];
  candidatesWhoMustBeExcluded: string[];
  candidatesWhoNeedReview: string[];
  expectedProximityTiers: Record<string, string>;
  expectedLocationWeighting: string[];
  expectedFandomWeighting: string[];
  expectedContactabilityTreatment: string[];
  expectedPublicWebTreatment: string[];
  expectedWarnings: string[];
};

const defaultExcluded = [
  "candidate-opted-out",
  "candidate-do-not-contact",
  "candidate-duplicate-public",
];

export const matchingGoldenExpectations: MatchingGoldenExpectation[] = [
  {
    fixtureId: "anime-picnic-la",
    expectedTopRoles: ["photographer", "host", "production assistant", "volunteer coordinator"],
    candidatesWhoShouldRankHigh: [
      "candidate-la-anime-photo-direct",
      "candidate-la-anime-photo-approved",
      "candidate-la-community-host",
      "candidate-la-production-assistant",
    ],
    candidatesWhoShouldRankLow: ["candidate-public-la-photo-unreviewed", "candidate-weak-evidence-photo"],
    candidatesWhoMustBeExcluded: defaultExcluded,
    candidatesWhoNeedReview: ["candidate-public-la-photo-reviewed", "candidate-public-la-photo-unreviewed"],
    expectedProximityTiers: {
      "candidate-la-anime-photo-direct": "P1_DIRECT",
      "candidate-la-community-host": "P3_SAME_PROJECT_OR_EVENT",
      "candidate-public-la-photo-reviewed": "P6_PUBLIC_WEB_ONLY",
    },
    expectedLocationWeighting: ["LA candidates should benefit for local roles."],
    expectedFandomWeighting: ["Anime/cosplay affinity should help but not imply mutuals."],
    expectedContactabilityTreatment: ["Contactability helps but is not permission."],
    expectedPublicWebTreatment: ["Unreviewed public-web photographer cannot outrank strong internal candidates."],
    expectedWarnings: [],
  },
  {
    fixtureId: "cosplay-cafe-nyc",
    expectedTopRoles: ["cosplayer", "host", "photographer", "venue owner"],
    candidatesWhoShouldRankHigh: [
      "candidate-nyc-cosplayer-direct",
      "candidate-nyc-cafe-venue",
      "candidate-nyc-cosplay-photo",
    ],
    candidatesWhoShouldRankLow: ["candidate-nyc-venue-owner"],
    candidatesWhoMustBeExcluded: defaultExcluded,
    candidatesWhoNeedReview: ["candidate-nyc-photographer-public-reviewed"],
    expectedProximityTiers: {
      "candidate-nyc-cosplayer-direct": "P1_DIRECT",
      "candidate-nyc-photographer-public-reviewed": "P6_PUBLIC_WEB_ONLY",
    },
    expectedLocationWeighting: ["NYC venue/cafe partner should outrank non-NYC venues."],
    expectedFandomWeighting: ["Cosplay and maid cafe tags should help."],
    expectedContactabilityTreatment: ["Venue contactability helps operations but is not permission."],
    expectedPublicWebTreatment: ["Reviewed public-web NYC photographer can rank but stays review-gated."],
    expectedWarnings: [],
  },
  {
    fixtureId: "gaming-popup-atlanta",
    expectedTopRoles: ["photographer", "vendor coordinator", "host", "production assistant"],
    candidatesWhoShouldRankHigh: [
      "candidate-atl-gaming-host",
      "candidate-atl-vendor-coordinator",
      "candidate-atl-photographer",
      "candidate-atl-production-assistant",
    ],
    candidatesWhoShouldRankLow: ["candidate-la-production-assistant"],
    candidatesWhoMustBeExcluded: defaultExcluded,
    candidatesWhoNeedReview: [],
    expectedProximityTiers: {},
    expectedLocationWeighting: ["Atlanta candidates should rank for local operations roles."],
    expectedFandomWeighting: ["Gaming tags should be role/fandom evidence."],
    expectedContactabilityTreatment: ["Contactability is operational readiness only."],
    expectedPublicWebTreatment: ["Internal Atlanta candidates should lead this fixture."],
    expectedWarnings: [],
  },
  {
    fixtureId: "maid-cafe-la",
    expectedTopRoles: ["maid cafe performer", "host", "photographer", "production coordinator"],
    candidatesWhoShouldRankHigh: [
      "candidate-la-maid-performer",
      "candidate-la-maid-host-mutual",
      "candidate-la-production-coordinator",
    ],
    candidatesWhoShouldRankLow: ["candidate-weak-evidence-photo"],
    candidatesWhoMustBeExcluded: defaultExcluded,
    candidatesWhoNeedReview: [],
    expectedProximityTiers: {
      "candidate-la-maid-host-mutual": "P2_MUTUAL",
    },
    expectedLocationWeighting: ["LA production coordinator should rank above non-local operations candidates."],
    expectedFandomWeighting: ["Maid cafe/anime tags should help."],
    expectedContactabilityTreatment: ["No paid-work or availability claims should appear."],
    expectedPublicWebTreatment: ["Internal reviewed performers should outrank similar public-web candidates."],
    expectedWarnings: ["no_paid_work_claims"],
  },
  {
    fixtureId: "artist-alley-market-la",
    expectedTopRoles: ["illustrator", "vendor coordinator", "photographer", "host"],
    candidatesWhoShouldRankHigh: [
      "candidate-la-artist-illustrator",
      "candidate-la-vendor-coordinator",
      "candidate-public-illustrator-reviewed",
    ],
    candidatesWhoShouldRankLow: ["candidate-public-ambiguous"],
    candidatesWhoMustBeExcluded: defaultExcluded,
    candidatesWhoNeedReview: ["candidate-public-illustrator-reviewed"],
    expectedProximityTiers: {},
    expectedLocationWeighting: ["Vendor coordination should prefer LA."],
    expectedFandomWeighting: ["Artist alley and anime tags should help."],
    expectedContactabilityTreatment: ["Reviewed contactability may help, never grant permission."],
    expectedPublicWebTreatment: ["Reviewed public illustrator can rank, unreviewed/ambiguous should lag."],
    expectedWarnings: [],
  },
  {
    fixtureId: "anime-rave-la",
    expectedTopRoles: ["DJ", "photographer", "venue owner", "social content creator"],
    candidatesWhoShouldRankHigh: [
      "candidate-la-dj-direct",
      "candidate-la-venue-owner",
      "candidate-la-content-creator",
      "candidate-la-social-creator-public-reviewed",
    ],
    candidatesWhoShouldRankLow: ["candidate-nyc-venue-owner"],
    candidatesWhoMustBeExcluded: defaultExcluded,
    candidatesWhoNeedReview: ["candidate-la-social-creator-public-reviewed"],
    expectedProximityTiers: {
      "candidate-la-dj-direct": "P1_DIRECT",
    },
    expectedLocationWeighting: ["LA venue partner should beat non-local venues."],
    expectedFandomWeighting: ["Anime/music signals should help DJ/content roles."],
    expectedContactabilityTreatment: ["Contactability is not permission."],
    expectedPublicWebTreatment: ["Reviewed public social creator can rank but remains review-only."],
    expectedWarnings: ["security_logistics_flag"],
  },
  {
    fixtureId: "cosplay-photoshoot-nyc",
    expectedTopRoles: ["photographer", "cosplayer", "stylist", "production assistant"],
    candidatesWhoShouldRankHigh: [
      "candidate-nyc-cosplay-photo",
      "candidate-nyc-cosplayer-direct",
      "candidate-nyc-stylist",
      "candidate-nyc-production-assistant",
    ],
    candidatesWhoShouldRankLow: ["candidate-la-stylist"],
    candidatesWhoMustBeExcluded: defaultExcluded,
    candidatesWhoNeedReview: ["candidate-nyc-photographer-public-reviewed"],
    expectedProximityTiers: {
      "candidate-nyc-cosplayer-direct": "P1_DIRECT",
      "candidate-nyc-photographer-public-reviewed": "P6_PUBLIC_WEB_ONLY",
    },
    expectedLocationWeighting: ["NYC photoshoot support should prefer NYC candidates."],
    expectedFandomWeighting: ["Cosplay tags should help."],
    expectedContactabilityTreatment: ["Contactability does not imply permission."],
    expectedPublicWebTreatment: ["Reviewed public NYC photographer can rank but should not auto-approve."],
    expectedWarnings: [],
  },
  {
    fixtureId: "brand-community-launch",
    expectedTopRoles: ["host", "photographer", "social content creator", "DJ", "venue owner"],
    candidatesWhoShouldRankHigh: [
      "candidate-la-brand-host",
      "candidate-la-content-creator",
      "candidate-la-dj-direct",
      "candidate-la-venue-owner",
    ],
    candidatesWhoShouldRankLow: ["candidate-public-ambiguous"],
    candidatesWhoMustBeExcluded: defaultExcluded,
    candidatesWhoNeedReview: ["candidate-la-social-creator-public-reviewed"],
    expectedProximityTiers: {},
    expectedLocationWeighting: ["Venue and launch support should prefer LA."],
    expectedFandomWeighting: ["Creative community tags help but should not be mutuals."],
    expectedContactabilityTreatment: ["Contactability only helps admin review readiness."],
    expectedPublicWebTreatment: ["Reviewed public social creator can rank behind internal reviewed candidates."],
    expectedWarnings: [],
  },
  {
    fixtureId: "love-and-deepspace-interest-picnic",
    expectedTopRoles: ["host", "photographer"],
    candidatesWhoShouldRankHigh: ["candidate-love-deepspace-host", "candidate-casual-host"],
    candidatesWhoShouldRankLow: ["candidate-la-dj-direct", "candidate-la-venue-owner"],
    candidatesWhoMustBeExcluded: defaultExcluded,
    candidatesWhoNeedReview: [],
    expectedProximityTiers: {},
    expectedLocationWeighting: ["Location matters less than fandom for interest-check host."],
    expectedFandomWeighting: ["Love and Deepspace alias/parent fandom should help."],
    expectedContactabilityTreatment: ["Contactability should not turn an interest check into outreach."],
    expectedPublicWebTreatment: ["Do not over-source public-web candidates for an interest check."],
    expectedWarnings: ["interest_check_only", "do_not_over_source"],
  },
  {
    fixtureId: "low-budget-casual-meetup",
    expectedTopRoles: ["host", "photographer"],
    candidatesWhoShouldRankHigh: ["candidate-casual-host", "candidate-la-community-host"],
    candidatesWhoShouldRankLow: ["candidate-la-dj-direct", "candidate-la-venue-owner"],
    candidatesWhoMustBeExcluded: defaultExcluded,
    candidatesWhoNeedReview: [],
    expectedProximityTiers: {},
    expectedLocationWeighting: ["Local simple host should rank."],
    expectedFandomWeighting: ["Anime community host should help."],
    expectedContactabilityTreatment: ["Contactability is not outreach permission."],
    expectedPublicWebTreatment: ["Do not over-source public-web results for casual meetup."],
    expectedWarnings: ["do_not_over_source"],
  },
  {
    fixtureId: "remote-illustration-design",
    expectedTopRoles: ["illustrator", "graphic designer"],
    candidatesWhoShouldRankHigh: [
      "candidate-remote-illustrator-approved",
      "candidate-sf-designer",
      "candidate-public-illustrator-reviewed",
    ],
    candidatesWhoShouldRankLow: ["candidate-la-venue-owner"],
    candidatesWhoMustBeExcluded: defaultExcluded,
    candidatesWhoNeedReview: ["candidate-public-illustrator-reviewed"],
    expectedProximityTiers: {
      "candidate-remote-illustrator-approved": "P1_DIRECT",
    },
    expectedLocationWeighting: ["Remote-friendly creative roles should not over-penalize non-local candidates."],
    expectedFandomWeighting: ["Anime/artist alley tags should help."],
    expectedContactabilityTreatment: ["Portfolio/contactability helps admin review, not permission."],
    expectedPublicWebTreatment: ["Reviewed public illustrator can rank if evidence is strong."],
    expectedWarnings: ["remote_ok"],
  },
  {
    fixtureId: "edge-safety-heavy-project",
    expectedTopRoles: ["production coordinator", "venue owner"],
    candidatesWhoShouldRankHigh: [
      "candidate-la-security-logistics",
      "candidate-la-production-coordinator",
      "candidate-la-venue-owner",
    ],
    candidatesWhoShouldRankLow: ["candidate-public-ambiguous", "candidate-nyc-venue-owner"],
    candidatesWhoMustBeExcluded: defaultExcluded,
    candidatesWhoNeedReview: [],
    expectedProximityTiers: {},
    expectedLocationWeighting: ["Local trusted operations candidates should rank."],
    expectedFandomWeighting: ["Fandom should not outweigh safety/review trust."],
    expectedContactabilityTreatment: ["Contactability should not imply permission during safety escalation."],
    expectedPublicWebTreatment: ["Public-web candidates should be heavily gated for safety-heavy projects."],
    expectedWarnings: ["safety_escalation_expected", "reduce_matching_confidence"],
  },
];

export function getGoldenExpectation(fixtureId: string) {
  const expectation = matchingGoldenExpectations.find((item) => item.fixtureId === fixtureId);
  if (!expectation) throw new Error(`missing_golden_expectation:${fixtureId}`);
  return expectation;
}
