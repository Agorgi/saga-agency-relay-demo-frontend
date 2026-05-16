import { CREATORS, matchCreatorToQuery } from "@/data/talentData";
import type {
  BookingTerms,
  BriefDraft,
  CandidateStatus,
  CreativeProject,
  EventModule,
  ProjectRole,
  ProjectType,
  RelayConversation,
  RelayMessage,
  TalentFilters,
  TalentProfile,
  TalentRecommendation,
  ViewerProfile,
} from "@/types/sagaAgency";

const PROJECT_TYPE_SUGGESTIONS: Record<ProjectType, string[]> = {
  "Brand campaign": ["Producer", "Photographer", "Art Director", "Stylist", "Editor"],
  Photoshoot: ["Producer", "Photographer", "Stylist", "HMUA", "Talent / Creator"],
  "Video shoot": ["Director", "DP", "Editor", "Motion Designer", "Production Assistant"],
  "Social content package": ["Social Producer", "Photographer", "Creator/Talent", "HMUA", "Editor"],
  "Music video": ["Director", "DP", "Stylist", "Editor", "Performer"],
  "Product launch": ["Producer", "Photographer", "Social Producer", "Set Designer", "Vendor Lead"],
  "Pop-up / activation": ["Producer", "Set Designer", "Photographer", "Vendor Lead", "DJ", "Social Manager"],
  "Fan event": ["Producer", "Photographer", "Host", "Vendor", "Cosplayer", "Social Manager"],
  "Editorial shoot": ["Photographer", "Stylist", "HMUA", "Producer", "Art Director"],
  "Creator collaboration": ["Producer", "Creator/Talent", "Photographer", "Editor", "Social Producer"],
  "Live performance": ["Producer", "Performer", "Photographer", "Host", "Social Manager"],
  Other: ["Producer", "Photographer", "Editor", "Stylist"],
};

const ROLE_SYNONYMS: Record<string, string[]> = {
  Producer: ["producer", "creative producer", "production management", "executive producer"],
  Photographer: ["photographer", "photography", "fashion photography", "concert photography", "photo assistant"],
  Videographer: ["videographer", "videography", "content creator", "camera operation"],
  Editor: ["editor", "editing", "adobe premiere pro", "davinci resolve", "retouching"],
  Stylist: ["stylist", "fashion styling", "costume designer"],
  HMUA: ["makeup artist", "airbrush makeup", "hair stylist", "braiding", "beauty"],
  "Art Director": ["art direction", "creative direction", "brand identity"],
  "Creative Director": ["creative direction", "director", "creative producer"],
  "Social Producer": ["social producer", "content creator", "community"],
  "Social Manager": ["social manager", "social producer", "content creator"],
  "Event Host": ["host", "presenter", "dj"],
  Host: ["host", "presenter", "dj"],
  DJ: ["dj", "music", "performance"],
  Performer: ["performer", "live artist", "choreography", "dance"],
  Cosplayer: ["cosplay", "costume", "character"],
  Vendor: ["vendor", "product", "merch", "artist alley"],
  "Vendor Lead": ["vendor", "artist alley", "community"],
  "Set Designer": ["set designer", "set design", "production design"],
  "Talent / Creator": ["creator", "content creator", "model", "artist"],
  "Production Assistant": ["production assistant", "assistant", "runner"],
  Director: ["director", "music video direction", "creative direction"],
  DP: ["director of photography", "cinematography", "shooting 16mm", "shooting 35mm"],
  "Motion Designer": ["motion", "motion/vfx", "graphic designer"],
  Model: ["model", "talent", "creator"],
};

const PROJECT_TYPES: ProjectType[] = [
  "Brand campaign",
  "Photoshoot",
  "Video shoot",
  "Social content package",
  "Music video",
  "Product launch",
  "Pop-up / activation",
  "Fan event",
  "Editorial shoot",
  "Creator collaboration",
  "Live performance",
  "Other",
];

