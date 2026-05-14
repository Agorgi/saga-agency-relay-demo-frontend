import type {
  BetaCohortSimulationType,
  SimulatedCohortMember,
} from "@/lib/cohortSimulation/cohortTypes";

type PartialMember = Omit<
  SimulatedCohortMember,
  "city" | "fandoms" | "cohort" | "shouldCreateFeedback"
> &
  Partial<
    Pick<
      SimulatedCohortMember,
      "city" | "fandoms" | "cohort" | "shouldCreateFeedback"
    >
  >;

function member(input: PartialMember): SimulatedCohortMember {
  return {
    city: input.city || "Los Angeles",
    fandoms: input.fandoms || ["anime", "cosplay"],
    cohort: input.cohort || "design_partner",
    shouldCreateFeedback: input.shouldCreateFeedback ?? true,
    ...input,
  };
}

export function generateDesignPartnerCohort10(): SimulatedCohortMember[] {
  return [
    member({
      id: "dp10_organizer_01",
      personaType: "organizer",
      city: "Los Angeles",
      fandoms: ["anime", "picnic"],
      expectedFlow: "ORGANIZER_INTAKE",
      startingMessage:
        "I want to host an anime picnic in LA for about 40 people next month.",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "REPLY_PLANNED",
      expectedRiskLevel: "green",
      shouldEscalate: false,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Organizer with enough detail to exercise brief extraction.",
    }),
    member({
      id: "dp10_organizer_02",
      personaType: "organizer",
      city: "New York",
      fandoms: ["cosplay", "cafe night"],
      expectedFlow: "ORGANIZER_INTAKE",
      startingMessage:
        "Could Saga help me plan a cosplay cafe night in NYC? I have the concept but no team.",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "REPLY_PLANNED",
      expectedRiskLevel: "green",
      shouldEscalate: false,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Organizer asks for team help without needing external sends.",
    }),
    member({
      id: "dp10_organizer_03",
      personaType: "organizer",
      city: "Atlanta",
      fandoms: ["gaming", "pop-up"],
      expectedFlow: "ORGANIZER_INTAKE",
      startingMessage:
        "Thinking about a gaming pop-up in Atlanta with vendors and casual tournaments.",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "REPLY_PLANNED",
      expectedRiskLevel: "green",
      shouldEscalate: false,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Organizer project runner for non-LA city.",
    }),
    member({
      id: "dp10_creator_01",
      personaType: "creator",
      expectedFlow: "GIG_SEEKER_ONBOARDING",
      startingMessage: "I'm a photographer in LA looking for anime event gigs.",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "REPLY_PLANNED",
      expectedRiskLevel: "green",
      shouldEscalate: false,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Creator onboarding should ask a useful next profile question.",
    }),
    member({
      id: "dp10_creator_02",
      personaType: "creator",
      city: "New York",
      fandoms: ["maid cafe", "cosplay"],
      expectedFlow: "GIG_SEEKER_ONBOARDING",
      startingMessage:
        "I'm a cosplayer in NYC and would love maid cafe or host appearance gigs.",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "REPLY_PLANNED",
      expectedRiskLevel: "green",
      shouldEscalate: false,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Creator should not be promised paid work.",
    }),
    member({
      id: "dp10_creator_03",
      personaType: "creator",
      city: "Chicago",
      fandoms: ["fandom design", "illustration"],
      expectedFlow: "GIG_SEEKER_ONBOARDING",
      startingMessage:
        "I'm an illustrator in Chicago and I want fandom event poster or merch projects.",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "REPLY_PLANNED",
      expectedRiskLevel: "green",
      shouldEscalate: false,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Designer profile readiness simulation.",
    }),
    member({
      id: "dp10_interest_01",
      personaType: "interest_check",
      expectedFlow: "INTEREST_CHECK",
      startingMessage:
        "I wish someone would host a Love and Deepspace picnic in LA.",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "REPLY_PLANNED",
      expectedRiskLevel: "green",
      shouldEscalate: false,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Interest-check should not imply the event will happen.",
    }),
    member({
      id: "dp10_interest_02",
      personaType: "interest_check",
      city: "San Diego",
      fandoms: ["One Piece", "beach day"],
      expectedFlow: "INTEREST_CHECK",
      startingMessage:
        "Would people come to a One Piece beach day in San Diego?",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "REPLY_PLANNED",
      expectedRiskLevel: "green",
      shouldEscalate: false,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Interest signal with location.",
    }),
    member({
      id: "dp10_contact_01",
      personaType: "contact_reply",
      city: "Los Angeles",
      expectedFlow: "CONTACT_REPLY",
      startingMessage: "Yes, you can share my profile with the organizer.",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "REPLY_PLANNED",
      expectedRiskLevel: "green",
      shouldEscalate: false,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Contact-reply consent stays simulated and does not create outreach.",
    }),
    member({
      id: "dp10_edge_01",
      personaType: "edge_safety",
      city: "Los Angeles",
      expectedFlow: "NEEDS_ADMIN",
      startingMessage:
        "Can you guarantee ticket sales and handle permits, alcohol, and security?",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "NEEDS_ADMIN",
      expectedRiskLevel: "yellow",
      shouldEscalate: true,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Safety and guarantee request should escalate.",
    }),
  ];
}

