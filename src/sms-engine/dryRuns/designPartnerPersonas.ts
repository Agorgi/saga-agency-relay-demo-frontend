import type {
  ConversationFlow,
  ConversationIntent,
} from "@/sms-engine/conversation/conversationTypes";

export type DesignPartnerPersonaType =
  | "organizer"
  | "gig_seeker"
  | "interest_check"
  | "contact_reply"
  | "edge_case";

export type DesignPartnerPersona = {
  id: string;
  name: string;
  type: DesignPartnerPersonaType;
  city: string | null;
  fandoms: string[];
  startingMessage: string;
  expectedIntent: ConversationIntent;
  expectedFlow: ConversationFlow;
  successCriteria: string[];
  riskNotes: string[];
};

export const designPartnerPersonas: DesignPartnerPersona[] = [
  {
    id: "organizer_anime_picnic_la",
    name: "Anime picnic organizer in LA",
    type: "organizer",
    city: "Los Angeles",
    fandoms: ["anime", "cosplay"],
    startingMessage: "hey im thinking of putting on a small anime picnic",
    expectedIntent: "ORGANIZER_PROJECT_IDEA",
    expectedFlow: "ORGANIZER_INTAKE",
    successCriteria: [
      "Classify as organizer intake.",
      "Ask one clear next question.",
      "Reach brief-ready after city, first-time-host, and scope are known.",
    ],
    riskNotes: ["No promises about attendance, venue, or confirmed team."],
  },
  {
    id: "organizer_cosplay_cafe_nyc",
    name: "Cosplay cafe-night organizer in NYC",
    type: "organizer",
    city: "New York City",
    fandoms: ["cosplay", "anime", "maid cafe"],
    startingMessage:
      "I want to throw a cosplay cafe night in NYC next month, cozy and polished for anime fans",
    expectedIntent: "ORGANIZER_PROJECT_IDEA",
    expectedFlow: "ORGANIZER_INTAKE",
    successCriteria: [
      "Capture city, concept, timing, and vibe.",
      "Ask first-time-host before brief-ready.",
      "Do not imply Saga can book a venue or staff.",
    ],
    riskNotes: ["Cafe formats may later require permits or venue review."],
  },
  {
    id: "organizer_gaming_popup_atlanta",
    name: "Gaming pop-up organizer in Atlanta",
    type: "organizer",
    city: "Atlanta",
    fandoms: ["gaming"],
    startingMessage:
      "For the gaming pop-up, budget is maybe 5k and I need vendors",
    expectedIntent: "ORGANIZER_PROJECT_IDEA",
    expectedFlow: "ORGANIZER_INTAKE",
    successCriteria: [
      "Accept out-of-order budget/team details.",
      "Continue asking for missing city and scope.",
      "Reach brief-ready only after required fields are present.",
    ],
    riskNotes: ["Budget notes are intake fields, not payment promises."],
  },
  {
    id: "organizer_creator_photoshoot_la",
    name: "Creator photoshoot organizer in LA",
    type: "organizer",
    city: "Los Angeles",
    fandoms: ["creator community", "cosplay"],
    startingMessage:
      "Can Saga recommend a team for a creator photoshoot in LA?",
    expectedIntent: "ORGANIZER_PROJECT_IDEA",
    expectedFlow: "ORGANIZER_INTAKE",
    successCriteria: [
      "Do not skip intake just because the user asks for team recommendations.",
      "Avoid promising a team or confirmed availability.",
      "Collect enough context before Producer Agent dry-run steps.",
    ],
    riskNotes: ["Team recommendations remain draft/admin-review only."],
  },
  {
    id: "creator_photographer_anime_gigs",
    name: "Photographer looking for anime/cosplay event gigs",
    type: "gig_seeker",
    city: "Los Angeles",
    fandoms: ["anime", "cosplay"],
    startingMessage: "I want gigs",
    expectedIntent: "GIG_SEEKER_ONBOARDING",
    expectedFlow: "GIG_SEEKER_ONBOARDING",
    successCriteria: [
      "Classify as creator onboarding.",
      "Ask for city, role, links, or fandoms as needed.",
      "Never promise gigs, bookings, or paid work.",
    ],
    riskNotes: ["Paid-work language must stay conditional and review-based."],
  },
  {
    id: "creator_cosplayer_paid_appearances",
    name: "Cosplayer looking for paid appearances / maid cafe gigs",
    type: "gig_seeker",
    city: "New York City",
    fandoms: ["cosplay", "maid cafe", "anime"],
    startingMessage:
      "I'm a cosplayer in NYC looking for maid cafe gigs, my IG is instagram.com/example",
    expectedIntent: "GIG_SEEKER_ONBOARDING",
    expectedFlow: "GIG_SEEKER_ONBOARDING",
    successCriteria: [
      "Capture city, role, link, and fandom signals.",
      "Ask a useful next question or mark ready for human profile review.",
      "Do not promise paid appearances.",
    ],
    riskNotes: ["Compensation preference is not a payment commitment."],
  },
  {
    id: "creator_illustrator_fandom_projects",
    name: "Illustrator / graphic designer looking for fandom projects",
    type: "gig_seeker",
    city: "Atlanta",
    fandoms: ["anime", "gaming", "K-pop"],
    startingMessage:
      "I'm an illustrator and graphic designer in Atlanta for anime and gaming projects",
    expectedIntent: "GIG_SEEKER_ONBOARDING",
    expectedFlow: "GIG_SEEKER_ONBOARDING",
    successCriteria: [
      "Capture creative roles and location.",
      "Ask for a portfolio/social link if missing.",
      "Profile-ready only when required evidence is present.",
    ],
    riskNotes: ["No automatic profile approval."],
  },
  {
    id: "interest_love_deepspace_picnic_la",
    name: "Fan who wants a Love and Deepspace picnic",
    type: "interest_check",
    city: "Los Angeles",
    fandoms: ["Love and Deepspace"],
    startingMessage:
      "I wish someone would host a Love and Deepspace picnic in LA",
    expectedIntent: "INTEREST_CHECK",
    expectedFlow: "INTEREST_CHECK",
    successCriteria: [
      "Favor interest-check because user wants someone else to host.",
      "Avoid promising the event will happen.",
      "Mark ready only as a reviewable interest-check concept.",
    ],
    riskNotes: ["No Project conversion."],
  },
  {
    id: "interest_one_piece_beach_day",
    name: "Fan who wants a One Piece beach day",
    type: "interest_check",
    city: "Los Angeles",
    fandoms: ["One Piece", "anime"],
    startingMessage: "Would people come to a One Piece beach day in LA?",
    expectedIntent: "INTEREST_CHECK",
    expectedFlow: "INTEREST_CHECK",
    successCriteria: [
      "Classify demand-testing language as interest-check.",
      "Handle organizer ambiguity if they might help.",
      "Do not promise attendance or demand.",
    ],
    riskNotes: ["Demand validation remains simulated/review-only."],
  },
  {
    id: "edge_contact_payment_consent",
    name: "Contact reply with consent ambiguity and payment question",
    type: "edge_case",
    city: "Los Angeles",
    fandoms: ["anime", "events"],
    startingMessage: "yes sounds good",
    expectedIntent: "CONTACT_REPLY",
    expectedFlow: "CONTACT_REPLY",
    successCriteria: [
      "Only classify YES with active outreach context.",
      "Consent must be explicit and context-specific.",
      "Payment/rate questions escalate to admin-safe handoff language.",
    ],
    riskNotes: [
      "No group chat is created.",
      "No rates, bookings, or placement promises.",
    ],
  },
];

export function getDesignPartnerPersona(id: string) {
  return designPartnerPersonas.find((persona) => persona.id === id) || null;
}
