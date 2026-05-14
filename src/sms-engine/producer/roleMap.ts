import {
  roleMapSchema,
  type ProducerRole,
  type ProjectUnderstanding,
  type RoleMap,
} from "@/sms-engine/producer/producerAgentTypes";

type RoleTemplate = Omit<
  ProducerRole,
  "priority" | "preferredFandoms" | "localRequired" | "missingInfoForRole" | "confidence"
>;

const roleTemplates: Record<string, RoleTemplate> = {
  "production lead": {
    roleType: "production lead",
    title: "Lightweight Production Lead",
    description: "Keeps planning, day-of operations, and team coordination moving.",
    requiredSkills: ["production", "operations", "logistics"],
    whyThisRoleMatters: "Every project needs a clear operator before outreach gets real.",
    roleFitCriteria: ["Has produced or coordinated small creative events"],
  },
  venue: {
    roleType: "venue",
    title: "Venue Partner",
    description: "Helps identify a realistic space and venue constraints.",
    requiredSkills: ["venue", "space", "operations"],
    whyThisRoleMatters: "Location shapes budget, capacity, timing, and feasibility.",
    roleFitCriteria: ["Knows local spaces", "Can reason about audience size"],
  },
  photographer: {
    roleType: "photographer",
    title: "Photographer",
    description: "Captures the project, guests, creators, and recap assets.",
    requiredSkills: ["photography", "content", "camera"],
    whyThisRoleMatters: "Visual documentation helps the organizer and future matching loop.",
    roleFitCriteria: ["Event or creator photography", "Relevant portfolio"],
  },
  videographer: {
    roleType: "videographer",
    title: "Videographer",
    description: "Captures short-form recap and promotional footage.",
    requiredSkills: ["video", "content", "camera"],
    whyThisRoleMatters: "Video is useful when the project has performance or brand moments.",
    roleFitCriteria: ["Short-form video", "Event coverage"],
  },
  dj: {
    roleType: "dj",
    title: "DJ",
    description: "Shapes music, pacing, and energy.",
    requiredSkills: ["music", "audio", "nightlife"],
    whyThisRoleMatters: "Music is core for parties, raves, launches, and cafe nights.",
    roleFitCriteria: ["Audience-appropriate sets", "Event audio experience"],
  },
  host: {
    roleType: "host",
    title: "Host",
    description: "Keeps the room warm, clear, and on schedule.",
    requiredSkills: ["hosting", "community", "performance"],
    whyThisRoleMatters: "A host can make community formats feel intentional instead of loose.",
    roleFitCriteria: ["Comfortable with live audiences", "Community trust"],
  },
  "guest cosplayer": {
    roleType: "guest cosplayer",
    title: "Guest Cosplayer",
    description: "Brings fandom alignment and creator/community energy.",
    requiredSkills: ["cosplay", "costume", "community"],
    whyThisRoleMatters: "Fandom-aligned creators help validate tone and audience fit.",
    roleFitCriteria: ["Cosplay portfolio", "Fandom/community fit"],
  },
  illustrator: {
    roleType: "illustrator",
    title: "Illustrator",
    description: "Creates artwork, poster assets, or merch direction.",
    requiredSkills: ["illustration", "art", "visual"],
    whyThisRoleMatters: "Useful when the project needs a distinct visual identity.",
    roleFitCriteria: ["Relevant art style", "Can make promo assets"],
  },
  "graphic designer": {
    roleType: "graphic designer",
    title: "Graphic Designer",
    description: "Designs event graphics, posts, signage, or brand assets.",
    requiredSkills: ["design", "graphics", "branding"],
    whyThisRoleMatters: "Design keeps the invitation and project identity coherent.",
    roleFitCriteria: ["Social/event graphics", "Brand or community design"],
  },
  "volunteer coordinator": {
    roleType: "volunteer coordinator",
    title: "Volunteer Coordinator",
    description: "Coordinates helper shifts, arrival windows, and basic coverage.",
    requiredSkills: ["volunteers", "staffing", "operations"],
    whyThisRoleMatters: "Larger events need clearer day-of people coverage.",
    roleFitCriteria: ["Staffing coordination", "Friendly operator"],
  },
  "vendor coordinator": {
    roleType: "vendor coordinator",
    title: "Vendor Coordinator",
    description: "Coordinates vendors, booth needs, and setup expectations.",
    requiredSkills: ["vendor", "market", "partners"],
    whyThisRoleMatters: "Vendor-heavy formats need someone focused on partner logistics.",
    roleFitCriteria: ["Vendor markets", "Partner communication"],
  },
  "production assistant": {
    roleType: "production assistant",
    title: "Production Assistant",
    description: "Supports checklists, setup, logistics, and communication.",
    requiredSkills: ["production", "operations", "logistics"],
    whyThisRoleMatters: "A practical support person helps keep small projects from drifting.",
    roleFitCriteria: ["Reliable", "Comfortable with day-of logistics"],
  },
  "sponsor/brand partner": {
    roleType: "sponsor/brand partner",
    title: "Sponsor / Brand Partner",
    description: "Explores aligned brand participation if appropriate.",
    requiredSkills: ["brand", "sponsor", "partnerships"],
    whyThisRoleMatters: "Only useful if the project is explicitly sponsor or launch oriented.",
    roleFitCriteria: ["Brand partnership experience", "Audience alignment"],
  },
  "social/content creator": {
    roleType: "social/content creator",
    title: "Social / Content Creator",
    description: "Supports creator-led storytelling and social coverage.",
    requiredSkills: ["content", "social", "creator"],
    whyThisRoleMatters: "Useful when the project depends on community attention and recap.",
    roleFitCriteria: ["Relevant audience", "Safe content style"],
  },
};