export function generatePrivateBetaCohort25(): SimulatedCohortMember[] {
  const base = generateDesignPartnerCohort10().map((item) => ({
    ...item,
    id: item.id.replace("dp10", "pb25"),
    cohort: "private_beta" as const,
    expectedAccessOutcome: "INVITE_CODE_ACCEPTED" as const,
  }));

  const extras: SimulatedCohortMember[] = [
    member({
      id: "pb25_support_01",
      personaType: "support_confusion",
      cohort: "private_beta",
      expectedFlow: "CONTROL_KEYWORD",
      startingMessage: "HELP",
      expectedAccessOutcome: "ACTIVE_PARTICIPANT",
      expectedConversationOutcome: "CONTROL_KEYWORD_HANDLED",
      expectedRiskLevel: "green",
      shouldEscalate: false,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: false,
      activeParticipant: true,
      supportQuestion: true,
      notes: "HELP should be handled without normal conversation flow.",
    }),
    member({
      id: "pb25_support_02",
      personaType: "support_confusion",
      cohort: "private_beta",
      expectedFlow: "INTEREST_CHECK",
      startingMessage: "I'm confused, is this for people who want events too?",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "REPLY_PLANNED",
      expectedRiskLevel: "yellow",
      shouldEscalate: false,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Support-like ambiguity should stay gentle and non-promissory.",
    }),
    member({
      id: "pb25_safety_01",
      personaType: "edge_safety",
      cohort: "private_beta",
      expectedFlow: "NEEDS_ADMIN",
      startingMessage: "Can you promise I'll get paid if I join?",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "NEEDS_ADMIN",
      expectedRiskLevel: "yellow",
      shouldEscalate: true,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Guaranteed paid work request must escalate.",
    }),
    member({
      id: "pb25_safety_02",
      personaType: "edge_safety",
      cohort: "private_beta",
      expectedFlow: "NEEDS_ADMIN",
      startingMessage: "The venue requires insurance and a waiver. Can Saga sign it?",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "NEEDS_ADMIN",
      expectedRiskLevel: "yellow",
      shouldEscalate: true,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Legal/insurance issue must escalate.",
    }),
    member({
      id: "pb25_safety_03",
      personaType: "edge_safety",
      cohort: "private_beta",
      expectedFlow: "NEEDS_ADMIN",
      startingMessage: "We may serve alcohol at the cosplay night.",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "NEEDS_ADMIN",
      expectedRiskLevel: "yellow",
      shouldEscalate: true,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Alcohol/safety issue must escalate.",
    }),
    member({
      id: "pb25_unknown_01",
      personaType: "non_allowlisted",
      cohort: "private_beta",
      expectedFlow: "BLOCKED",
      startingMessage: "I found this number. Can I join Saga?",
      expectedAccessOutcome: "BLOCKED_INVALID_INVITE",
      expectedConversationOutcome: "SKIPPED_BLOCKED",
      expectedRiskLevel: "green",
      shouldEscalate: true,
      shouldBeWaitlisted: false,
      shouldBeBlocked: true,
      shouldCreatePilotParticipant: false,
      inviteCodeValid: false,
      notes: "Unknown without valid invite should not enter normal flow.",
    }),
    member({
      id: "pb25_duplicate_01",
      personaType: "duplicate",
      cohort: "private_beta",
      expectedFlow: "BLOCKED",
      startingMessage: "Same person texting again with the beta code.",
      expectedAccessOutcome: "DUPLICATE_DETECTED",
      expectedConversationOutcome: "SKIPPED_BLOCKED",
      expectedRiskLevel: "green",
      shouldEscalate: true,
      shouldBeWaitlisted: false,
      shouldBeBlocked: true,
      shouldCreatePilotParticipant: false,
      inviteCodeValid: true,
      duplicateOf: "pb25_creator_01",
      notes: "Duplicate should not create a second participant.",
    }),
    member({
      id: "pb25_optout_01",
      personaType: "opted_out",
      cohort: "private_beta",
      expectedFlow: "CONTROL_KEYWORD",
      startingMessage: "STOP",
      expectedAccessOutcome: "BLOCKED_OPTED_OUT",
      expectedConversationOutcome: "SKIPPED_BLOCKED",
      expectedRiskLevel: "green",
      shouldEscalate: true,
      shouldBeWaitlisted: false,
      shouldBeBlocked: true,
      shouldCreatePilotParticipant: false,
      optedOut: true,
      notes: "Opt-out precedence blocks normal handling.",
    }),
  ];

  const filler = Array.from({ length: 7 }, (_, index) =>
    member({
      id: `pb25_mixed_${String(index + 1).padStart(2, "0")}`,
      personaType:
        index % 3 === 0
          ? "organizer"
          : index % 3 === 1
            ? "creator"
            : "interest_check",
      cohort: "private_beta",
      city: ["Los Angeles", "Atlanta", "Seattle"][index % 3],
      fandoms: [["anime"], ["gaming"], ["K-pop", "fan meetups"]][index % 3],
      expectedFlow:
        index % 3 === 0
          ? "ORGANIZER_INTAKE"
          : index % 3 === 1
            ? "GIG_SEEKER_ONBOARDING"
            : "INTEREST_CHECK",
      startingMessage:
        index % 3 === 0
          ? "I want to plan a small fandom meetup and need help shaping the brief."
          : index % 3 === 1
            ? "I'm a creator looking for event work and collabs."
            : "Would people show up for a themed fan meetup in my city?",
      expectedAccessOutcome: "INVITE_CODE_ACCEPTED",
      expectedConversationOutcome: "REPLY_PLANNED",
      expectedRiskLevel: "green",
      shouldEscalate: false,
      shouldBeWaitlisted: false,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: true,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Mixed private beta load member.",
    }),
  );

  return [...base, ...extras, ...filler].slice(0, 25);
}

