import {
  analyzeBrief,
  CREATORS,
  CreatorMatch,
  matchCreatorToQuery,
} from "@/data/talentData";

export type FeedTab = "explore" | "following";
export type ApplicationRole = "Vendor" | "Cosplayer" | "Crew" | "Co-host";

export interface TicketTier {
  id: string;
  name: string;
  description: string;
  price: number;
  remaining: number;
  maxPerPerson?: number;
}

export interface Guest {
  id: string;
  name: string;
  avatar?: string;
  handle?: string;
  mutual?: boolean;
}

export interface Participant {
  id: string;
  name: string;
  roleLabel: "Vendor" | "Cosplayer" | "Guest" | "Crew" | "Co-host";
  avatar?: string;
  note?: string;
  tag?: string;
  portfolioUrl?: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  imageUrl: string;
  caption: string;
  likes: number;
  eventId?: string;
  eventTitle?: string;
  createdAt: string;
}

export interface VenueRecommendation {
  name: string;
  area: string;
  fitScore: number;
  rentEstimate: string;
  note: string;
}

export interface TalentCandidate {
  id: string;
  sourceCreatorId: string;
  name: string;
  role: string;
  city: string;
  bio: string;
  avatar?: string;
  portfolioImages: string[];
  fandomTags: string[];
  credits: string[];
  budgetFit: number;
  fandomFit: number;
  distributionScore: number;
  audienceReach: number;
  status?: "suggested" | "contacted" | "confirmed" | "declined";
}

export interface ProductionRole {
  id: string;
  name: string;
  required: boolean;
  status: "open" | "suggested" | "contacting" | "confirmed";
  selectedCandidateId?: string;
  candidates: TalentCandidate[];
  rationale?: string;
}

export interface ProductionPlan {
  eventId: string;
  venueRecommendation?: VenueRecommendation;
  roles: ProductionRole[];
  estimatedReach: number;
  budgetRange: string;
  launchReadiness: number;
  ticketsSold: number;
  remainingTickets: number;
  breakEven: number;
}

export interface Application {
  id: string;
  eventId: string;
  applicantName: string;
  applicantAvatar?: string;
  roleType: ApplicationRole;
  contribution: string;
  note: string;
  portfolioUrl?: string;
  status: "pending" | "accepted" | "declined";
  availabilityConfirmed: boolean;
  createdAt: string;
}

export interface EventProject {
  id: string;
  title: string;
  slug: string;
  description: string;
  longDescription?: string;
  city: string;
  venueName: string;
  venueAddress?: string;
  dateLabel: string;
  timeLabel: string;
  heroImage?: string;
  heroGradient: [string, string];
  tags: string[];
  eventType: string;
  status: "draft" | "planning" | "published" | "live" | "completed";
  capacity: number;
  rsvpCount: number;
  mutualCount: number;
  hostName: string;
  hostAvatar?: string;
  allowPublicApplications: boolean;
  ticketTiers: TicketTier[];
  guestList: Guest[];
  vendorsAndCosplayers: Participant[];
  posts: Post[];
  applications: Application[];
  productionPlan: ProductionPlan;
}

export interface OwnedTicket {
  id: string;
  eventId: string;
  tierId: string;
  quantity: number;
  purchasedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  roles: string[];
  fandomTags: string[];
  bio: string;
  portfolioUrl?: string;
  posts: Post[];
  attendingEventIds: string[];
  workingEventIds: string[];
  hostingEventIds: string[];
}

export interface CreateEventDraft {
  title: string;
  description: string;
  fandomCategory: string;
  city: string;
  eventType: string;
  expectedAttendance: string;
  vibeNotes: string;
  audienceTags: string;
  dateLabel: string;
  timeLabel: string;
  venuePreference: string;
  isPaid: boolean;
  capacity: string;
  generalTicketPrice: string;
  vipTicketPrice: string;
  requiredRoles: string[];
  budgetRange: string;
  staffingPriorities: string;
  allowPublicApplications: boolean;
}

const PICSUM_BASE = "https://picsum.photos/seed";
const DEFAULT_ROLE_ORDER = [
  "Producer",
  "Photographer",
  "Videographer",
  "Social Manager",
  "Stylist",
  "DJ / Host",
  "Vendor Lead",
  "Volunteer Lead",
  "Cosplay Guest",
] as const;

