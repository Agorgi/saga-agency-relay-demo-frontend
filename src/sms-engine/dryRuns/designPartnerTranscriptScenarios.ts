import type {
  ConversationFlow,
  ConversationIntent,
  ConversationStage,
} from "@/sms-engine/conversation/conversationTypes";
import {
  designPartnerPersonas,
  type DesignPartnerPersona,
} from "@/sms-engine/dryRuns/designPartnerPersonas";

export type TranscriptExpectedSafetyOutcome =
  | "none"
  | "needs_admin"
  | "consent_declined"
  | "ambiguity_noted";

export type DesignPartnerTranscriptTurn = {
  userMessage: string;
  expectedIntent?: ConversationIntent;
  expectedFlow?: ConversationFlow;
  expectedStage: ConversationStage;
  expectedMissingRequiredFields?: string[];
  expectedNextQuestionIncludes?: string[];
  expectedSafetyOutcome?: TranscriptExpectedSafetyOutcome;
  enoughInfoForBrief?: boolean;
  enoughInfoForProfileReview?: boolean;
  enoughInfoForInterestCheck?: boolean;
  producerAgentShouldRun?: boolean;
};

export type DesignPartnerTranscriptScenario = {
  id: string;
  personaId: string;
  title: string;
  persona: DesignPartnerPersona;
  safetyCritical: boolean;
  requiresActiveOutreach?: boolean;
  description: string;
  turns: DesignPartnerTranscriptTurn[];
};

function persona(id: string) {
  const found = designPartnerPersonas.find((item) => item.id === id);
  if (!found) throw new Error(`Missing dry-run persona: ${id}`);
  return found;
}