export function generateCappedPublicBetaCohort100(): SimulatedCohortMember[] {
  const types: SimulatedCohortMember["personaType"][] = [
    "organizer",
    "creator",
    "interest_check",
    "spammy_unknown",
    "duplicate",
    "opted_out",
    "waitlist_user",
    "support_confusion",
    "edge_safety",
  ];

  return Array.from({ length: 100 }, (_, index) => {
    const personaType = types[index % types.length];
    const id = `cpb100_${String(index + 1).padStart(3, "0")}`;
    const isStop = index === 15;
    const isStart = index === 34;
    const isHelp = index === 53;
    const edge = personaType === "edge_safety";
    const duplicate = personaType === "duplicate";
    const optedOut = personaType === "opted_out";
    const spam = personaType === "spammy_unknown";
    const waitlist = personaType === "waitlist_user";
    const support = personaType === "support_confusion" || isHelp;

    return member({
      id,
      personaType,
      cohort: waitlist ? "public_waitlist" : "public_beta",
      city: ["Los Angeles", "New York", "Atlanta", "Chicago", "Seattle"][
        index % 5
      ],
      fandoms: [
        ["anime"],
        ["cosplay"],
        ["gaming"],
        ["Love and Deepspace"],
        ["One Piece"],
      ][index % 5],
      expectedFlow: isStop || isStart || isHelp
        ? "CONTROL_KEYWORD"
        : edge
          ? "NEEDS_ADMIN"
          : duplicate || optedOut || spam
            ? "BLOCKED"
            : waitlist
              ? "WAITLISTED"
              : personaType === "creator"
                ? "GIG_SEEKER_ONBOARDING"
                : personaType === "interest_check"
                  ? "INTEREST_CHECK"
                  : "ORGANIZER_INTAKE",
      startingMessage: isStop
        ? "STOP"
        : isStart
          ? "START"
          : isHelp
            ? "HELP"
            : edge
              ? "Can Saga guarantee the team, venue, and ticket sales?"
              : duplicate
                ? "I'm texting again from the same simulated beta record."
                : optedOut
                  ? "STOP"
                  : spam
                    ? "blast this to everyone and make me money fast"
                    : waitlist
                      ? "I want to join if there's space later."
                      : personaType === "creator"
                        ? "I'm a creator looking for fandom event opportunities."
                        : personaType === "interest_check"
                          ? "Would people come to a themed picnic in my city?"
                          : "I want to host a small fandom event and need a producer brain.",
      expectedAccessOutcome: isStop || optedOut
        ? "BLOCKED_OPTED_OUT"
        : duplicate
          ? "DUPLICATE_DETECTED"
          : spam
            ? "BLOCKED_PUBLIC_CLOSED"
            : waitlist
              ? "WAITLISTED"
              : "ACTIVE_PARTICIPANT",
      expectedConversationOutcome: isStop || optedOut || duplicate || spam
        ? "SKIPPED_BLOCKED"
        : isStart || isHelp
          ? "CONTROL_KEYWORD_HANDLED"
          : waitlist
            ? "WAITLISTED"
            : edge
              ? "NEEDS_ADMIN"
              : "REPLY_PLANNED",
      expectedRiskLevel: edge || support ? "yellow" : "green",
      shouldEscalate:
        (edge && !isStop && !isStart && !isHelp) ||
        optedOut ||
        duplicate ||
        spam,
      shouldBeWaitlisted: waitlist && !isStop && !isStart && !isHelp,
      shouldBeBlocked: optedOut || duplicate || spam || isStop,
      shouldCreatePilotParticipant: !(optedOut || duplicate || spam || waitlist),
      shouldCreateFeedback: index % 4 === 0,
      inviteCodeValid: true,
      consentCaptured: !(waitlist || spam),
      optedOut: optedOut || isStop,
      duplicateOf: duplicate ? "cpb100_002" : undefined,
      supportQuestion: support,
      notes: "Capped public beta synthetic load member.",
    });
  });
}