const EVENT_FIXTURES = [
  {
    title: "Limitless Cup Sleeve",
    slug: "limitless-cup-sleeve",
    city: "Los Angeles, CA",
    venueName: "Amino Ave",
    venueAddress: "2700 S Figueroa St, Los Angeles, CA",
    dateLabel: "Apr 14 - 13",
    timeLabel: "1:00 PM",
    heroGradient: ["#5d7df8", "#f08fd5"] as [string, string],
    tags: ["Jujutsu Kaisen", "Cup Sleeve", "Cosplay"],
    eventType: "Cup sleeve",
    status: "live" as const,
    capacity: 180,
    rsvpCount: 132,
    mutualCount: 26,
    description:
      "A JJK-themed cup sleeve takeover with raffle tickets, photo setups, check-ins, and a full cosplay-forward guest experience.",
    longDescription:
      "Join us for a Jujutsu Kaisen cup sleeve weekend with red carpet photos, themed merch drops, canned-food raffle entries, and a fandom-first guest list. Come in cosplay or come for the photos — both lanes welcome.",
    hostName: "Saga Events",
    ticketTiers: [
      { id: "ga", name: "General Admission", description: "Entry to the raffle lounge and photo line.", price: 15, remaining: 141, maxPerPerson: 4 },
      { id: "vip", name: "VIP", description: "Priority raffle entry, reserved merch lane, and lounge access.", price: 40, remaining: 24, maxPerPerson: 2 },
    ],
  },
  {
    title: "Court of Stars",
    slug: "court-of-stars",
    city: "Pasadena, CA",
    venueName: "Castle Green",
    venueAddress: "99 S Raymond Ave, Pasadena, CA",
    dateLabel: "Jul 18 - 19",
    timeLabel: "7:30 PM",
    heroGradient: ["#1b2b68", "#7b4cff"] as [string, string],
    tags: ["Love and Deepspace", "Cosplay", "Masquerade"],
    eventType: "Masquerade gala",
    status: "published" as const,
    capacity: 320,
    rsvpCount: 188,
    mutualCount: 26,
    description:
      "An elegant Love and Deepspace-themed masquerade with dramatic photo moments, themed vendors, and a formal cosplay floor.",
    longDescription:
      "A formal Love and Deepspace masquerade at Castle Green: dramatic photo moments under the chandeliers, themed vendor stalls, and a full cosplay floor. Black-tie cosplay encouraged — masks provided at the door if you forget yours.",
    hostName: "Saga Studio",
    ticketTiers: [
      { id: "ga", name: "General Admission", description: "Standing room entry and themed photo access.", price: 15, remaining: 141, maxPerPerson: 4 },
      { id: "vip", name: "VIP", description: "Priority entry, reserved seating, and exclusive lounge access.", price: 50, remaining: 24, maxPerPerson: 2 },
    ],
  },
  {
    title: "Gachiakuta x Jet Set Radio Rave",
    slug: "gachiakuta-jet-set-radio-rave",
    city: "Los Angeles, CA",
    venueName: "The Warehouse",
    venueAddress: "Arts District, Los Angeles, CA",
    dateLabel: "Apr 17",
    timeLabel: "9:00 PM",
    heroGradient: ["#ff5ca8", "#5f78ff"] as [string, string],
    tags: ["Gachiakuta", "Jet Set Radio", "Rave"],
    eventType: "Rave",
    status: "live" as const,
    capacity: 420,
    rsvpCount: 266,
    mutualCount: 34,
    description:
      "A punk-future rave where anime fandom meets warehouse dancefloor energy, graffiti visuals, and creator-led distribution.",
    longDescription:
      "A punk-future rave where Gachiakuta meets Jet Set Radio: warehouse dancefloor, graffiti visuals projected across three walls, and a creator-led lineup that runs late. Cosplay encouraged but not required.",
    hostName: "Saga Nights",
    ticketTiers: [
      { id: "ga", name: "General Admission", description: "All-night dance floor entry.", price: 22, remaining: 96, maxPerPerson: 4 },
      { id: "vip", name: "VIP", description: "Fast entry, mezzanine access, and artist meet window.", price: 65, remaining: 18, maxPerPerson: 2 },
    ],
  },
  {
    title: "Jujutsu Kaisen Night Out",
    slug: "jujutsu-kaisen-night-out",
    city: "Los Angeles, CA",
    venueName: "Amino Ave",
    venueAddress: "2700 S Figueroa St, Los Angeles, CA",
    dateLabel: "Apr 18",
    timeLabel: "2:00 PM",
    heroGradient: ["#232741", "#f35e9b"] as [string, string],
    tags: ["Jujutsu Kaisen", "Night Out", "Free Entry"],
    eventType: "Meetup",
    status: "published" as const,
    capacity: 210,
    rsvpCount: 164,
    mutualCount: 18,
    description:
      "A free-entry anime meetup with cosplay, fandom mini games, creator posts, and a strong public RSVP loop.",
    longDescription:
      "A free-entry Jujutsu Kaisen meetup at Amino Ave: photo setups, cosplay roaming, fandom mini-games, and a chill afternoon for the JJK community. Bring your fits; we'll bring the printable photo zones.",
    hostName: "Saga Community",
    ticketTiers: [
      { id: "rsvp", name: "RSVP", description: "Reserve your spot for free entry.", price: 0, remaining: 94, maxPerPerson: 2 },
      { id: "supporter", name: "Supporter", description: "Priority merch line plus bonus raffle ticket.", price: 12, remaining: 40, maxPerPerson: 2 },
    ],
  },
  {
    title: "Uma Musume Dachi Meetup",
    slug: "uma-musume-dachi-meetup",
    city: "San Francisco, CA",
    venueName: "Kinokuniya Bookstore",
    venueAddress: "1581 Webster St, San Francisco, CA",
    dateLabel: "Apr 25",
    timeLabel: "3:00 PM",
    heroGradient: ["#ff9862", "#6e64ff"] as [string, string],
    tags: ["Uma Musume", "Meetup", "Photo Walk"],
    eventType: "Photo walk",
    status: "published" as const,
    capacity: 140,
    rsvpCount: 88,
    mutualCount: 11,
    description:
      "A smaller fan meetup built around street-style cosplay photos, merch swaps, and soft-launch creator posts.",
    longDescription:
      "A small-batch Uma Musume meetup at Kinokuniya: street-style cosplay photo walk through Japantown, merch swap table, and a soft-launch creator post. Bring a friend, bring a fit, bring change for the vending machines.",
    hostName: "Saga Bay",
    ticketTiers: [
      { id: "rsvp", name: "RSVP", description: "Hold a free meetup slot.", price: 0, remaining: 61, maxPerPerson: 2 },
      { id: "bundle", name: "Support Bundle", description: "Meetup badge plus photo zine pickup.", price: 9, remaining: 24, maxPerPerson: 2 },
    ],
  },
  {
    title: "Team Rocket Rave",
    slug: "team-rocket-rave",
    city: "Koreatown, CA",
    venueName: "Neon District",
    venueAddress: "Koreatown, Los Angeles, CA",
    dateLabel: "May 7",
    timeLabel: "10:00 PM",
    heroGradient: ["#4d5df3", "#ff50a4"] as [string, string],
    tags: ["Pokemon", "Rave", "Streetwear"],
    eventType: "Rave",
    status: "planning" as const,
    capacity: 360,
    rsvpCount: 112,
    mutualCount: 22,
    description:
      "A villain-coded Pokemon rave with cosplay guests, projected visuals, and a ticket-driven staffing plan.",
    longDescription:
      "A villain-coded Pokemon rave in Koreatown: Team Rocket cosplay encouraged, projected battle visuals, streetwear-coded dress code, and a late-night floor that goes until last call. Catch the energy before it disbands.",
    hostName: "Saga After Dark",
    ticketTiers: [
      { id: "ga", name: "General Admission", description: "Floor entry and roaming photo access.", price: 20, remaining: 180, maxPerPerson: 4 },
      { id: "vip", name: "VIP", description: "Fast entry plus team-themed lounge seating.", price: 48, remaining: 36, maxPerPerson: 2 },
    ],
  },
  {
    title: "Studio Ghibli Marathon",
    slug: "studio-ghibli-marathon",
    city: "Los Angeles, CA",
    venueName: "Central Cinema",
    venueAddress: "Downtown Los Angeles, CA",
    dateLabel: "May 21",
    timeLabel: "1:00 PM",
    heroGradient: ["#395cae", "#7cc7ff"] as [string, string],
    tags: ["Studio Ghibli", "Screening", "VIP"],
    eventType: "Screening",
    status: "published" as const,
    capacity: 280,
    rsvpCount: 194,
    mutualCount: 29,
    description:
      "An all-day screening marathon with reserved seats, themed vendors, and a soft, cinematic public event page.",
    longDescription:
      "An all-day Studio Ghibli screening at Central Cinema: reserved seats, themed vendor lobby between films, and a poster bundle for VIPs. Bring tissues for Spirited Away; bring snacks for Totoro.",
    hostName: "Saga Cinema Club",
    ticketTiers: [
      { id: "ga", name: "General Admission", description: "All-day screening access.", price: 18, remaining: 84, maxPerPerson: 4 },
      { id: "vip", name: "VIP", description: "Reserved premium seat and poster bundle.", price: 54, remaining: 19, maxPerPerson: 2 },
    ],
  },
  {
    title: "Pokemon TCG Meetup",
    slug: "pokemon-tcg-meetup",
    city: "Los Angeles, CA",
    venueName: "Optimism Brewing",
    venueAddress: "Arts District, Los Angeles, CA",
    dateLabel: "May 17",
    timeLabel: "12:00 PM",
    heroGradient: ["#6f79ff", "#8fd0ff"] as [string, string],
    tags: ["Pokemon", "TCG", "Meetup"],
    eventType: "Mini convention",
    status: "planning" as const,
    capacity: 190,
    rsvpCount: 104,
    mutualCount: 15,
    description:
      "A daytime TCG meetup with casual tournaments, vendors, creator recaps, and a public apply funnel for community collaborators.",
    longDescription:
      "A daytime Pokemon TCG meetup at Optimism Brewing: casual tournaments, deck-help corner, vendor row, and a creator-led recap stream from the floor. Beer for the adults, lemonade for the kids, promo packs for the winners.",
    hostName: "Saga Cards",
    ticketTiers: [
      { id: "rsvp", name: "RSVP", description: "Reserve your free seat in the play area.", price: 0, remaining: 72, maxPerPerson: 2 },
      { id: "vip", name: "VIP", description: "Reserved play table and exclusive promo pack.", price: 16, remaining: 22, maxPerPerson: 2 },
    ],
  },
] as const;

