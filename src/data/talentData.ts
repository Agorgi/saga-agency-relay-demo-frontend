import sagaSource from "./saga-source.json";

type RawCreator = {
  n: string;
  ig: string;
  e: string;
  sk: string[];
  cl: string[];
  st: string;
  sc: number;
};

type RawEvent = {
  id: number;
  title: string;
  type: "event" | "project" | "commission";
  category: string;
  date: string;
  time: string;
  location: string;
  attendees: number;
  capacity: number;
  gradient: string;
  host: string;
  hostAvatar: string;
  description: string;
  roles: string[];
  filled: number;
  brief: string;
  budget: string;
  status: string;
};

type RawRoleKeywordMap = Record<string, string[]>;

export interface Creator {
  id: string;
  name: string;
  instagram: string;
  email: string;
  city: string;
  skills: string[];
  clients: string[];
  style: string;
  rating: number;
  imageUrl: string;
  portfolioUrls: string[];
  primaryRole: string;
  tags: string[];
  deepSeedTags: string[];
  searchText: string;
  rateBand: string;
}

export interface RoleMatch {
  score: number;
  matchedSkills: string[];
  skillFit: number;
  brandRelevance: number;
  styleMatch: number;
}

export interface CreatorMatch extends Creator {
  overallScore: number;
  queryScore: number;
  affinityScore: number;
  bestRole: string;
  matchedRoles: string[];
  roleMatches: Record<string, RoleMatch>;
  matchReasons: string[];
}

export interface ProjectRole {
  name: string;
  filled: boolean;
  assignedCreator?: CreatorMatch;
  matchScore?: number;
}

export type OutreachStatus = "queued" | "sent" | "accepted";

export interface OutreachThread {
  id: string;
  creatorId: string;
  creatorName: string;
  role: string;
  city: string;
  status: OutreachStatus;
  messages: string[];
  reply: string;
  rateBand: string;
}

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  description: string;
  remaining: number;
}

export interface GroupChatMessage {
  sender: string;
  text: string;
  time: string;
}

export interface TaskBoardItem {
  title: string;
  owner: string;
  due: string;
  status: "Queued" | "In progress" | "Ready";
}

export interface GroupChat {
  title: string;
  participants: string[];
  messages: GroupChatMessage[];
  tasks: TaskBoardItem[];
}

export interface Project {
  id: string;
  title: string;
  type: "event" | "project" | "commission";
  category: string;
  date: string;
  location: string;
  description: string;
  brief: string;
  budget: string;
  timeline: string;
  audience: string;
  deliverables: string[];
  roles: ProjectRole[];
  status: "draft" | "staffing" | "ready" | "live";
  attendees: number;
  capacity: number;
  host: string;
  shareUrl: string;
  outreach: OutreachThread[];
  groupChat: GroupChat;
  ticketing?: {
    headline: string;
    checkoutNote: string;
    tiers: TicketTier[];
  };
  activity: { user: string; text: string; time: string }[];
}

export interface ProjectDraft {
  type: "event" | "project" | "commission";
  title: string;
  category: string;
  date: string;
  location: string;
  description: string;
  brief: string;
  budget: string;
  timeline: string;
  audience: string;
  deliverables: string;
  capacity: string;
  ticketPrice: string;
  roleOverrides: string[];
}

export interface BriefAnalysis {
  roles: string[];
  keywords: string[];
  location: string;
  budget: string;
  timeline: string;
  type: "event" | "project" | "commission";
  summary: string;
}

const { rawCreators, sampleEvents, roleKeywordMap } = sagaSource as {
  rawCreators: RawCreator[];
  sampleEvents: RawEvent[];
  roleKeywordMap: RawRoleKeywordMap;
};

const PICSUM_BASE = "https://picsum.photos/seed";
const TOP_BRANDS = [
  "nike",
  "adidas",
  "vogue",
  "gq",
  "netflix",
  "apple",
  "google",
  "amazon",
  "puma",
  "sony",
  "prada",
  "saint laurent",
  "chrome hearts",
];
const STOP_WORDS = new Set([
  "the",
  "and",
  "with",
  "for",
  "from",
  "into",
  "that",
  "this",
  "their",
  "through",
  "across",
  "need",
  "looking",
  "project",
  "event",
  "creative",
  "launch",
  "experience",
  "idea",
  "vision",
  "great",
  "right",
  "people",
  "crew",
  "team",
  "full",
  "major",
  "high",
  "premium",
  "content",
  "storytelling",
  "artist",
  "artists",
  "la",
]);