export const designPartnerTranscriptScenarios: DesignPartnerTranscriptScenario[] = [
  {
    id: "organizer_sparse_opener",
    personaId: "organizer_anime_picnic_la",
    title: "Organizer sparse opener",
    persona: persona("organizer_anime_picnic_la"),
    safetyCritical: false,
    description:
      "Sparse organizer intake that should become brief-ready after first-time-host, city, and vibe are supplied.",
    turns: [
      {
        userMessage: "hey im thinking of putting on a small anime picnic",
        expectedIntent: "ORGANIZER_PROJECT_IDEA",
        expectedFlow: "ORGANIZER_INTAKE",
        expectedStage: "ASK_FIRST_TIME_HOST",
        expectedMissingRequiredFields: ["city"],
        expectedNextQuestionIncludes: ["hosted", "first"],
      },
      {
        userMessage: "first time",
        expectedStage: "ASK_LOCATION",
        expectedMissingRequiredFields: ["city"],
        expectedNextQuestionIncludes: ["city"],
      },
      {
        userMessage: "Los Angeles, probably Silver Lake",
        expectedStage: "BRIEF_READY",
        expectedMissingRequiredFields: [],
        enoughInfoForBrief: true,
        producerAgentShouldRun: true,
      },
      {
        userMessage: "casual picnic for anime fans, maybe 40 people",
        expectedStage: "BRIEF_READY",
        expectedMissingRequiredFields: [],
        enoughInfoForBrief: true,
        producerAgentShouldRun: true,
      },
    ],
  },
  {
    id: "organizer_complete_project_idea",
    personaId: "organizer_cosplay_cafe_nyc",
    title: "Organizer complete project idea",
    persona: persona("organizer_cosplay_cafe_nyc"),
    safetyCritical: false,
    description:
      "Organizer gives a fairly complete cafe-night idea, then answers first-time-host.",
    turns: [
      {
        userMessage:
          "I want to throw a cosplay cafe night in NYC next month, cozy and polished for anime fans",
        expectedIntent: "ORGANIZER_PROJECT_IDEA",
        expectedFlow: "ORGANIZER_INTAKE",
        expectedStage: "ASK_FIRST_TIME_HOST",
        expectedNextQuestionIncludes: ["hosted", "first"],
      },
      {
        userMessage: "I've hosted before",
        expectedStage: "BRIEF_READY",
        expectedMissingRequiredFields: [],
        enoughInfoForBrief: true,
        producerAgentShouldRun: true,
      },
    ],
  },
  {
    id: "organizer_out_of_order",
    personaId: "organizer_gaming_popup_atlanta",
    title: "Organizer answers out of order",
    persona: persona("organizer_gaming_popup_atlanta"),
    safetyCritical: false,
    description:
      "Organizer starts with budget/team details before providing city and first-time-host.",
    turns: [
      {
        userMessage:
          "For the gaming pop-up, budget is maybe 5k and I need vendors",
        expectedIntent: "ORGANIZER_PROJECT_IDEA",
        expectedFlow: "ORGANIZER_INTAKE",
        expectedStage: "ASK_FIRST_TIME_HOST",
        expectedNextQuestionIncludes: ["hosted", "first"],
      },
      {
        userMessage: "Atlanta",
        expectedStage: "ASK_SCOPE_VIBE",
        expectedNextQuestionIncludes: ["vibe"],
      },
      {
        userMessage: "first time",
        expectedStage: "ASK_SCOPE_VIBE",
        expectedNextQuestionIncludes: ["vibe"],
      },
      {
        userMessage: "community-led gaming pop-up for about 100 people",
        expectedStage: "BRIEF_READY",
        expectedMissingRequiredFields: [],
        enoughInfoForBrief: true,
        producerAgentShouldRun: true,
      },
    ],
  },
  {
    id: "organizer_team_recs_too_early",
    personaId: "organizer_creator_photoshoot_la",
    title: "Organizer asks for team recommendations too early",
    persona: persona("organizer_creator_photoshoot_la"),
    safetyCritical: false,
    description:
      "User asks for a team before enough brief info exists; Saga should keep intake moving without promising a team.",
    turns: [
      {
        userMessage: "Can Saga recommend a team for a creator photoshoot in LA?",
        expectedIntent: "ORGANIZER_PROJECT_IDEA",
        expectedFlow: "ORGANIZER_INTAKE",
        expectedStage: "ASK_FIRST_TIME_HOST",
        expectedNextQuestionIncludes: ["hosted", "first"],
      },
      {
        userMessage: "I haven't hosted before",
        expectedStage: "ASK_SCOPE_VIBE",
        expectedNextQuestionIncludes: ["vibe"],
      },
      {
        userMessage:
          "polished but lightweight, maybe 8 creators and a photographer",
        expectedStage: "BRIEF_READY",
        expectedMissingRequiredFields: [],
        enoughInfoForBrief: true,
        producerAgentShouldRun: true,
      },
    ],
  },
  {
    id: "gig_seeker_sparse",
    personaId: "creator_photographer_anime_gigs",
    title: "Gig-seeker sparse opener",
    persona: persona("creator_photographer_anime_gigs"),
    safetyCritical: false,
    description:
      "Sparse creator onboarding should ask for city before claiming profile readiness.",
    turns: [
      {
        userMessage: "I want gigs",
        expectedIntent: "GIG_SEEKER_ONBOARDING",
        expectedFlow: "GIG_SEEKER_ONBOARDING",
        expectedStage: "ASK_LOCATION",
        expectedMissingRequiredFields: ["city", "desiredRoles", "portfolioOrSelfDescription"],
        expectedNextQuestionIncludes: ["city"],
      },
      {
        userMessage: "Los Angeles",
        expectedStage: "ASK_GIG_TYPES",
        expectedMissingRequiredFields: ["desiredRoles", "portfolioOrSelfDescription"],
        expectedNextQuestionIncludes: ["gigs"],
      },
      {
        userMessage: "photography and cosplay event coverage",
        expectedStage: "ASK_LINKS",
        expectedMissingRequiredFields: ["portfolioOrSelfDescription"],
        expectedNextQuestionIncludes: ["Instagram", "portfolio"],
      },
    ],
  },
  {
    id: "gig_seeker_city_role_link",
    personaId: "creator_cosplayer_paid_appearances",
    title: "Gig-seeker with city, role, and social link",
    persona: persona("creator_cosplayer_paid_appearances"),
    safetyCritical: false,
    description:
      "Creator provides enough required profile data and fandom context in one turn.",
    turns: [
      {
        userMessage:
          "I'm a cosplayer in NYC looking for maid cafe gigs, my IG is instagram.com/example",
        expectedIntent: "GIG_SEEKER_ONBOARDING",
        expectedFlow: "GIG_SEEKER_ONBOARDING",
        expectedStage: "PROFILE_READY_FOR_REVIEW",
        expectedMissingRequiredFields: [],
        enoughInfoForProfileReview: true,
      },
    ],
  },
  {
    id: "gig_seeker_guaranteed_paid_work",
    personaId: "creator_illustrator_fandom_projects",
    title: "Gig-seeker asking for guaranteed paid work",
    persona: persona("creator_illustrator_fandom_projects"),
    safetyCritical: true,
    description:
      "Creator asks for guaranteed paid work; Saga should escalate instead of promising gigs.",
    turns: [
      {
        userMessage:
          "I'm an illustrator in Atlanta for anime projects - can Saga guarantee paid gigs?",
        expectedIntent: "SAFETY_ESCALATION",
        expectedFlow: "GIG_SEEKER_ONBOARDING",
        expectedStage: "NEEDS_ADMIN",
        expectedSafetyOutcome: "needs_admin",
      },
    ],
  },
  {
    id: "interest_love_deepspace",
    personaId: "interest_love_deepspace_picnic_la",
    title: "Interest check with city and fandom",
    persona: persona("interest_love_deepspace_picnic_la"),
    safetyCritical: false,
    description:
      "Fan wants something to exist but does not want to organize it.",
    turns: [
      {
        userMessage:
          "I wish someone would host a Love and Deepspace picnic in LA",
        expectedIntent: "INTEREST_CHECK",
        expectedFlow: "INTEREST_CHECK",
        expectedStage: "INTEREST_CHECK_READY",
        expectedMissingRequiredFields: [],
        enoughInfoForInterestCheck: true,
      },
    ],
  },
  {
    id: "interest_ambiguous_organizer",
    personaId: "interest_one_piece_beach_day",
    title: "Ambiguous organizer vs interest-check",
    persona: persona("interest_one_piece_beach_day"),
    safetyCritical: false,
    description:
      "User might organize if people are interested; ambiguity should be preserved without overcommitting.",
    turns: [
      {
        userMessage:
          "I might organize a One Piece beach day in LA if people are interested",
        expectedIntent: "INTEREST_CHECK",
        expectedFlow: "INTEREST_CHECK",
        expectedStage: "INTEREST_CHECK_READY",
        expectedMissingRequiredFields: [],
        expectedSafetyOutcome: "ambiguity_noted",
        enoughInfoForInterestCheck: true,
      },
    ],
  },
  {
    id: "contact_reply_consent_and_payment",
    personaId: "edge_contact_payment_consent",
    title: "Contact reply with consent ambiguity and payment question",
    persona: persona("edge_contact_payment_consent"),
    safetyCritical: true,
    requiresActiveOutreach: true,
    description:
      "Mock contact reply starts with YES, declines consent ambiguously, then asks a rate/payment question.",
    turns: [
      {
        userMessage: "yes sounds good",
        expectedIntent: "CONTACT_REPLY",
        expectedFlow: "CONTACT_REPLY",
        expectedStage: "INTERESTED",
        expectedNextQuestionIncludes: ["introduce", "group text"],
      },
      {
        userMessage: "just send me info first",
        expectedStage: "CONSENT_DECLINED",
        expectedSafetyOutcome: "consent_declined",
      },
      {
        userMessage: "also what is the rate?",
        expectedStage: "NEEDS_ADMIN",
        expectedSafetyOutcome: "needs_admin",
      },
    ],
  },
];

export function getDesignPartnerTranscriptScenario(id: string) {
  return designPartnerTranscriptScenarios.find((scenario) => scenario.id === id) || null;
}