export const DEFAULT_CREATE_EVENT_DRAFT: CreateEventDraft = {
  title: "",
  description: "",
  fandomCategory: "Anime x Fashion",
  city: "Los Angeles, CA",
  eventType: "Cup sleeve",
  expectedAttendance: "150",
  vibeNotes: "",
  audienceTags: "anime, cosplay, streetwear",
  dateLabel: "Aug 16",
  timeLabel: "7:00 PM",
  venuePreference: "Arts District warehouse or cafe buyout",
  isPaid: true,
  capacity: "150",
  generalTicketPrice: "18",
  vipTicketPrice: "45",
  requiredRoles: ["Producer", "Photographer", "Social Manager"],
  budgetRange: "$12K - $24K",
  staffingPriorities: "Need a lead producer, photographer, and social capture team first.",
  allowPublicApplications: true,
};

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

function seededImage(seed: string, width: number, height: number) {
  return `${PICSUM_BASE}/${seed}/${width}/${height}`;
}

function parseBudgetAverage(range: string) {
  const values = range
    .replace(/\$/g, "")
    .split("-")
    .map((part) => Number(part.trim().replace(/,/g, "")))
    .filter(Boolean);

  if (!values.length) return 18000;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseCreatorRateAverage(rateBand: string) {
  return parseBudgetAverage(rateBand);
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function overlapScore(a: string[], b: string[]) {
  const set = new Set(a.map((item) => item.toLowerCase()));
  return b.reduce((total, item) => total + (set.has(item.toLowerCase()) ? 1 : 0), 0);
}

function createGuestList(seed: string, mutualCount: number): Guest[] {
  const names = [
    "Sera Watanabe",
    "Kai Morales",
    "Nova Lin",
    "Cleo Park",
    "Sora Kim",
    "Yuki Hart",
  ];

  return names.map((name, index) => ({
    id: `${seed}-guest-${index}`,
    name,
    handle: `@${slugify(name).replace(/-/g, "")}`,
    avatar: seededImage(`${seed}-guest-${index}`, 180, 180),
    mutual: index < Math.min(3, Math.round(mutualCount / 10)),
  }));
}

function createParticipants(seed: string): Participant[] {
  const base = [
    { name: "Prism Power", roleLabel: "Vendor" as const, tag: "Sailor-core merch" },
    { name: "Gauge Cos", roleLabel: "Cosplayer" as const, tag: "Hero build" },
    { name: "Dice Forge Workshop", roleLabel: "Vendor" as const, tag: "Props & accessories" },
    { name: "Yume Parade", roleLabel: "Cosplayer" as const, tag: "Performance guest" },
  ];

  return base.map((entry, index) => ({
    id: `${seed}-participant-${index}`,
    name: entry.name,
    roleLabel: entry.roleLabel,
    tag: entry.tag,
    note: entry.roleLabel === "Vendor" ? "Accepted from public apply flow" : "Featured guest",
    avatar: seededImage(`${seed}-participant-${index}`, 220, 220),
  }));
}

function createPosts(eventId: string, title: string, authorPrefix: string): Post[] {
  return [
    {
      id: `${eventId}-post-1`,
      authorId: `${eventId}-author-1`,
      authorName: `${authorPrefix} Studio`,
      authorAvatar: seededImage(`${eventId}-post-author-1`, 120, 120),
      imageUrl: seededImage(`${eventId}-post-1`, 720, 900),
      caption: `Moodboard pass for ${title}. Tickets, tailored and ready for share.`,
      likes: 132,
      eventId,
      eventTitle: title,
      createdAt: "2h ago",
    },
    {
      id: `${eventId}-post-2`,
      authorId: `${eventId}-author-2`,
      authorName: "Alyssa Moon",
      authorAvatar: seededImage(`${eventId}-post-author-2`, 120, 120),
      imageUrl: seededImage(`${eventId}-post-2`, 720, 900),
      caption: `Posted from ${title}. Crew is distribution when the fandom trusts the host.`,
      likes: 84,
      eventId,
      eventTitle: title,
      createdAt: "35m ago",
    },
  ];
}

function resolveRoles(eventType: string, analysisRoles: string[]) {
  const eventSpecific =
    eventType === "Rave" || eventType === "Masquerade gala"
      ? ["Producer", "Photographer", "Videographer", "DJ / Host", "Social Manager", "Vendor Lead", "Cosplay Guest"]
      : eventType === "Screening"
        ? ["Producer", "Photographer", "Social Manager", "Volunteer Lead", "Vendor Lead"]
        : eventType === "Mini convention"
          ? ["Producer", "Vendor Lead", "Volunteer Lead", "Photographer", "Social Manager", "Cosplay Guest"]
          : ["Producer", "Photographer", "Social Manager", "Vendor Lead", "Cosplay Guest"];

  return unique([...analysisRoles, ...eventSpecific, ...DEFAULT_ROLE_ORDER]).slice(0, 8);
}

function rolePrompt(roleName: string) {
  switch (roleName) {
    case "Social Manager":
      return "social content community distribution reach";
    case "DJ / Host":
      return "host dj live programming event energy";
    case "Vendor Lead":
      return "vendor lead marketplace community organizer";
    case "Volunteer Lead":
      return "volunteer coordinator crowd flow production assistant";
    case "Cosplay Guest":
      return "cosplay guest costume performance fan host";
    default:
      return roleName;
  }
}

function createCandidate(event: Pick<EventProject, "title" | "description" | "tags" | "eventType" | "city">, roleName: string, match: CreatorMatch): TalentCandidate {
  const fandomFit = clamp(
    Math.round(match.overallScore * 0.48 + overlapScore(match.tags, event.tags) * 10 + overlapScore(match.deepSeedTags, tokenize(event.title)) * 8),
    44,
    99
  );
  const distributionScore = clamp(
    Math.round(match.clients.length * 6 + match.rating * 11 + match.overallScore * 0.32),
    42,
    99
  );
  const audienceReach = Math.round(1200 + distributionScore * 76 + fandomFit * 31);

  return {
    id: `${event.title}-${roleName}-${match.id}`.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    sourceCreatorId: match.id,
    name: match.name,
    role: roleName,
    city: match.city,
    bio: match.style,
    avatar: match.imageUrl,
    portfolioImages: match.portfolioUrls,
    fandomTags: unique([...event.tags, ...match.deepSeedTags.slice(0, 3)]).slice(0, 6),
    credits: match.clients.slice(0, 4),
    budgetFit: 68,
    fandomFit,
    distributionScore,
    audienceReach,
    status: "suggested",
  };
}

function enrichBudgetFit(candidate: TalentCandidate, budgetRange: string, sourceCreatorId: string) {
  const sourceCreator = CREATORS.find((creator) => creator.id === sourceCreatorId);
  if (!sourceCreator) return candidate;
  const budgetAverage = parseBudgetAverage(budgetRange);
  const creatorAverage = parseCreatorRateAverage(sourceCreator.rateBand);
  const distance = Math.abs(budgetAverage - creatorAverage) / budgetAverage;
  return {
    ...candidate,
    budgetFit: clamp(Math.round(96 - distance * 86), 38, 99),
  };
}

function createVenueRecommendation(event: Pick<EventProject, "title" | "city" | "tags" | "eventType" | "capacity">): VenueRecommendation {
  const fitScore = clamp(74 + event.tags.length * 3 + Math.round(event.capacity / 90), 74, 98);
  const area =
    event.city.includes("Pasadena") ? "Castle district" :
    event.city.includes("San Francisco") ? "Japantown" :
    event.city.includes("Koreatown") ? "Koreatown nightlife" :
    "Arts District";

  return {
    name: `${area} venue hold`,
    area,
    fitScore,
    rentEstimate: event.capacity > 260 ? "$6.5K - $9K" : "$2.4K - $4.8K",
    note: `Ticket demand unlocked this venue recommendation for ${event.title}.`,
  };
}

function createProductionPlan(baseEvent: Pick<EventProject, "id" | "title" | "description" | "tags" | "eventType" | "city" | "capacity" | "ticketTiers" | "rsvpCount" | "mutualCount">, budgetRange: string) {
  const analysis = analyzeBrief(`${baseEvent.title} ${baseEvent.description} ${baseEvent.tags.join(" ")}`);
  const roles = resolveRoles(baseEvent.eventType, analysis.roles).map((roleName, index) => {
    const matches = CREATORS
      .map((creator) =>
        matchCreatorToQuery(
          creator,
          `${baseEvent.title} ${baseEvent.description} ${baseEvent.tags.join(" ")} ${rolePrompt(roleName)}`,
          [roleName, ...analysis.roles]
        )
      )
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 5)
      .map((match) => enrichBudgetFit(createCandidate(baseEvent, roleName, match), budgetRange, match.id));

    return {
      id: `${baseEvent.id}-${slugify(roleName)}`,
      name: roleName,
      required: index < 5,
      status: index < 2 ? "suggested" : "open",
      selectedCandidateId: undefined,
      candidates: matches,
      rationale:
        index < 2
          ? "Ticket demand unlocked this role recommendation."
          : "Crew is distribution, so fandom trust matters as much as craft fit.",
    } satisfies ProductionRole;
  });

  const remainingTickets = baseEvent.ticketTiers.reduce((sum, tier) => sum + tier.remaining, 0);
  const ticketsSold = clamp(baseEvent.capacity - remainingTickets, 0, baseEvent.capacity);
  const breakEven = Math.round(parseBudgetAverage(budgetRange) / Math.max(1, averageTicketPrice(baseEvent.ticketTiers)));
  const selectedCandidates = roles
    .map((role) => role.candidates[0])
    .filter(Boolean);
  const estimatedReach = Math.round(
    baseEvent.mutualCount * 16 +
      baseEvent.rsvpCount * 8 +
      selectedCandidates.reduce((sum, candidate) => sum + candidate.audienceReach * 0.12, 0)
  );

  return {
    eventId: baseEvent.id,
    venueRecommendation: createVenueRecommendation(baseEvent),
    roles,
    estimatedReach,
    budgetRange,
    launchReadiness: 42,
    ticketsSold,
    remainingTickets,
    breakEven,
  } satisfies ProductionPlan;
}

function averageTicketPrice(tiers: TicketTier[]) {
  if (!tiers.length) return 18;
  return tiers.reduce((sum, tier) => sum + tier.price, 0) / tiers.length;
}

function createEventObject(fixture: (typeof EVENT_FIXTURES)[number], index: number): EventProject {
  const id = `event-${fixture.slug}`;
  const hostAvatar = seededImage(`${fixture.slug}-host`, 180, 180);
  const posts = createPosts(id, fixture.title, "Saga");
  const baseEvent = {
    id,
    title: fixture.title,
    slug: fixture.slug,
    description: fixture.description,
    longDescription: fixture.longDescription,
    city: fixture.city,
    venueName: fixture.venueName,
    venueAddress: fixture.venueAddress,
    dateLabel: fixture.dateLabel,
    timeLabel: fixture.timeLabel,
    heroImage: seededImage(`${fixture.slug}-hero`, 1200, 900),
    heroGradient: fixture.heroGradient,
    tags: [...fixture.tags],
    eventType: fixture.eventType,
    status: fixture.status,
    capacity: fixture.capacity,
    rsvpCount: fixture.rsvpCount,
    mutualCount: fixture.mutualCount,
    hostName: fixture.hostName,
    hostAvatar,
    allowPublicApplications: true,
    ticketTiers: fixture.ticketTiers.map((tier) => ({ ...tier })),
    guestList: createGuestList(fixture.slug, fixture.mutualCount),
    vendorsAndCosplayers: createParticipants(fixture.slug),
    posts,
    applications: index % 2 === 0 ? [
      {
        id: `${id}-application-1`,
        eventId: id,
        applicantName: "Prism Power",
        applicantAvatar: seededImage(`${fixture.slug}-application-1`, 180, 180),
        roleType: "Vendor",
        contribution: "Sailor-core accessories and event-exclusive sticker packs.",
        note: "Would love a vendor table near the photo zone.",
        portfolioUrl: "https://instagram.com/prismpower",
        status: "pending",
        availabilityConfirmed: true,
        createdAt: "1h ago",
      },
    ] : [],
  } satisfies Omit<EventProject, "productionPlan">;

  const budgetRange =
    fixture.eventType === "Rave" ? "$24K - $42K" :
    fixture.eventType === "Masquerade gala" ? "$28K - $48K" :
    fixture.eventType === "Screening" ? "$16K - $28K" :
    "$10K - $24K";

  return {
    ...baseEvent,
    productionPlan: createProductionPlan(baseEvent, budgetRange),
  };
}

export const INITIAL_EVENTS: EventProject[] = EVENT_FIXTURES.map(createEventObject);

export const INITIAL_OWNED_TICKETS: OwnedTicket[] = [
  {
    id: "ticket-gachiakuta-rave-ga",
    eventId: "event-gachiakuta-jet-set-radio-rave",
    tierId: "ga",
    quantity: 4,
    purchasedAt: "2026-04-20T13:00:00.000Z",
  },
];

export const INITIAL_VIEWER_PROFILE: UserProfile = {
  id: "viewer-alex",
  name: "Alex G",
  avatar: seededImage("viewer-alex-avatar", 220, 220),
  roles: ["Fan", "Host", "Vendor"],
  fandomTags: ["Anime", "Cosplay", "Streetwear", "JJK", "Pokemon"],
  bio: "Building IRL fan worlds where ticketing, community, and production all talk to each other.",
  portfolioUrl: "https://instagram.com/alexg",
  posts: [
    {
      id: "viewer-post-1",
      authorId: "viewer-alex",
      authorName: "Alex G",
      authorAvatar: seededImage("viewer-alex-avatar", 220, 220),
      imageUrl: seededImage("viewer-post-1", 720, 900),
      caption: "Ticketing, tailored. Testing how public demand shapes crew recommendations.",
      likes: 91,
      eventId: "event-court-of-stars",
      eventTitle: "Court of Stars",
      createdAt: "Yesterday",
    },
  ],
  attendingEventIds: ["event-gachiakuta-jet-set-radio-rave", "event-court-of-stars"],
  workingEventIds: ["event-team-rocket-rave"],
  hostingEventIds: ["event-studio-ghibli-marathon"],
};

export function buildEventQuery(event: Pick<EventProject, "title" | "description" | "tags" | "eventType" | "city">) {
  return `${event.title} ${event.description} ${event.tags.join(" ")} ${event.eventType} ${event.city}`.trim();
}

export function getEventById(events: EventProject[], eventId: string | null | undefined) {
  return events.find((event) => event.id === eventId) || null;
}

export function syncEventMetrics(event: EventProject) {
  const selectedCandidates = event.productionPlan.roles
    .map((role) => role.candidates.find((candidate) => candidate.id === role.selectedCandidateId))
    .filter(Boolean) as TalentCandidate[];
  const requiredRoles = event.productionPlan.roles.filter((role) => role.required).length;
  const confirmedRoles = event.productionPlan.roles.filter((role) => role.selectedCandidateId).length;
  const ticketsSold = event.capacity - event.ticketTiers.reduce((sum, tier) => sum + tier.remaining, 0);
  const remainingTickets = event.ticketTiers.reduce((sum, tier) => sum + tier.remaining, 0);
  const acceptedApplications = event.applications.filter((application) => application.status === "accepted").length;
  const estimatedReach = Math.round(
    event.mutualCount * 16 +
      event.rsvpCount * 9 +
      selectedCandidates.reduce((sum, candidate) => sum + candidate.audienceReach * 0.34, 0) +
      acceptedApplications * 160
  );
  const launchReadiness = clamp(
    Math.round(
      (confirmedRoles / Math.max(1, requiredRoles)) * 58 +
      (ticketsSold / Math.max(1, event.capacity)) * 24 +
      Math.min(10, acceptedApplications * 2) +
      Math.min(8, event.posts.length * 2)
    ),
    16,
    99
  );

  return {
    ...event,
    productionPlan: {
      ...event.productionPlan,
      estimatedReach,
      launchReadiness,
      ticketsSold,
      remainingTickets,
    },
  };
}

export function syncEventWithTeamSlots(
  event: EventProject,
  teamSlots: Record<string, CreatorMatch>
) {
  const roles = event.productionPlan.roles.map<ProductionRole>((role) => {
    const assignedCreator = teamSlots[role.name];
    if (!assignedCreator) {
      return {
        ...role,
        selectedCandidateId: undefined,
        status: role.candidates.length ? "suggested" : "open",
        candidates: role.candidates.map((candidate) =>
          candidate.status === "confirmed"
            ? { ...candidate, status: "suggested" as const }
            : candidate
        ),
      };
    }

    const existingCandidate =
      role.candidates.find((candidate) => candidate.sourceCreatorId === assignedCreator.id) ||
      enrichBudgetFit(
        createCandidate(event, role.name, assignedCreator),
        event.productionPlan.budgetRange,
        assignedCreator.id
      );

    const nextCandidates = [
      {
        ...existingCandidate,
        status: "confirmed" as const,
      },
      ...role.candidates
        .filter((candidate) => candidate.sourceCreatorId !== assignedCreator.id)
        .map((candidate) =>
          candidate.status === "confirmed"
            ? { ...candidate, status: "suggested" as const }
            : candidate
        ),
    ].slice(0, 6);

    return {
      ...role,
      selectedCandidateId: nextCandidates[0]?.id,
      status: "confirmed" as const,
      candidates: nextCandidates,
    };
  });

  return syncEventMetrics({
    ...event,
    productionPlan: {
      ...event.productionPlan,
      roles,
    },
  });
}

export function buildTeamSlotsFromEvent(event: EventProject) {
  const query = buildEventQuery(event);
  return Object.fromEntries(
    event.productionPlan.roles
      .map((role) => {
        const selected = role.candidates.find((candidate) => candidate.id === role.selectedCandidateId);
        if (!selected) return null;
        const sourceCreator = CREATORS.find((creator) => creator.id === selected.sourceCreatorId);
        if (!sourceCreator) return null;
        return [
          role.name,
          matchCreatorToQuery(sourceCreator, `${query} ${role.name}`, [role.name, ...event.tags]),
        ] as const;
      })
      .filter(Boolean) as Array<readonly [string, CreatorMatch]>
  );
}

export function buildWorkspaceEvent(query: string) {
  const analysis = analyzeBrief(query);
  const slug = slugify(query.slice(0, 48));
  const event: EventProject = {
    id: `workspace-${slug}`,
    title: query
      .split(" ")
      .slice(0, 4)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    slug,
    description: `A Saga planning draft for ${query}.`,
    longDescription: `Working draft. Real event details (date, lineup, vendors) will replace this copy once the host fills the brief — for now, this is the placeholder summary shown on shared links.`,
    city: analysis.location,
    venueName: "Suggested venue hold",
    venueAddress: analysis.location,
    dateLabel: "Aug 24",
    timeLabel: "7:00 PM",
    heroImage: seededImage(`${slug}-workspace-hero`, 1200, 900),
    heroGradient: ["#4d5df3", "#ff5ca8"],
    tags: unique(analysis.keywords.map((keyword) => keyword.charAt(0).toUpperCase() + keyword.slice(1))).slice(0, 4),
    eventType: analysis.type === "event" ? "Pop-up event" : "Creative project",
    status: "planning",
    capacity: 180,
    rsvpCount: 46,
    mutualCount: 12,
    hostName: "Saga",
    hostAvatar: seededImage(`${slug}-workspace-host`, 180, 180),
    allowPublicApplications: true,
    ticketTiers: [
      { id: "ga", name: "General Admission", description: "Entry to the event preview.", price: 18, remaining: 118, maxPerPerson: 4 },
      { id: "vip", name: "VIP", description: "Priority entry and backstage preview.", price: 42, remaining: 28, maxPerPerson: 2 },
    ],
    guestList: createGuestList(slug, 12),
    vendorsAndCosplayers: createParticipants(slug).slice(0, 3),
    posts: [],
    applications: [],
    productionPlan: undefined as unknown as ProductionPlan,
  };

  return syncEventMetrics({
    ...event,
    productionPlan: createProductionPlan(event, analysis.budget),
  });
}

export function buildEventFromDraft(draft: CreateEventDraft): EventProject {
  const title = draft.title.trim() || "Untitled Saga Event";
  const slug = slugify(title);
  const tags = unique(
    [
      draft.fandomCategory,
      draft.eventType,
      ...draft.audienceTags.split(/[,\n]+/).map((part) => part.trim()).filter(Boolean),
    ]
  ).slice(0, 6);
  const description = draft.description.trim() || draft.vibeNotes.trim() || "A new Saga-hosted fan event.";
  const event: EventProject = {
    id: `event-${slug}-${Date.now()}`,
    title,
    slug,
    description,
    longDescription: draft.vibeNotes.trim() || description,
    city: draft.city,
    venueName: draft.venuePreference || "Venue scouting in progress",
    venueAddress: draft.city,
    dateLabel: draft.dateLabel,
    timeLabel: draft.timeLabel,
    heroImage: seededImage(`${slug}-created-hero`, 1200, 900),
    heroGradient: ["#5f78ff", "#ff5db0"],
    tags,
    eventType: draft.eventType,
    status: "planning",
    capacity: clamp(Number(draft.capacity.replace(/[^\d]/g, "")) || 150, 40, 1200),
    rsvpCount: 18,
    mutualCount: 8,
    hostName: "Alex G",
    hostAvatar: seededImage(`${slug}-host`, 180, 180),
    allowPublicApplications: draft.allowPublicApplications,
    ticketTiers: draft.isPaid
      ? [
          {
            id: "ga",
            name: "General Admission",
            description: "Entry to the public event.",
            price: Number(draft.generalTicketPrice.replace(/[^\d]/g, "")) || 18,
            remaining: clamp(Number(draft.capacity.replace(/[^\d]/g, "")) || 150, 40, 1200),
            maxPerPerson: 4,
          },
          {
            id: "vip",
            name: "VIP",
            description: "Priority entry plus premium access.",
            price: Number(draft.vipTicketPrice.replace(/[^\d]/g, "")) || 45,
            remaining: Math.max(20, Math.round((Number(draft.capacity.replace(/[^\d]/g, "")) || 150) * 0.18)),
            maxPerPerson: 2,
          },
        ]
      : [
          {
            id: "rsvp",
            name: "RSVP",
            description: "Reserve your free ticket.",
            price: 0,
            remaining: clamp(Number(draft.capacity.replace(/[^\d]/g, "")) || 150, 40, 1200),
            maxPerPerson: 2,
          },
        ],
    guestList: [],
    vendorsAndCosplayers: [],
    posts: [],
    applications: [],
    productionPlan: undefined as unknown as ProductionPlan,
  };

  const seededPlan = createProductionPlan(event, draft.budgetRange);
  const roles = seededPlan.roles.map<ProductionRole>((role) => ({
    ...role,
    status: draft.requiredRoles.includes(role.name) || role.required ? "suggested" : "open",
  }));

  return syncEventMetrics({
    ...event,
    productionPlan: {
      ...seededPlan,
      budgetRange: draft.budgetRange,
      roles,
    },
  });
}