export const DEMO_QUERIES = [
  "anime streetwear pop-up in DTLA",
  "beauty editorial with chrome gothic energy",
  "music video launch for a luxury streetwear capsule",
  "pastel worldbuilding shoot for a fashion short",
];

export const DEFAULT_PROJECT_DRAFT: ProjectDraft = {
  type: "event",
  title: "",
  category: "Fashion × Culture",
  date: "May 24",
  location: "Arts District, DTLA",
  description: "",
  brief: "",
  budget: "$12K - $22K",
  timeline: "2-4 week production sprint",
  audience: "Creative community, collaborators, and ticket buyers in Los Angeles",
  deliverables: "Crew booking, event page, launch assets, guest communication",
  capacity: "150",
  ticketPrice: "$35",
  roleOverrides: [],
};

export const ROLE_LABELS = [
  "Director",
  "Photographer",
  "Cinematographer",
  "Videographer",
  "Editor",
  "Stylist",
  "Hair & Makeup",
  "Set Designer",
  "Producer",
  "Motion/VFX",
  "Graphic Designer",
  "Sound Designer",
] as const;

const ROLE_ALIASES: Record<string, string> = {
  "Cinematographer/DP": "Cinematographer",
  DP: "Cinematographer",
  "Creative Director": "Director",
  "Director of Photography": "Cinematographer",
};

const ROLE_TRIGGER_MAP: Record<string, string[]> = {
  Director: ["direction", "campaign", "anime", "story", "film", "creative", "worldbuilding", "editorial"],
  Photographer: ["photo", "photography", "editorial", "streetwear", "fashion", "lookbook", "portrait", "pop-up"],
  Cinematographer: ["cinematic", "film", "short", "music video", "dp", "lighting", "camera"],
  Videographer: ["video", "reel", "event", "festival", "coverage", "content", "launch"],
  Editor: ["edit", "editing", "cutdown", "highlight", "post", "reel"],
  Stylist: ["style", "styling", "fashion", "wardrobe", "streetwear", "editorial", "anime"],
  "Hair & Makeup": ["beauty", "makeup", "glam", "hair", "editorial", "lookbook"],
  "Set Designer": ["set", "space", "installation", "immersive", "pop-up", "world", "build"],
  Producer: ["event", "launch", "festival", "pop-up", "production", "schedule", "budget"],
  "Motion/VFX": ["motion", "3d", "anime", "digital", "projection", "visual", "fx"],
  "Graphic Designer": ["identity", "branding", "graphics", "poster", "merch", "type"],
  "Sound Designer": ["music", "sound", "audio", "festival", "film"],
};