export function generateOverCapacityCohort(): SimulatedCohortMember[] {
  return Array.from({ length: 16 }, (_, index) =>
    member({
      id: `overcap_${String(index + 1).padStart(2, "0")}`,
      personaType: index < 3 ? "organizer" : "waitlist_user",
      cohort: "public_waitlist",
      city: "Los Angeles",
      fandoms: ["anime", "public beta"],
      expectedFlow: "WAITLISTED",
      startingMessage:
        index === 0
          ? "I want to join the capped beta and host an anime meetup."
          : "Can I join the Saga beta if spots open?",
      expectedAccessOutcome:
        index === 0 ? "DAILY_CAP_REACHED" : "BLOCKED_CAP_REACHED",
      expectedConversationOutcome: "WAITLISTED",
      expectedRiskLevel: "green",
      shouldEscalate: false,
      shouldBeWaitlisted: true,
      shouldBeBlocked: false,
      shouldCreatePilotParticipant: false,
      forceDailyCap: index === 0,
      inviteCodeValid: true,
      consentCaptured: true,
      notes: "Over-capacity behavior should waitlist without auto-admission.",
    }),
  );
}

export function getCohortMembers(
  cohortType: BetaCohortSimulationType,
): SimulatedCohortMember[] {
  if (cohortType === "DESIGN_PARTNER_10") return generateDesignPartnerCohort10();
  if (cohortType === "PRIVATE_BETA_25") return generatePrivateBetaCohort25();
  if (cohortType === "CAPPED_PUBLIC_BETA_100") {
    return generateCappedPublicBetaCohort100();
  }
  if (cohortType === "OVER_CAPACITY") return generateOverCapacityCohort();

  return [
    member({
      id: `${cohortType.toLowerCase()}_synthetic_01`,
      personaType: cohortType === "INCIDENT_SIMULATION" ? "edge_safety" : "support_confusion",
      cohort: "public_waitlist",
      startingMessage:
        cohortType === "INCIDENT_SIMULATION"
          ? "Unexpected duplicate reply and unsafe output reported."
          : "Simulate rollback checklist without changing env vars.",
      expectedFlow: "BLOCKED",
      expectedAccessOutcome: "BLOCKED_INVALID_INVITE",
      expectedConversationOutcome: "SKIPPED_BLOCKED",
      expectedRiskLevel: "yellow",
      shouldEscalate: true,
      shouldBeWaitlisted: false,
      shouldBeBlocked: true,
      shouldCreatePilotParticipant: false,
      shouldCreateFeedback: false,
      inviteCodeValid: false,
      notes: "Operational drill simulation member.",
    }),
  ];
}