function canonical(value: string) {
  return value.toLowerCase().trim();
}

function parseAudienceSize(value?: string | null) {
  const match = value?.match(/\d{2,5}/);
  return match ? Number.parseInt(match[0], 10) : null;
}

function hasAny(text: string, needles: string[]) {
  const lower = canonical(text);
  return needles.some((needle) => lower.includes(needle));
}

function textFor(understanding: ProjectUnderstanding) {
  return [
    understanding.title,
    understanding.projectType,
    understanding.format,
    understanding.scope,
    understanding.vibe,
    understanding.helpNeeded,
    understanding.audience,
    ...understanding.fandoms,
  ]
    .filter(Boolean)
    .join(" ");
}

function makeRole({
  roleType,
  priority,
  understanding,
  localRequired,
  missingInfoForRole = [],
}: {
  roleType: string;
  priority: ProducerRole["priority"];
  understanding: ProjectUnderstanding;
  localRequired: boolean;
  missingInfoForRole?: string[];
}): ProducerRole {
  const template = roleTemplates[roleType];
  return {
    ...template,
    priority,
    preferredFandoms: understanding.fandoms,
    localRequired,
    missingInfoForRole,
    confidence:
      priority === "required"
        ? Math.max(0.55, understanding.confidence - missingInfoForRole.length * 0.08)
        : Math.max(0.45, understanding.confidence - 0.1),
  };
}