const STYLE_BUNDLES: Array<{ triggers: string[]; roles: string[] }> = [
  {
    triggers: ["pop-up", "festival", "activation", "launch", "event"],
    roles: ["Producer", "Photographer", "Set Designer", "Videographer"],
  },
  {
    triggers: ["fashion", "streetwear", "editorial", "beauty", "lookbook"],
    roles: ["Stylist", "Photographer", "Hair & Makeup", "Director"],
  },
  {
    triggers: ["anime", "immersive", "digital", "worldbuilding", "chrome"],
    roles: ["Director", "Motion/VFX", "Set Designer", "Graphic Designer"],
  },
  {
    triggers: ["film", "short", "music video", "cinematic"],
    roles: ["Director", "Cinematographer", "Editor", "Producer"],
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRole(role: string) {
  return ROLE_ALIASES[role] || role;
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferRateBand(rating: number, primaryRole: string) {
  const base =
    primaryRole === "Producer" ? 4200 :
    primaryRole === "Director" ? 3800 :
    primaryRole === "Photographer" ? 2600 :
    primaryRole === "Stylist" ? 2200 :
    2400;
  const bonus = rating === 5 ? 1200 : 600;
  return `$${base + bonus} - $${base + bonus + 2400}`;
}

function deriveStyleTokens(style: string) {
  return tokenize(style).filter((token) => token.length > 3).slice(0, 8);
}

function deriveTags(skills: string[], clients: string[], style: string) {
  const skillTokens = skills.flatMap((skill) => tokenize(skill));
  const clientTokens = clients.flatMap((client) => tokenize(client));
  const styleTokens = deriveStyleTokens(style);
  return unique([...skillTokens, ...clientTokens, ...styleTokens]).slice(0, 28);
}

function inferPrimaryRole(skills: string[], style: string) {
  const skillText = [...skills, style].join(" ").toLowerCase();
  const ranked = Object.keys(roleKeywordMap)
    .map((role) => {
      const normalizedRole = normalizeRole(role);
      const score = roleKeywordMap[role].reduce((total, keyword) => {
        if (skillText.includes(keyword.toLowerCase())) return total + 1;
        return total;
      }, 0);
      return { role: normalizedRole, score };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.score ? ranked[0].role : "Director";
}

function createPortfolioUrls(id: string) {
  return [
    `${PICSUM_BASE}/${id}-hero/820/640`,
    `${PICSUM_BASE}/${id}-detail-1/560/420`,
    `${PICSUM_BASE}/${id}-detail-2/560/420`,
  ];
}

function parseCapacity(value: string | undefined) {
  const numeric = Number((value || "").replace(/[^\d]/g, ""));
  return clamp(numeric || 150, 40, 1200);
}

function parseTicketPrice(value: string | undefined) {
  const match = (value || "").match(/\d+/);
  return match ? Number(match[0]) : 35;
}

function parseDeliverables(value: string | undefined, query: string, roles: string[]) {
  const parts = (value || "")
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length) {
    return parts.slice(0, 6);
  }

  return [
    `Lock the ${query} brief and production scope`,
    `Confirm ${roles.slice(0, 3).join(", ")} availability`,
    "Publish the shareable project page",
  ];
}

function buildTicketing(
  type: Project["type"],
  title: string,
  capacity: number,
  basePrice: number
): Project["ticketing"] {
  if (type !== "event") return undefined;

  return {
    headline: `Tickets for ${title}`,
    checkoutNote: "Partiful-style checkout preview for the investor demo",
    tiers: [
      {
        id: "general",
        name: "General",
        price: basePrice,
        description: "Entry to the event plus live project updates.",
        remaining: Math.max(24, Math.round(capacity * 0.55)),
      },
      {
        id: "crew-circle",
        name: "Crew Circle",
        price: basePrice + 18,
        description: "Priority entry, artist chat, and behind-the-scenes access.",
        remaining: Math.max(12, Math.round(capacity * 0.22)),
      },
      {
        id: "vip",
        name: "VIP",
        price: basePrice + 42,
        description: "Front-of-line access, signed collateral, and concierge support.",
        remaining: Math.max(6, Math.round(capacity * 0.12)),
      },
    ],
  };
}

export const CREATORS: Creator[] = rawCreators.map((creator) => {
  const primaryRole = inferPrimaryRole(creator.sk, creator.st);
  const deepSeedTags = unique([
    ...deriveStyleTokens(creator.st),
    ...creator.sk.flatMap((skill) => tokenize(skill)).slice(0, 6),
    ...creator.cl.flatMap((client) => tokenize(client)).slice(0, 4),
  ]).slice(0, 14);

  const id = slugify(creator.n);
  return {
    id,
    name: creator.n,
    instagram: creator.ig,
    email: creator.e,
    city: "Los Angeles, CA",
    skills: creator.sk,
    clients: creator.cl,
    style: creator.st,
    rating: creator.sc,
    imageUrl: `${PICSUM_BASE}/${id}/760/940`,
    portfolioUrls: createPortfolioUrls(id),
    primaryRole,
    tags: deriveTags(creator.sk, creator.cl, creator.st),
    deepSeedTags,
    searchText: `${creator.n} ${creator.sk.join(" ")} ${creator.cl.join(" ")} ${creator.st}`.toLowerCase(),
    rateBand: inferRateBand(creator.sc, primaryRole),
  };
});

export const FEATURED_CREATORS = CREATORS.slice(0, 24);

function createProjectRoles(event: RawEvent): ProjectRole[] {
  return event.roles.map((role, index) => {
    const filled = index < event.filled;
    const creator = filled ? CREATORS[index % CREATORS.length] : undefined;
    return {
      name: normalizeRole(role),
      filled,
      assignedCreator: creator ? matchCreatorToQuery(creator, event.brief, [normalizeRole(role)]) : undefined,
      matchScore: filled && creator ? matchCreatorToQuery(creator, event.brief, [normalizeRole(role)]).overallScore : undefined,
    };
  });
}

export const SAMPLE_PROJECTS: Project[] = sampleEvents.map((event) => ({
  id: `sample-${event.id}`,
  title: event.title,
  type: event.type,
  category: event.category,
  date: event.date,
  location: event.location,
  description: event.description,
  brief: event.brief,
  budget: event.budget,
  timeline: "2-4 week production sprint",
  audience: "Los Angeles creative community and ticket-ready guests",
  deliverables: [
    "Finalize crew availability",
    "Publish the event page",
    "Coordinate guest communication",
  ],
  roles: createProjectRoles(event),
  status:
    event.status === "open" || event.status === "staffing" ? "staffing" :
    event.status === "almost_ready" ? "ready" :
    "live",
  attendees: event.attendees,
  capacity: event.capacity,
  host: event.host,
  shareUrl: `saga.demo/projects/sample-${event.id}`,
  outreach: [],
  groupChat: {
    title: `${event.title} crew chat`,
    participants: ["Saga PM Agent", event.host],
    messages: [
      {
        sender: "Saga PM Agent",
        text: "Project feed opened for sample event playback.",
        time: "Now",
      },
    ],
    tasks: [
      {
        title: "Review final production schedule",
        owner: event.host,
        due: "Tomorrow",
        status: "In progress",
      },
    ],
  },
  ticketing: buildTicketing(event.type, event.title, event.capacity, 35),
  activity: [
    { user: event.host, text: "Brief updated with creative references and role priorities.", time: "2h ago" },
    { user: "Saga", text: "New talent matches are ready for review.", time: "45m ago" },
  ],
}));

export function detectRolesFromQuery(query: string) {
  const lowerQuery = query.toLowerCase();
  const scoredRoles = ROLE_LABELS.map((role) => {
    const mapKeywords =
      roleKeywordMap[role] ||
      roleKeywordMap[Object.keys(roleKeywordMap).find((key) => normalizeRole(key) === role) || ""] ||
      [];
    const triggerKeywords = ROLE_TRIGGER_MAP[role] || [];
    const score =
      triggerKeywords.reduce((total, keyword) => total + (lowerQuery.includes(keyword) ? 3 : 0), 0) +
      mapKeywords.reduce((total, keyword) => total + (lowerQuery.includes(keyword.toLowerCase()) ? 2 : 0), 0) +
      (lowerQuery.includes(role.toLowerCase()) ? 4 : 0);

    return { role, score };
  });

  const bundledRoles = STYLE_BUNDLES.flatMap((bundle) =>
    bundle.triggers.some((trigger) => lowerQuery.includes(trigger)) ? bundle.roles : []
  );

  const topRoles = unique([
    ...scoredRoles
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.role),
    ...bundledRoles,
  ]).slice(0, 6);

  if (topRoles.length >= 3) return topRoles;

  return unique([
    ...topRoles,
    "Director",
    "Photographer",
    "Stylist",
    "Producer",
  ]).slice(0, 5);
}

export function analyzeBrief(query: string): BriefAnalysis {
  const lowerQuery = query.toLowerCase();
  const roles = detectRolesFromQuery(query);
  const keywords = unique(tokenize(query)).slice(0, 8);

  const location =
    lowerQuery.includes("dtla") || lowerQuery.includes("downtown") ? "Arts District, DTLA" :
    lowerQuery.includes("venice") ? "Venice Beach, LA" :
    lowerQuery.includes("silver lake") ? "Silver Lake, LA" :
    lowerQuery.includes("echo park") ? "Echo Park, LA" :
    lowerQuery.includes("hollywood") ? "Hollywood, LA" :
    "Los Angeles, CA";

  const type =
    lowerQuery.includes("commission") ? "commission" :
    lowerQuery.includes("event") || lowerQuery.includes("pop-up") || lowerQuery.includes("festival") ? "event" :
    "project";

  const budget =
    lowerQuery.includes("festival") ? "$28K - $45K" :
    lowerQuery.includes("pop-up") ? "$14K - $24K" :
    lowerQuery.includes("editorial") ? "$8K - $18K" :
    lowerQuery.includes("film") || lowerQuery.includes("video") ? "$20K - $38K" :
    "$12K - $22K";

  const timeline =
    lowerQuery.includes("rush") ? "7 day turnaround" :
    lowerQuery.includes("summer") ? "launching this summer" :
    lowerQuery.includes("next month") ? "shipping next month" :
    "2-4 week production sprint";

  return {
    roles,
    keywords,
    location,
    budget,
    timeline,
    type,
    summary: `${titleCase(query)} with ${roles.slice(0, 3).join(", ")} leading the crew.`,
  };
}

export function combineDetectedRoles(baseRoles: string[], overrides: string[] = []) {
  return unique([...overrides, ...baseRoles]).slice(0, 6);
}

export function matchCreatorToRole(creator: Creator, roleName: string): RoleMatch {
  const role = normalizeRole(roleName);
  const mapKey =
    Object.keys(roleKeywordMap).find((key) => normalizeRole(key).toLowerCase() === role.toLowerCase()) ||
    role;
  const keywords = roleKeywordMap[mapKey] || roleKeywordMap[role] || [role.toLowerCase()];
  const searchable = [...creator.skills, creator.style].map((entry) => entry.toLowerCase());
  const matchedSkills = creator.skills.filter((skill) =>
    keywords.some((keyword) => skill.toLowerCase().includes(keyword.toLowerCase()))
  );
  const skillFit = clamp(matchedSkills.length * 12 + (creator.primaryRole === role ? 10 : 0), 12, 54);
  const brandRelevance = clamp(
    creator.clients.reduce((total, client) => {
      return total + (TOP_BRANDS.some((brand) => client.toLowerCase().includes(brand)) ? 3 : 0);
    }, 0),
    3,
    24
  );
  const styleMatch = clamp(
    keywords.reduce((total, keyword) => {
      return total + (searchable.some((entry) => entry.includes(keyword.toLowerCase())) ? 4 : 0);
    }, 0) + creator.rating * 2,
    8,
    21
  );

  return {
    score: clamp(skillFit + brandRelevance + styleMatch, 18, 99),
    matchedSkills: matchedSkills.slice(0, 4),
    skillFit,
    brandRelevance,
    styleMatch,
  };
}

function overlapCount(haystack: string[], needles: string[]) {
  const set = new Set(haystack);
  return needles.reduce((total, token) => total + (set.has(token) ? 1 : 0), 0);
}

function getMatchReasons(creator: Creator, queryTokens: string[], roleMatches: Record<string, RoleMatch>, bestRole: string) {
  const reasons: string[] = [];
  const skillReasons = roleMatches[bestRole]?.matchedSkills.slice(0, 2) || creator.skills.slice(0, 2);
  if (skillReasons.length) reasons.push(skillReasons.join(" + "));

  const clientReason = creator.clients.find((client) =>
    queryTokens.some((token) => client.toLowerCase().includes(token))
  );
  if (clientReason) reasons.push(clientReason);

  const styleReason = creator.deepSeedTags.find((tag) => queryTokens.includes(tag));
  if (styleReason) reasons.push(`${styleReason} energy`);

  if (reasons.length === 0) {
    reasons.push(creator.style.split(" ").slice(0, 5).join(" "));
  }

  return reasons.slice(0, 3);
}

export function matchCreatorToQuery(creator: Creator, query: string, detectedRoles: string[]): CreatorMatch {
  const queryTokens = tokenize(query);
  const roleMatches = unique(detectedRoles.length ? detectedRoles : [creator.primaryRole]).reduce<Record<string, RoleMatch>>(
    (acc, role) => {
      acc[role] = matchCreatorToRole(creator, role);
      return acc;
    },
    {}
  );

  const orderedRoleMatches = Object.entries(roleMatches).sort((a, b) => b[1].score - a[1].score);
  const bestRole = orderedRoleMatches[0]?.[0] || creator.primaryRole;
  const bestRoleScore = orderedRoleMatches[0]?.[1]?.score || 52;
  const matchedRoles = orderedRoleMatches
    .filter(([, value]) => value.score >= 56)
    .map(([role]) => role);

  const skillOverlap = overlapCount(creator.tags, queryTokens);
  const clientOverlap = creator.clients.filter((client) =>
    queryTokens.some((token) => client.toLowerCase().includes(token))
  ).length;
  const styleOverlap = overlapCount(creator.deepSeedTags, queryTokens);
  const queryScore = clamp(
    Math.round(
      bestRoleScore * 0.52 +
      skillOverlap * 8 +
      clientOverlap * 7 +
      styleOverlap * 6 +
      creator.rating * 4
    ),
    28,
    99
  );

  return {
    ...creator,
    overallScore: queryScore,
    queryScore,
    affinityScore: 0,
    bestRole,
    matchedRoles: matchedRoles.length ? matchedRoles : [bestRole],
    roleMatches,
    matchReasons: getMatchReasons(creator, queryTokens, roleMatches, bestRole),
  };
}

export function scoreByAffinity(creator: Creator, selectedCreators: Creator[]) {
  const selectedSkillTags = selectedCreators.flatMap((entry) => entry.skills.map((skill) => skill.toLowerCase()));
  const selectedClientTags = selectedCreators.flatMap((entry) => entry.clients.map((client) => client.toLowerCase()));
  const selectedDeepTags = selectedCreators.flatMap((entry) => entry.deepSeedTags);

  const sharedSkills = creator.skills.filter((skill) =>
    selectedSkillTags.some((tag) => skill.toLowerCase() === tag || skill.toLowerCase().includes(tag))
  ).length;
  const sharedClients = creator.clients.filter((client) =>
    selectedClientTags.some((tag) => client.toLowerCase() === tag || client.toLowerCase().includes(tag))
  ).length;
  const sharedStyle = creator.deepSeedTags.filter((tag) => selectedDeepTags.includes(tag)).length;

  return clamp(sharedClients * 18 + sharedSkills * 11 + sharedStyle * 6 + creator.rating * 3, 0, 99);
}

export function generateDeepResults(
  selectedCreators: CreatorMatch[],
  allCreators: Creator[],
  query: string,
  detectedRoles: string[]
) {
  const selectedIds = new Set(selectedCreators.map((creator) => creator.id));
  return allCreators
    .filter((creator) => !selectedIds.has(creator.id))
    .map((creator) => {
      const queryMatch = matchCreatorToQuery(creator, query, detectedRoles);
      const affinityScore = scoreByAffinity(creator, selectedCreators);
      const overallScore = clamp(
        Math.round(queryMatch.queryScore * 0.45 + affinityScore * 0.55),
        22,
        99
      );

      return {
        ...queryMatch,
        affinityScore,
        overallScore,
      };
    })
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 72);
}

export function getSimilarCreators(creator: CreatorMatch, pool: CreatorMatch[]) {
  return pool
    .filter((candidate) => candidate.id !== creator.id)
    .map((candidate) => ({
      creator: candidate,
      score:
        scoreByAffinity(candidate, [creator]) * 0.6 +
        (candidate.bestRole === creator.bestRole ? 18 : 0) +
        candidate.overallScore * 0.25,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((entry) => entry.creator);
}

export function getInitialCanvasCreators(query: string, detectedRoles: string[]) {
  return CREATORS
    .map((creator) => matchCreatorToQuery(creator, query, detectedRoles))
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 80);
}

function firstName(name: string) {
  return name.split(" ")[0];
}

export function buildOutreachThreads(
  title: string,
  location: string,
  date: string,
  teamSlots: Record<string, CreatorMatch>
) {
  return Object.entries(teamSlots).map<OutreachThread>(([role, creator]) => ({
    id: `${creator.id}-${slugify(role)}`,
    creatorId: creator.id,
    creatorName: creator.name,
    role,
    city: creator.city,
    status: "queued",
    messages: [
      `Hey ${firstName(creator.name)} — I’m producing ${title} in ${location} and your work feels like a strong fit.`,
      `We’re looking for a ${role.toLowerCase()} for ${date}. Budget is ${creator.rateBand}. Up for a quick chat?`,
    ],
    reply: `I’m in for ${title}. The brief feels aligned — happy to confirm ${role.toLowerCase()} duties.`,
    rateBand: creator.rateBand,
  }));
}

export function buildGroupChat(title: string, teamSlots: Record<string, CreatorMatch>) {
  const members = ["Saga PM Agent", ...Object.values(teamSlots).map((creator) => creator.name)];
  const tasks = Object.entries(teamSlots).map<TaskBoardItem>(([role, creator], index) => ({
    title:
      role === "Producer"
        ? "Lock production timeline and vendor holds"
        : role === "Photographer" || role === "Cinematographer"
          ? "Build shot list and capture plan"
          : `Prepare ${role.toLowerCase()} deliverables`,
    owner: creator.name,
    due: index % 2 === 0 ? "Tomorrow" : "In 2 days",
    status: index === 0 ? "In progress" : "Queued",
  }));

  return {
    title: `${title} crew chat`,
    participants: members,
    messages: [
      {
        sender: "Saga PM Agent",
        text: "Crew confirmed. I opened this thread, synced the scope, and assigned first actions.",
        time: "Now",
      },
      {
        sender: "Saga PM Agent",
        text: "I’ll track deliverables, flag blockers, and keep everyone aligned to the brief.",
        time: "Now",
      },
      ...Object.entries(teamSlots).slice(0, 2).map(([role, creator], index) => ({
        sender: creator.name,
        text:
          index === 0
            ? `Confirmed for ${role.toLowerCase()}. I’ll share a first pass on references shortly.`
            : `Confirmed here too. Looping in with my availability and prep needs.`,
        time: index === 0 ? "1m ago" : "2m ago",
      })),
    ],
    tasks,
  } satisfies GroupChat;
}

export function buildProjectFromSession(
  query: string,
  analysis: BriefAnalysis,
  teamSlots: Record<string, CreatorMatch>,
  draft?: ProjectDraft | null
) {
  const roles = combineDetectedRoles(analysis.roles, draft?.roleOverrides || []);
  const assignedRoles = roles.map<ProjectRole>((role) => {
    const assignedCreator = teamSlots[role];
    return {
      name: role,
      filled: Boolean(assignedCreator),
      assignedCreator,
      matchScore: assignedCreator?.roleMatches[role]?.score || assignedCreator?.overallScore,
    };
  });

  const teamCount = assignedRoles.filter((role) => role.filled).length;
  const title = draft?.title?.trim()
    ? draft.title.trim()
    : analysis.type === "event"
      ? `${titleCase(query)} Showcase`
      : `${titleCase(query)} Production`;
  const location = draft?.location?.trim() || analysis.location;
  const timeline = draft?.timeline?.trim() || analysis.timeline;
  const audience =
    draft?.audience?.trim() ||
    (analysis.type === "event"
      ? "Culturally plugged-in guests, collaborators, and ticket buyers"
      : "Creative partners, brand stakeholders, and execution leads");
  const deliverables = parseDeliverables(
    draft?.deliverables,
    query,
    roles
  );
  const capacity = parseCapacity(draft?.capacity);
  const baseTicketPrice = parseTicketPrice(draft?.ticketPrice);
  const shareUrl = `saga.demo/projects/${slugify(title)}`;
  const outreach = buildOutreachThreads(title, location, draft?.date?.trim() || "May 24", teamSlots);
  const groupChat = buildGroupChat(title, teamSlots);

  return {
    id: `project-${slugify(query)}`,
    title,
    type: draft?.type || analysis.type,
    category: draft?.category?.trim() || analysis.keywords.slice(0, 2).map(titleCase).join(" × ") || "Creative Project",
    date: draft?.date?.trim() || "May 24",
    location,
    description:
      draft?.description?.trim() ||
      `A warm, high-touch concept built around ${query} and staffed through Saga's visual discovery workflow.`,
    brief: draft?.brief?.trim() || analysis.summary,
    budget: draft?.budget?.trim() || analysis.budget,
    timeline,
    audience,
    deliverables,
    roles: assignedRoles,
    status: teamCount >= Math.max(2, analysis.roles.length - 1) ? "ready" : "staffing",
    attendees: 86,
    capacity,
    host: "Saga",
    shareUrl,
    outreach,
    groupChat,
    ticketing: buildTicketing(draft?.type || analysis.type, title, capacity, baseTicketPrice),
    activity: [
      { user: "Saga", text: "Team draft, scope, and event page are ready for final review.", time: "Now" },
      { user: "Saga PM Agent", text: "Outreach drafts prepared for the selected crew.", time: "4m ago" },
      { user: "Community", text: "Early RSVPs are rolling in from your network.", time: "12m ago" },
      { user: "Producer", text: `Timeline aligned for ${analysis.timeline}.`, time: "28m ago" },
    ],
  } satisfies Project;
}