const QUICK_REPLY_LIBRARY = {
  available: {
    label: "Available, rate works",
    talentMessage: "I’m available and the range works for me. Happy to keep going through Saga.",
    summary: "Talent is available and comfortable with the proposed rate.",
    status: "terms-ready" as const,
  },
  lowRate: {
    label: "Available but rate is low",
    talentMessage: "I can do it, but the rate is a little light for the scope. If usage is limited and parking is covered, I’m open.",
    summary: "Talent is available, but wants some rate or expense flexibility.",
    status: "negotiating" as const,
  },
  unavailable: {
    label: "Unavailable",
    talentMessage: "I’m booked that day, so I can’t take this one.",
    summary: "Talent is unavailable for the requested date.",
    status: "unavailable" as const,
  },
  details: {
    label: "Need more details",
    talentMessage: "Potentially interested. Can you send timing, deliverables, and whether usage is paid social only?",
    summary: "Talent wants more details before confirming availability or rate.",
    status: "talent-replied" as const,
  },
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseMoneyRange(input: string) {
  const normalized = input.replace(/[–—]/g, "-").toLowerCase();
  const matches = [...normalized.matchAll(/\$?(\d+(?:\.\d+)?)\s*(k)?/g)].map((match) => {
    const base = Number(match[1]);
    return match[2] ? base * 1000 : base;
  });

  if (!matches.length) return { low: 0, high: 0 };
  if (matches.length === 1) return { low: matches[0], high: matches[0] };
  return { low: Math.min(...matches), high: Math.max(...matches) };
}

function inferAvailability(index: number, rating: number) {
  const mod = (index + rating) % 4;
  if (mod === 0) return "available" as const;
  if (mod === 1) return "maybe" as const;
  if (mod === 2) return "busy" as const;
  return "unknown" as const;
}

function inferRoles(skills: string[], primaryRole: string) {
  const haystack = skills.map((skill) => skill.toLowerCase()).join(" ");
  const matches = Object.entries(ROLE_SYNONYMS)
    .filter(([, keywords]) => keywords.some((keyword) => haystack.includes(keyword)))
    .map(([role]) => role);

  return unique([primaryRole, ...matches]).slice(0, 4);
}

function inferProjectTypesForTalent(roles: string[], tags: string[]) {
  const joined = `${roles.join(" ")} ${tags.join(" ")}`.toLowerCase();

  return PROJECT_TYPES.filter((type) => {
    if (type === "Fan event") return /cosplay|anime|fan|host|vendor/.test(joined);
    if (type === "Pop-up / activation") return /vendor|set|producer|community/.test(joined);
    if (type === "Social content package") return /social|creator|content|editor/.test(joined);
    if (type === "Photoshoot") return /photographer|stylist|hmua|model/.test(joined);
    if (type === "Video shoot") return /director|videographer|dp|motion|editor/.test(joined);
    if (type === "Editorial shoot") return /editorial|stylist|art director|photographer/.test(joined);
    if (type === "Brand campaign") return /brand|producer|art director|creative/.test(joined);
    if (type === "Creator collaboration") return /creator|performer|social/.test(joined);
    return false;
  }).slice(0, 4) as ProjectType[];
}

export const TALENT_PROFILES: TalentProfile[] = CREATORS.map((creator, index) => {
  const roles = inferRoles(creator.skills, creator.primaryRole);
  const tags = unique([...creator.tags, ...creator.deepSeedTags]).slice(0, 10);
  const audienceReach = 9000 + index * 1150 + creator.rating * 1800;

  return {
    id: creator.id,
    name: creator.name,
    roles,
    city: creator.city,
    bio: creator.style,
    avatar: creator.imageUrl,
    portfolioImages: creator.portfolioUrls.length ? creator.portfolioUrls : [creator.imageUrl],
    credits: creator.clients.slice(0, 4),
    tags,
    projectTypes: inferProjectTypesForTalent(roles, tags),
    rateRange: creator.rateBand,
    availabilitySignal: inferAvailability(index, creator.rating),
    distributionScore: clamp(Math.round(audienceReach / 900), 40, 96),
    audienceReach,
    phoneMasked: `(${String(200 + index).slice(0, 3)}) •••-${String(1000 + index * 7).slice(-4)}`,
  };
});

function getTalentByName(name: string) {
  const found = TALENT_PROFILES.find((talent) => talent.name === name);
  if (!found) {
    throw new Error(`Missing talent fixture for ${name}`);
  }
  return found;
}

function buildRole(roleName: string, projectId: string): ProjectRole {
  return {
    id: `${projectId}-${slugify(roleName)}`,
    name: roleName,
    quantity: 1,
    required: true,
    status: "recommended",
    selectedTalentIds: [],
    recommendedTalentIds: [],
  };
}

function buildProjectQuery(project: CreativeProject) {
  return [
    project.title,
    project.projectType,
    project.description,
    project.goals.join(" "),
    project.city,
    ...project.requiredRoles.map((role) => role.name),
  ].join(" ");
}

function locationFit(project: CreativeProject, talent: TalentProfile) {
  if (project.locationMode === "remote") return 88;
  const projectCity = project.city.toLowerCase();
  const talentCity = talent.city.toLowerCase();
  if (talentCity.includes(projectCity.split(",")[0])) return 94;
  if (project.locationMode === "hybrid") return 74;
  return 58;
}

function budgetFit(project: CreativeProject, talent: TalentProfile) {
  const projectRange = parseMoneyRange(project.budgetRange);
  const talentRange = parseMoneyRange(talent.rateRange);

  if (!projectRange.high || !talentRange.low) return 70;
  if (talentRange.low <= projectRange.high && talentRange.high >= projectRange.low) return 90;
  if (talentRange.low <= projectRange.high * 1.18) return 76;
  return 52;
}

function priorProjectRelevance(project: CreativeProject, talent: TalentProfile) {
  return talent.projectTypes.includes(project.projectType) ? 92 : 58;
}

function categoryExperience(project: CreativeProject, talent: TalentProfile) {
  const tags = `${talent.tags.join(" ")} ${talent.credits.join(" ")}`.toLowerCase();
  const projectSignals = `${project.projectType} ${project.description} ${project.goals.join(" ")}`.toLowerCase();
  const overlap = unique(projectSignals.split(/\W+/).filter(Boolean)).filter((token) => tags.includes(token)).length;
  return clamp(56 + overlap * 7, 56, 94);
}

function availabilityLikelihood(talent: TalentProfile) {
  if (talent.availabilitySignal === "available") return 92;
  if (talent.availabilitySignal === "maybe") return 74;
  if (talent.availabilitySignal === "busy") return 34;
  return 56;
}

function whySagaMatched(
  project: CreativeProject,
  talent: TalentProfile,
  roleName: string,
  scored?: ReturnType<typeof matchCreatorToQuery>
) {
  const reasons = [
    scored?.bestRole === roleName ? `Saga ranks them highly for the ${roleName.toLowerCase()} role.` : null,
    talent.projectTypes.includes(project.projectType) ? `Has direct ${project.projectType.toLowerCase()} experience.` : null,
    talent.tags[0] ? `Shows recurring ${talent.tags[0]} cues across the portfolio.` : null,
    talent.credits[0] ? `Recent credits include ${talent.credits[0]}.` : null,
    budgetFit(project, talent) >= 85 ? `Budget aligns with your ${project.budgetRange} range.` : null,
    `Strong portfolio fit for ${project.projectType.toLowerCase()} work in ${project.city}.`,
  ].filter(Boolean) as string[];

  return reasons.slice(0, 4);
}

export function scoreTalentForProject(
  project: CreativeProject,
  talent: TalentProfile,
  roleName: string,
  candidateStatus: CandidateStatus = "suggested"
): TalentRecommendation {
  const sourceCreator = CREATORS.find((creator) => creator.id === talent.id);
  const scored = sourceCreator
    ? matchCreatorToQuery(sourceCreator, buildProjectQuery(project), [roleName])
    : null;

  const portfolioFitScore = clamp(scored?.roleMatches[roleName]?.score || scored?.overallScore || 68, 48, 98);
  const styleFitScore = clamp(
    Math.round(((scored?.roleMatches[roleName]?.styleMatch || 12) / 21) * 100),
    46,
    96
  );
  const categoryExperienceScore = categoryExperience(project, talent);
  const locationFitScore = locationFit(project, talent);
  const budgetFitScore = budgetFit(project, talent);
  const availabilityLikelihoodScore = availabilityLikelihood(talent);
  const distribution = clamp(talent.distributionScore || 62, 38, 98);
  const priorRelevance = priorProjectRelevance(project, talent);

  return {
    ...talent,
    primaryRole: roleName,
    portfolioFitScore,
    styleFitScore,
    categoryExperienceScore,
    locationFitScore,
    budgetFitScore,
    availabilityLikelihood: availabilityLikelihoodScore,
    distributionScore: distribution,
    priorProjectRelevance: priorRelevance,
    whySagaMatched: whySagaMatched(project, talent, roleName, scored || undefined),
    candidateStatus,
  };
}

export function getRecommendationsForRole(project: CreativeProject, roleName: string, limit = 8) {
  return TALENT_PROFILES
    .filter((talent) => talent.roles.some((role) => role.toLowerCase() === roleName.toLowerCase()))
    .map((talent) => scoreTalentForProject(project, talent, roleName))
    .sort((a, b) => {
      const aScore =
        a.portfolioFitScore * 0.3 +
        a.styleFitScore * 0.12 +
        a.categoryExperienceScore * 0.12 +
        a.locationFitScore * 0.1 +
        a.budgetFitScore * 0.12 +
        a.availabilityLikelihood * 0.09 +
        a.distributionScore * 0.1 +
        a.priorProjectRelevance * 0.05;
      const bScore =
        b.portfolioFitScore * 0.3 +
        b.styleFitScore * 0.12 +
        b.categoryExperienceScore * 0.12 +
        b.locationFitScore * 0.1 +
        b.budgetFitScore * 0.12 +
        b.availabilityLikelihood * 0.09 +
        b.distributionScore * 0.1 +
        b.priorProjectRelevance * 0.05;
      return bScore - aScore;
    })
    .slice(0, limit);
}

function withRecommendedTalent(project: CreativeProject) {
  return {
    ...project,
    requiredRoles: project.requiredRoles.map((role) => ({
      ...role,
      recommendedTalentIds: getRecommendationsForRole(project, role.name, 8).map((talent) => talent.id),
    })),
  };
}

function buildStaffingPlan(title: string, projectType: ProjectType, budgetRange: string) {
  return {
    summary: `Saga translated the brief into a staffed ${projectType.toLowerCase()} plan with role sequencing, candidate scoring, and Relay-ready outreach.`,
    recommendedTimeline:
      projectType === "Fan event" || projectType === "Pop-up / activation"
        ? "2-4 weeks for staffing, venue locking, and launch assets"
        : "7-14 days for matching, outreach, and booking",
    estimatedBudgetRange: budgetRange,
    risks:
      projectType === "Fan event"
        ? [
            "Vendor applications need an owner before public launch.",
            "Ticketing and community comms should lock before outreach closes.",
          ]
        : [
            "Usage rights need to be clarified before final booking.",
            "Availability may tighten if outreach goes out too late this week.",
          ],
    nextActions: [
      "Review recommended roles",
      "Shortlist the first wave of talent",
      "Ask Saga to reach out",
      "Turn replies into booking terms",
    ],
  };
}

function buildEventModule(slug: string, headline: string, rsvpCount: number): EventModule {
  return {
    enabled: true,
    headline,
    publicEventSlug: slug,
    rsvpCount,
    ticketTiers: [
      {
        id: `${slug}-ga`,
        name: "General Admission",
        description: "Public entry, guest-list access, and main floor admission.",
        price: 20,
        remaining: 141,
        maxPerPerson: 4,
      },
      {
        id: `${slug}-vip`,
        name: "VIP",
        description: "Priority entry, seating, and a host lounge badge.",
        price: 55,
        remaining: 24,
        maxPerPerson: 2,
      },
    ],
    guestList: [
      { id: `${slug}-g1`, name: "Sel", handle: "@sel" },
      { id: `${slug}-g2`, name: "Nova", handle: "@nova" },
      { id: `${slug}-g3`, name: "Vee", handle: "@vee" },
    ],
  };
}

const BASE_PROJECTS: CreativeProject[] = ([
  {
    id: "project-gloss-unit-brand-campaign",
    title: "Gloss Unit Brand Campaign",
    slug: "gloss-unit-brand-campaign",
    clientName: "Gloss Unit",
    projectType: "Brand campaign",
    description: "A beauty-meets-tech launch campaign with hero stills, paid social cutdowns, creator seeding, and a clean but high-gloss world that still feels culturally fluent.",
    goals: ["Launch the new serum line", "Deliver hero stills and paid social assets", "Book a team with beauty and creator-culture fluency"],
    city: "Los Angeles",
    locationMode: "on-site",
    dateLabel: "Jun 14 - Jun 15",
    budgetRange: "$18K - $28K",
    status: "matching",
    requiredRoles: ["Producer", "Photographer", "Art Director", "Stylist", "HMUA", "Editor"].map((role) =>
      buildRole(role, "project-gloss-unit-brand-campaign")
    ),
    shortlistedTalentIds: [],
    bookedTalentIds: [],
    relayConversationIds: [],
    deliverables: [
      { id: "gu-hero", title: "8 hero stills", dueDate: "Jun 20", status: "not-started" },
      { id: "gu-social", title: "6 paid social cutdowns", dueDate: "Jun 22", status: "not-started" },
    ],
    staffingPlan: buildStaffingPlan("Gloss Unit Brand Campaign", "Brand campaign", "$18K - $28K"),
  },
  {
    id: "project-j-fashion-editorial-campaign",
    title: "J-fashion Editorial Campaign",
    slug: "j-fashion-editorial-campaign",
    clientName: "Mori District",
    projectType: "Photoshoot",
    description: "A one-day J-fashion editorial campaign for web, paid social, and launch stills with chrome-gothic lighting and fandom-native styling.",
    goals: ["Launch the capsule with scroll-stopping images", "Cast culturally fluent talent", "Deliver edited selects within five days"],
    city: "Los Angeles",
    locationMode: "on-site",
    dateLabel: "Fri, May 18",
    budgetRange: "$6K - $10K",
    status: "matching",
    requiredRoles: ["Photographer", "Stylist", "HMUA", "Producer", "Cosplayer"].map((role) =>
      buildRole(role, "project-j-fashion-editorial-campaign")
    ),
    shortlistedTalentIds: [],
    bookedTalentIds: [],
    relayConversationIds: [],
    deliverables: [
      { id: "jf-lookbook", title: "12 launch stills", dueDate: "May 23", status: "not-started" },
      { id: "jf-social", title: "4 cutdowns for paid social", dueDate: "May 25", status: "not-started" },
    ],
    staffingPlan: buildStaffingPlan("J-fashion Editorial Campaign", "Photoshoot", "$6K - $10K"),
  },
  {
    id: "project-indie-game-launch-trailer",
    title: "Indie Game Launch Trailer",
    slug: "indie-game-launch-trailer",
    clientName: "Monoframe Studio",
    projectType: "Video shoot",
    description: "An indie game reveal trailer with practical textures, stylized performance capture, and a sharp launch-week social rollout.",
    goals: ["Cut a 45-second hero trailer", "Deliver vertical teasers", "Keep production nimble but cinematic"],
    city: "New York",
    locationMode: "hybrid",
    dateLabel: "Jun 02 - Jun 05",
    budgetRange: "$12K - $18K",
    status: "matching",
    requiredRoles: ["Director", "DP", "Editor", "Motion Designer", "Production Assistant"].map((role) =>
      buildRole(role, "project-indie-game-launch-trailer")
    ),
    shortlistedTalentIds: [],
    bookedTalentIds: [],
    relayConversationIds: [],
    deliverables: [
      { id: "ig-hero", title: "45-second launch trailer", dueDate: "Jun 12", status: "not-started" },
      { id: "ig-cutdowns", title: "3 teaser edits", dueDate: "Jun 14", status: "not-started" },
    ],
    staffingPlan: buildStaffingPlan("Indie Game Launch Trailer", "Video shoot", "$12K - $18K"),
  },
  {
    id: "project-court-of-stars-fan-gala",
    title: "Court of Stars Fan Gala",
    slug: "court-of-stars-fan-gala",
    clientName: "Saga Presents",
    projectType: "Fan event",
    description: "A Love and Deepspace-inspired fan gala with cosplay guests, vendors, a host program, and an optional public ticketing layer.",
    goals: ["Sell out the fan gala", "Lock culturally fluent crew", "Convert talent reach into ticket demand"],
    city: "Pasadena",
    locationMode: "on-site",
    dateLabel: "Jul 18 - Jul 19",
    budgetRange: "$8K - $15K",
    status: "outreach",
    requiredRoles: ["Producer", "Photographer", "Host", "Vendor", "Cosplayer", "Social Manager"].map((role) =>
      buildRole(role, "project-court-of-stars-fan-gala")
    ),
    shortlistedTalentIds: [],
    bookedTalentIds: [],
    relayConversationIds: [],
    deliverables: [
      { id: "cos-runofshow", title: "Run of show", dueDate: "Jul 10", status: "in-progress" },
      { id: "cos-social", title: "Guest announcement pack", dueDate: "Jul 07", status: "not-started" },
    ],
    staffingPlan: buildStaffingPlan("Court of Stars Fan Gala", "Fan event", "$8K - $15K"),
    optionalEventModule: buildEventModule("court-of-stars", "Optional ticketing module enabled", 188),
  },
  {
    id: "project-beauty-brand-creator-content-day",
    title: "Beauty Brand Creator Content Day",
    slug: "beauty-brand-creator-content-day",
    clientName: "Luna Depth",
    projectType: "Social content package",
    description: "A creator-led content sprint for a beauty launch with stills, reels, and talent-first behind-the-scenes storytelling.",
    goals: ["Capture a hero content day", "Book one creator with built-in reach", "Deliver polished edits fast"],
    city: "Miami",
    locationMode: "on-site",
    dateLabel: "May 28",
    budgetRange: "$5K - $9K",
    status: "booking",
    requiredRoles: ["Social Producer", "Photographer", "Talent / Creator", "HMUA", "Editor"].map((role) =>
      buildRole(role, "project-beauty-brand-creator-content-day")
    ),
    shortlistedTalentIds: [],
    bookedTalentIds: [],
    relayConversationIds: [],
    deliverables: [
      { id: "bb-reels", title: "6 reels", dueDate: "May 31", status: "in-progress" },
      { id: "bb-stills", title: "15 selects", dueDate: "Jun 01", status: "not-started" },
    ],
    staffingPlan: buildStaffingPlan("Beauty Brand Creator Content Day", "Social content package", "$5K - $9K"),
  },
  {
    id: "project-anime-streetwear-pop-up",
    title: "Anime Streetwear Pop-up",
    slug: "anime-streetwear-pop-up",
    clientName: "Orbit Goods",
    projectType: "Pop-up / activation",
    description: "An anime streetwear pop-up in DTLA with a fashion-forward visual world, live programming, vendor moments, and a promo rollout that feels editorial instead of generic retail.",
    goals: ["Drive foot traffic", "Lock a taste-forward production team", "Capture launch assets in real time"],
    city: "Arts District, DTLA",
    locationMode: "on-site",
    dateLabel: "Jul 20 - Jul 22",
    budgetRange: "$14K - $24K",
    status: "matching",
    requiredRoles: ["Producer", "Photographer", "Stylist", "Director", "Set Designer", "Social Manager"].map((role) =>
      buildRole(role, "project-anime-streetwear-pop-up")
    ),
    shortlistedTalentIds: [],
    bookedTalentIds: [],
    relayConversationIds: [],
    deliverables: [
      { id: "as-launch", title: "Launch run-of-show", dueDate: "Jul 12", status: "not-started" },
      { id: "as-content", title: "Promo capture + recap plan", dueDate: "Jul 15", status: "not-started" },
    ],
    staffingPlan: buildStaffingPlan("Anime Streetwear Pop-up", "Pop-up / activation", "$14K - $24K"),
  },
] as CreativeProject[]).map(withRecommendedTalent);

function buildRelayMessage(
  id: string,
  sender: RelayMessage["sender"],
  visibleTo: RelayMessage["visibleTo"],
  channel: RelayMessage["channel"],
  body: string,
  timestamp: string
): RelayMessage {
  return { id, sender, visibleTo, channel, body, timestamp };
}

function emptyTerms(project: CreativeProject, talent: TalentProfile, role: string): BookingTerms {
  return {
    projectId: project.id,
    talentId: talent.id,
    role,
    dateTime: project.dateLabel,
    location: `${project.city} · ${project.locationMode}`,
    rate: talent.rateRange,
    scope: role,
    deliverables: project.deliverables.map((item) => item.title).slice(0, 2),
    usageRights: "Paid social + owned channels",
    revisions: "1 round of creative revisions",
    expenses: "Parking and travel reimbursed if approved by Saga",
    cancellation: "48 hour cancellation window",
    status: "empty",
  };
}

function createSeedConversation(project: CreativeProject, talent: TalentProfile, roleName: string): RelayConversation {
  const roleId = project.requiredRoles.find((role) => role.name === roleName)?.id || `${project.id}-${slugify(roleName)}`;
  return {
    id: `${project.id}-${talent.id}-relay`,
    projectId: project.id,
    talentId: talent.id,
    roleId,
    status: "terms-ready",
    sagaSummary: `${talent.name} is interested, available after 1pm, and okay with the budget if parking is covered.`,
    nextActions: ["Confirm parking coverage", "Generate deal sheet", "Book talent"],
    extractedTerms: {
      ...emptyTerms(project, talent, roleName),
      rate: "$1,800",
      scope: "4-hour content-day shoot",
      expenses: "Parking covered",
      status: "draft",
    },
    messages: [
      buildRelayMessage(
        "seed-client-1",
        "client",
        "client",
        "app",
        "Can you ask if she’s free next Friday and whether $1,800 works for a half-day content shoot?",
        "10:12 AM"
      ),
      buildRelayMessage(
        "seed-saga-1",
        "saga",
        "talent",
        "sms",
        `Hi ${talent.name.split(" ")[0]} — Saga here. A beauty client is staffing a half-day content shoot in ${project.city} next Friday. Budget is $1,800. Are you available, and does that rate work if parking is covered?`,
        "10:13 AM"
      ),
      buildRelayMessage(
        "seed-talent-1",
        "talent",
        "talent",
        "sms",
        "I’m available after 1pm. $1,800 is okay for four hours if parking is covered.",
        "10:19 AM"
      ),
      buildRelayMessage(
        "seed-saga-2",
        "saga",
        "client",
        "app",
        `${talent.name} is available after 1pm. They accept $1,800 for a 4-hour shoot and ask that parking be covered.`,
        "10:20 AM"
      ),
    ],
  };
}

let seededProjects = BASE_PROJECTS;
const beautyProject = seededProjects.find((project) => project.slug === "beauty-brand-creator-content-day")!;
const jFashionProject = seededProjects.find((project) => project.slug === "j-fashion-editorial-campaign")!;
const beautyPhotographer = getTalentByName("Sammi Smith");
const beautyHmua = getTalentByName("Kay Cunningham");
const jFashionStylist = getTalentByName("Vincent Weathersby");

export const INITIAL_RELAY_CONVERSATIONS: RelayConversation[] = [
  createSeedConversation(beautyProject, beautyPhotographer, "Photographer"),
];

seededProjects = seededProjects.map((project) => {
  if (project.id === beautyProject.id) {
    return {
      ...project,
      shortlistedTalentIds: [beautyPhotographer.id, beautyHmua.id],
      relayConversationIds: INITIAL_RELAY_CONVERSATIONS.map((conversation) => conversation.id),
      requiredRoles: project.requiredRoles.map((role) => {
        if (role.name === "Photographer") {
          return {
            ...role,
            status: "terms-ready" as const,
            selectedTalentIds: [beautyPhotographer.id],
          };
        }
        if (role.name === "HMUA") {
          return {
            ...role,
            status: "shortlisted" as const,
            selectedTalentIds: [beautyHmua.id],
          };
        }
        return role;
      }),
    };
  }

  if (project.id === jFashionProject.id) {
    return {
      ...project,
      shortlistedTalentIds: [jFashionStylist.id],
      requiredRoles: project.requiredRoles.map((role) =>
        role.name === "Stylist"
          ? { ...role, status: "shortlisted" as const, selectedTalentIds: [jFashionStylist.id] }
          : role
      ),
    };
  }

  return project;
});

export const INITIAL_PROJECTS = seededProjects;

export const DEFAULT_BRIEF_DRAFT: BriefDraft = {
  title: "",
  clientName: "",
  projectType: "Photoshoot",
  description: "",
  goal: "",
  referenceLinks: "",
  roles: PROJECT_TYPE_SUGGESTIONS.Photoshoot,
  roleCounts: {},
  seniority: "Experienced but still collaborative",
  cultureNotes: "",
  localOnly: true,
  dateLabel: "Next month",
  city: "Los Angeles",
  locationMode: "on-site",
  budgetRange: "$6K - $10K",
  ratePreference: "day rate",
  urgency: "Normal",
  deliverables: "Hero images, selects, and social cutdowns",
  usageRights: "Owned social + web for 6 months",
};

export const DEFAULT_TALENT_FILTERS: TalentFilters = {
  role: "All roles",
  city: "All cities",
  projectType: "All",
  tag: "All tags",
  budget: "All budgets",
  availability: "all",
};

export const VIEWER_PROFILE: ViewerProfile = {
  id: "viewer-agency",
  name: "Alex G.",
  avatar: "/branding/saga-mark-cobalt.png",
  company: "Studio Orbit",
  bio: "Creative producer using Saga to source culturally fluent talent, structure outreach, and keep booking details in one place.",
  city: "Los Angeles",
  roles: ["Client", "Producer", "Creative Director"],
  tags: ["anime", "fashion", "editorial", "live experience", "creator economy"],
  credits: ["Studio Orbit", "Saga Demo", "Court of Stars", "Launch Week"],
  activeProjectIds: INITIAL_PROJECTS.map((project) => project.id),
  savedTalentIds: [beautyPhotographer.id, beautyHmua.id, jFashionStylist.id],
  inboundOpportunityIds: INITIAL_RELAY_CONVERSATIONS.map((conversation) => conversation.id),
};

export function getProjectById(projectId: string | null | undefined) {
  return INITIAL_PROJECTS.find((project) => project.id === projectId);
}

export function getProjectBySlug(slug: string | null | undefined, projects = INITIAL_PROJECTS) {
  return projects.find((project) => project.slug === slug);
}

export function getTalentById(talentId: string | null | undefined, talent = TALENT_PROFILES) {
  return talent.find((profile) => profile.id === talentId);
}

export function getTalentBySlug(slug: string | null | undefined, talent = TALENT_PROFILES) {
  return talent.find((profile) => slugify(profile.name) === slug || profile.id === slug);
}

export function getSuggestedRoles(projectType: ProjectType) {
  return PROJECT_TYPE_SUGGESTIONS[projectType] || PROJECT_TYPE_SUGGESTIONS.Other;
}

export function buildProjectFromDraft(draft: BriefDraft): CreativeProject {
  const slug = slugify(draft.title || `${draft.projectType}-project`);
  const projectId = `project-${slug}`;
  const roles = unique(draft.roles.length ? draft.roles : getSuggestedRoles(draft.projectType)).map((role) =>
    buildRole(role, projectId)
  );

  return withRecommendedTalent({
    id: projectId,
    title: draft.title || "Untitled project",
    slug,
    clientName: draft.clientName || undefined,
    projectType: draft.projectType,
    description: draft.description || draft.goal || "A new creative project staffed by Saga.",
    goals: unique(
      [draft.goal, draft.deliverables, draft.cultureNotes]
        .join(". ")
        .split(/[.\n]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    ).slice(0, 4),
    city: draft.city,
    locationMode: draft.locationMode,
    dateLabel: draft.dateLabel,
    budgetRange: draft.budgetRange,
    status: "matching",
    requiredRoles: roles,
    shortlistedTalentIds: [],
    bookedTalentIds: [],
    relayConversationIds: [],
    deliverables: unique(
      draft.deliverables
        .split(/[,\n]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    ).slice(0, 5).map((entry, index) => ({
      id: `${projectId}-deliverable-${index}`,
      title: entry,
      dueDate: draft.dateLabel,
      status: "not-started" as const,
    })),
    staffingPlan: {
      summary: `Saga translated the brief into a staffing plan focused on ${roles.map((role) => role.name).slice(0, 3).join(", ")}.`,
      recommendedTimeline:
        draft.urgency === "Rush"
          ? "24-72 hours for first outreach, then immediate term turns"
          : "2-7 days for matching, outreach, and booking",
      estimatedBudgetRange: draft.budgetRange,
      risks: [
        draft.localOnly ? "Local-only constraint may narrow availability." : "Remote coordination should lock deliverable ownership early.",
        draft.usageRights ? `Usage rights need to be confirmed: ${draft.usageRights}.` : "Usage rights are still undefined.",
      ],
      nextActions: [
        "Review Saga role recommendations",
        "Shortlist the strongest portfolio fits",
        "Ask Saga to reach out",
        "Approve terms and book talent",
      ],
    },
    optionalEventModule:
      draft.projectType === "Fan event" || draft.projectType === "Pop-up / activation"
        ? buildEventModule(slugify(draft.title || "event-module"), "Optional public ticketing module available", 84)
        : undefined,
  });
}

export function buildBriefDraftFromHostPrefill(input: {
  eventType?: string | null;
  city?: string | null;
  scale?: string | null;
  vibe?: string | null;
  date?: string | null;
  helpNeeded?: string | null;
  projectType?: string | null;
  suggestedRoles?: string[] | null;
  projectIdea?: string | null;
}): BriefDraft {
  const normalizedProjectType = PROJECT_TYPES.includes(
    input.projectType as ProjectType,
  )
    ? (input.projectType as ProjectType)
    : inferHostProjectTypeFromLabel(input.eventType || "");
  const titleBase =
    input.projectIdea?.trim() ||
    input.eventType?.trim() ||
    "New project";
  const vibeSentence = input.vibe?.trim() || "A new creative project staffed by Saga.";
  const helpNeeded = input.helpNeeded?.trim();

  return {
    ...DEFAULT_BRIEF_DRAFT,
    title: titleBase.replace(/\b\w/g, (char) => char.toUpperCase()),
    projectType: normalizedProjectType,
    description: vibeSentence,
    goal: helpNeeded || "Find the right crew fast.",
    city: input.city?.trim() || DEFAULT_BRIEF_DRAFT.city,
    roles:
      input.suggestedRoles?.length
        ? input.suggestedRoles
        : getSuggestedRoles(normalizedProjectType),
    cultureNotes: vibeSentence,
    dateLabel: input.date?.trim() || "Date TBD",
    budgetRange: input.scale?.trim()
      ? `Scale: ${input.scale.trim()}`
      : DEFAULT_BRIEF_DRAFT.budgetRange,
    deliverables: helpNeeded || DEFAULT_BRIEF_DRAFT.deliverables,
  };
}

export function seedBriefFromPrompt(prompt: string): BriefDraft {
  const lower = prompt.toLowerCase();
  const inferredType =
    lower.includes("music video")
      ? "Music video"
      : lower.includes("pop-up") || lower.includes("activation")
        ? "Pop-up / activation"
        : lower.includes("event")
          ? "Fan event"
          : lower.includes("editorial")
            ? "Editorial shoot"
            : lower.includes("video")
              ? "Video shoot"
              : lower.includes("content")
                ? "Social content package"
                : "Photoshoot";

  const inferredCity =
    lower.includes("miami")
      ? "Miami"
      : lower.includes("new york")
        ? "New York"
        : lower.includes("san francisco")
          ? "San Francisco"
          : lower.includes("pasadena")
            ? "Pasadena"
            : "Los Angeles";

  return {
    ...DEFAULT_BRIEF_DRAFT,
    title: prompt.split(" ").slice(0, 5).join(" ").replace(/\b\w/g, (char) => char.toUpperCase()),
    projectType: inferredType,
    description: prompt,
    goal: "Find a culturally fluent team quickly without cold outreach.",
    city: inferredCity,
    roles: getSuggestedRoles(inferredType),
    cultureNotes: prompt,
  };
}

function inferHostProjectTypeFromLabel(value: string): ProjectType {
  const lower = value.toLowerCase();
  if (/pop-?up|activation|launch/.test(lower)) return "Pop-up / activation";
  if (/fan|gala|watch party|meetup/.test(lower)) return "Fan event";
  if (/editorial|lookbook|photoshoot|photo shoot/.test(lower)) return "Photoshoot";
  if (/music video/.test(lower)) return "Music video";
  if (/video|trailer|film/.test(lower)) return "Video shoot";
  if (/brand|campaign|product/.test(lower)) return "Brand campaign";
  if (/creator/.test(lower)) return "Creator collaboration";
  if (/performance|concert|show/.test(lower)) return "Live performance";
  return "Other";
}

export function getNextProjectAction(project: CreativeProject, conversations: RelayConversation[]) {
  if (!project.budgetRange) return "Brief incomplete — add budget";
  const relevantConversations = conversations.filter((conversation) => conversation.projectId === project.id);
  const replied = relevantConversations.filter((conversation) => conversation.status === "talent-replied" || conversation.status === "negotiating" || conversation.status === "terms-ready").length;
  if (replied) return `${replied} talent replied — review terms`;
  if (project.bookedTalentIds.length) return `${project.bookedTalentIds.length} talent booked`;
  const openRoles = project.requiredRoles.filter((role) => role.status !== "booked").length;
  return `${openRoles} open roles — start outreach`;
}

export function getRelayQuickReplyOptions() {
  return QUICK_REPLY_LIBRARY;
}