function uniqRoles(roles: ProducerRole[]) {
  const seen = new Set<string>();
  return roles.filter((role) => {
    const key = canonical(role.roleType);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function generateRoleMap(
  understanding: ProjectUnderstanding,
): RoleMap {
  if (understanding.sourceKind !== "organizer_project") {
    return roleMapSchema.parse({
      requiredRoles: [],
      optionalRoles: [],
      rolePriority: [],
      roleDescriptions: {},
      roleFitCriteria: {},
      localRequired: {},
      whyThisRoleMatters: {},
      missingInfoForRole: {
        project: ["Input does not look like an organizer project brief."],
      },
      confidence: 0.35,
      humanReviewRequired: true,
      explanationForAudit: [
        `Skipped role map because sourceKind=${understanding.sourceKind}.`,
      ],
    });
  }

  const text = textFor(understanding);
  const audienceSize = parseAudienceSize(understanding.expectedAudienceSize);
  const required: ProducerRole[] = [
    makeRole({
      roleType: "production lead",
      priority: "required",
      understanding,
      localRequired: false,
    }),
  ];
  const optional: ProducerRole[] = [];
  const isSmall = audienceSize !== null && audienceSize <= 50;
  const isLarge = audienceSize !== null && audienceSize >= 120;
  const localRequired = Boolean(understanding.city);

  if (understanding.city && !isSmall) {
    required.push(
      makeRole({
        roleType: "venue",
        priority: "required",
        understanding,
        localRequired: true,
      }),
    );
  } else {
    optional.push(
      makeRole({
        roleType: "venue",
        priority: "optional",
        understanding,
        localRequired,
        missingInfoForRole: understanding.city ? [] : ["city/location"],
      }),
    );
  }

  if (
    hasAny(text, [
      "photo",
      "photoshoot",
      "cosplay",
      "picnic",
      "creator",
      "content",
      "launch",
    ])
  ) {
    required.push(
      makeRole({
        roleType: "photographer",
        priority: "required",
        understanding,
        localRequired,
      }),
    );
  } else {
    optional.push(
      makeRole({
        roleType: "photographer",
        priority: "optional",
        understanding,
        localRequired,
      }),
    );
  }

  if (hasAny(text, ["rave", "party", "music", "dj", "dance", "launch"])) {
    required.push(
      makeRole({
        roleType: "dj",
        priority: "required",
        understanding,
        localRequired,
      }),
    );
  }

  if (hasAny(text, ["cosplay", "anime", "picnic", "community", "meetup", "cafe"])) {
    required.push(
      makeRole({
        roleType: "host",
        priority: isSmall ? "optional" : "required",
        understanding,
        localRequired,
      }),
    );
    optional.push(
      makeRole({
        roleType: "guest cosplayer",
        priority: "optional",
        understanding,
        localRequired,
      }),
    );
  }

  if (hasAny(text, ["vendor", "market", "booth", "cafe", "pop-up", "popup"])) {
    required.push(
      makeRole({
        roleType: "vendor coordinator",
        priority: "required",
        understanding,
        localRequired,
      }),
    );
  }

  if (isLarge) {
    required.push(
      makeRole({
        roleType: "volunteer coordinator",
        priority: "required",
        understanding,
        localRequired,
      }),
    );
    optional.push(
      makeRole({
        roleType: "videographer",
        priority: "optional",
        understanding,
        localRequired,
      }),
    );
  }

  if (hasAny(text, ["brand", "launch", "sponsor"])) {
    optional.push(
      makeRole({
        roleType: "sponsor/brand partner",
        priority: "optional",
        understanding,
        localRequired: false,
      }),
    );
  }

  optional.push(
    makeRole({
      roleType: "graphic designer",
      priority: "optional",
      understanding,
      localRequired: false,
    }),
    makeRole({
      roleType: "social/content creator",
      priority: "optional",
      understanding,
      localRequired,
    }),
    makeRole({
      roleType: "production assistant",
      priority: "optional",
      understanding,
      localRequired,
    }),
  );

  const requiredRoles = uniqRoles(required).slice(0, isSmall ? 3 : isLarge ? 7 : 5);
  const optionalRoles = uniqRoles(
    optional.filter(
      (role) =>
        !requiredRoles.some(
          (requiredRole) => canonical(requiredRole.roleType) === canonical(role.roleType),
        ),
    ),
  ).slice(0, 5);
  const allRoles = [...requiredRoles, ...optionalRoles];

  return roleMapSchema.parse({
    requiredRoles,
    optionalRoles,
    rolePriority: allRoles.map((role) => role.roleType),
    roleDescriptions: Object.fromEntries(
      allRoles.map((role) => [role.roleType, role.description]),
    ),
    roleFitCriteria: Object.fromEntries(
      allRoles.map((role) => [role.roleType, role.roleFitCriteria]),
    ),
    localRequired: Object.fromEntries(
      allRoles.map((role) => [role.roleType, role.localRequired]),
    ),
    whyThisRoleMatters: Object.fromEntries(
      allRoles.map((role) => [role.roleType, role.whyThisRoleMatters]),
    ),
    missingInfoForRole: Object.fromEntries(
      allRoles.map((role) => [role.roleType, role.missingInfoForRole]),
    ),
    confidence: Math.max(0.5, understanding.confidence - 0.04),
    humanReviewRequired: true,
    explanationForAudit: [
      `Generated ${requiredRoles.length} required and ${optionalRoles.length} optional roles.`,
      isSmall
        ? "Kept role map intentionally lean for small scope."
        : "Mapped roles based on format, city, fandom, and audience cues.",
    ],
  });
}
