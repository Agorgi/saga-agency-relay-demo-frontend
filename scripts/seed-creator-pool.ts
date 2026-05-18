#!/usr/bin/env tsx
/**
 * Seed the CreatorProfile pool with composite demo personas.
 *
 * Why this exists:
 *   PR #50 wired the producer engine into the tracer crew page. The
 *   pipeline generates real RoleOpening rows from any chat-created brief,
 *   then scores the internal CreatorProfile pool to produce
 *   CandidateRecommendation rows. In staging Neon the pool is empty —
 *   so design partners see "real roles, 0 candidates" cards, which
 *   undermines the demo even though every piece of plumbing is real.
 *
 *   This seed creates ~18 composite personas that cover the roles the
 *   producer's deterministic role-map generates (production lead,
 *   photographer, videographer, DJ, host, stylist, illustrator, etc.),
 *   spread across the cities our demos typically use (Los Angeles,
 *   New York, Brooklyn, Atlanta, Chicago) and the fandoms / community
 *   tags the producer recognises (anime, cosplay, K-pop, Love and
 *   Deepspace, creator community).
 *
 * Honesty contract:
 *   Every seeded Person carries `source: DEMO_COMPOSITE` (new enum
 *   value added in this PR's migration). Candidate cards render a
 *   "Composite" badge on every row from this source so design partners
 *   always know what they're looking at. Real outreach can never fire
 *   to these rows: `TWILIO_API_CALLS_FORBIDDEN=true` is on and the
 *   seeded Persons carry no phone/email values.
 *
 * Idempotency:
 *   Each seed entry has a stable `seedKey` stored on Person.name with
 *   a `[seed:KEY]` suffix that the script uses to find-or-update.
 *   Running this script twice yields the same DB state.
 *
 * Usage:
 *   npx tsx scripts/seed-creator-pool.ts
 *
 *   To re-seed against a non-default DB:
 *     DATABASE_URL=... npx tsx scripts/seed-creator-pool.ts
 */

import { PrismaClient } from "@prisma/client";

const COMPOSITE_NAME_SUFFIX = "(composite)";

type SeedEntry = {
  seedKey: string;
  /** Display name shown to organizers. Always ends in "(composite)". */
  displayName: string;
  city: string;
  state: string;
  /** Producer roleTypes this profile is eligible for (case-insensitive match). */
  roles: string[];
  skills: string[];
  fandoms: string[];
  communities: string[];
  bio: string;
  portfolioUrl: string;
  socialUrl: string;
};

const SEEDS: SeedEntry[] = [
  {
    seedKey: "maya-r-la-producer",
    displayName: `Maya R. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Los Angeles",
    state: "CA",
    roles: ["production lead", "production assistant"],
    skills: ["production", "operations", "logistics", "vendor coordination"],
    fandoms: ["anime", "Love and Deepspace"],
    communities: ["LA creator scene", "anime conventions"],
    bio: "Produces small creative events end to end — venue, vendors, run-of-show, day-of crew.",
    portfolioUrl: "https://example.com/maya-r/portfolio",
    socialUrl: "https://instagram.com/maya.r.composite",
  },
  {
    seedKey: "diego-v-la-photographer",
    displayName: `Diego V. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Los Angeles",
    state: "CA",
    roles: ["photographer", "social/content creator"],
    skills: ["photography", "content", "event photography"],
    fandoms: ["cosplay", "anime"],
    communities: ["cosplay community"],
    bio: "Event and editorial photographer with a portfolio of LA creator gatherings.",
    portfolioUrl: "https://example.com/diego-v/portfolio",
    socialUrl: "https://instagram.com/diego.v.composite",
  },
  {
    seedKey: "rin-s-la-videographer",
    displayName: `Rin S. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Los Angeles",
    state: "CA",
    roles: ["videographer", "social/content creator"],
    skills: ["video", "content", "short-form"],
    fandoms: ["K-pop", "anime"],
    communities: ["K-pop fan community"],
    bio: "Short-form recap and BTS videographer; comfortable with creator-led shoots.",
    portfolioUrl: "https://example.com/rin-s/reel",
    socialUrl: "https://instagram.com/rin.s.composite",
  },
  {
    seedKey: "kai-w-la-dj",
    displayName: `Kai W. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Los Angeles",
    state: "CA",
    roles: ["dj"],
    skills: ["music", "audio", "nightlife", "event sound"],
    fandoms: ["anime", "K-pop"],
    communities: ["LA nightlife", "anime conventions"],
    bio: "DJ specialising in anime-club and K-pop crossover sets at LA creator nights.",
    portfolioUrl: "https://example.com/kai-w/mixes",
    socialUrl: "https://instagram.com/kai.w.composite",
  },
  {
    seedKey: "lia-c-la-host",
    displayName: `Lia C. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Los Angeles",
    state: "CA",
    roles: ["host"],
    skills: ["hosting", "community", "performance"],
    fandoms: ["Love and Deepspace", "anime"],
    communities: ["LA creator scene"],
    bio: "Hosts community events with a warm, on-time vibe. Comfortable with live audiences up to 200.",
    portfolioUrl: "https://example.com/lia-c/portfolio",
    socialUrl: "https://instagram.com/lia.c.composite",
  },
  {
    seedKey: "harper-j-la-stylist",
    displayName: `Harper J. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Los Angeles",
    state: "CA",
    roles: ["guest cosplayer", "social/content creator"],
    skills: ["cosplay", "costume", "styling"],
    fandoms: ["cosplay", "Love and Deepspace", "anime"],
    communities: ["cosplay community"],
    bio: "Stylist and guest cosplayer with a romantic / cosmic palette portfolio.",
    portfolioUrl: "https://example.com/harper-j/portfolio",
    socialUrl: "https://instagram.com/harper.j.composite",
  },
  {
    seedKey: "noor-a-la-illustrator",
    displayName: `Noor A. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Los Angeles",
    state: "CA",
    roles: ["illustrator", "graphic designer"],
    skills: ["illustration", "art", "poster design"],
    fandoms: ["anime", "Love and Deepspace"],
    communities: ["LA creator scene"],
    bio: "Illustrator with anime-shoujo influence; designs posters and promo art for small events.",
    portfolioUrl: "https://example.com/noor-a/portfolio",
    socialUrl: "https://instagram.com/noor.a.composite",
  },
  {
    seedKey: "tess-m-la-venue",
    displayName: `Tess M. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Los Angeles",
    state: "CA",
    roles: ["venue"],
    skills: ["venue", "space", "operations"],
    fandoms: [],
    communities: ["LA creator scene"],
    bio: "Knows LA event venues from 50–300 capacity. Can shortlist spaces from a vibe brief.",
    portfolioUrl: "https://example.com/tess-m/spaces",
    socialUrl: "https://instagram.com/tess.m.composite",
  },
  // New York / Brooklyn
  {
    seedKey: "jules-p-bk-producer",
    displayName: `Jules P. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Brooklyn",
    state: "NY",
    roles: ["production lead"],
    skills: ["production", "operations", "logistics"],
    fandoms: ["anime", "comics"],
    communities: ["NYC creator scene"],
    bio: "Brooklyn-based producer for creator-aligned launches and meetups.",
    portfolioUrl: "https://example.com/jules-p/portfolio",
    socialUrl: "https://instagram.com/jules.p.composite",
  },
  {
    seedKey: "ariana-l-nyc-photographer",
    displayName: `Ariana L. ${COMPOSITE_NAME_SUFFIX}`,
    city: "New York",
    state: "NY",
    roles: ["photographer"],
    skills: ["photography", "content", "event photography"],
    fandoms: ["K-pop", "cosplay"],
    communities: ["NYC creator scene"],
    bio: "Editorial and event photographer covering NYC creator gatherings.",
    portfolioUrl: "https://example.com/ariana-l/portfolio",
    socialUrl: "https://instagram.com/ariana.l.composite",
  },
  {
    seedKey: "owen-k-bk-dj",
    displayName: `Owen K. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Brooklyn",
    state: "NY",
    roles: ["dj"],
    skills: ["music", "audio", "nightlife"],
    fandoms: ["anime"],
    communities: ["NYC creator scene", "Brooklyn nightlife"],
    bio: "Resident DJ for Brooklyn anime-club nights; comfortable with crossover audiences.",
    portfolioUrl: "https://example.com/owen-k/mixes",
    socialUrl: "https://instagram.com/owen.k.composite",
  },
  {
    seedKey: "imani-w-nyc-host",
    displayName: `Imani W. ${COMPOSITE_NAME_SUFFIX}`,
    city: "New York",
    state: "NY",
    roles: ["host", "social/content creator"],
    skills: ["hosting", "community", "performance"],
    fandoms: ["comics", "creator community"],
    communities: ["NYC creator scene"],
    bio: "Host with a comics-and-creator-community network. Keeps the room warm and on time.",
    portfolioUrl: "https://example.com/imani-w/portfolio",
    socialUrl: "https://instagram.com/imani.w.composite",
  },
  // Atlanta + Chicago + cross-market
  {
    seedKey: "sara-q-atl-producer",
    displayName: `Sara Q. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Atlanta",
    state: "GA",
    roles: ["production lead", "vendor coordinator"],
    skills: ["production", "vendor coordination", "operations"],
    fandoms: ["cosplay"],
    communities: ["Atlanta creator scene"],
    bio: "Atlanta producer with vendor-coordination experience for fan markets up to 500.",
    portfolioUrl: "https://example.com/sara-q/portfolio",
    socialUrl: "https://instagram.com/sara.q.composite",
  },
  {
    seedKey: "rena-t-atl-photographer",
    displayName: `Rena T. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Atlanta",
    state: "GA",
    roles: ["photographer", "social/content creator"],
    skills: ["photography", "content", "event coverage"],
    fandoms: ["anime", "cosplay"],
    communities: ["Atlanta creator scene"],
    bio: "Photographer covering Atlanta fan markets and creator meetups.",
    portfolioUrl: "https://example.com/rena-t/portfolio",
    socialUrl: "https://instagram.com/rena.t.composite",
  },
  {
    seedKey: "marcus-d-chi-dj",
    displayName: `Marcus D. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Chicago",
    state: "IL",
    roles: ["dj"],
    skills: ["music", "audio", "nightlife"],
    fandoms: ["anime"],
    communities: ["Chicago nightlife"],
    bio: "Chicago DJ for community-aligned nights — anime, gaming, K-pop crossover.",
    portfolioUrl: "https://example.com/marcus-d/mixes",
    socialUrl: "https://instagram.com/marcus.d.composite",
  },
  {
    seedKey: "amir-s-chi-host",
    displayName: `Amir S. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Chicago",
    state: "IL",
    roles: ["host"],
    skills: ["hosting", "community", "performance"],
    fandoms: ["creator community"],
    communities: ["Chicago creator scene"],
    bio: "Chicago host with a community-creator background. Comfortable with audiences up to 250.",
    portfolioUrl: "https://example.com/amir-s/portfolio",
    socialUrl: "https://instagram.com/amir.s.composite",
  },
  {
    seedKey: "june-c-la-volunteer-coord",
    displayName: `June C. ${COMPOSITE_NAME_SUFFIX}`,
    city: "Los Angeles",
    state: "CA",
    roles: ["volunteer coordinator", "production assistant"],
    skills: ["volunteers", "staffing", "operations"],
    fandoms: [],
    communities: ["LA creator scene"],
    bio: "Coordinates volunteer pools and day-of staffing for community events.",
    portfolioUrl: "https://example.com/june-c/portfolio",
    socialUrl: "https://instagram.com/june.c.composite",
  },
  {
    seedKey: "yuki-h-nyc-illustrator",
    displayName: `Yuki H. ${COMPOSITE_NAME_SUFFIX}`,
    city: "New York",
    state: "NY",
    roles: ["illustrator", "graphic designer"],
    skills: ["illustration", "art", "branding"],
    fandoms: ["anime", "Love and Deepspace"],
    communities: ["NYC creator scene"],
    bio: "Illustrator and graphic designer with anime-shoujo and shoujo-ai style portfolio.",
    portfolioUrl: "https://example.com/yuki-h/portfolio",
    socialUrl: "https://instagram.com/yuki.h.composite",
  },
];

export async function seedCreatorPool(prisma: PrismaClient) {
  let created = 0;
  let updated = 0;
  for (const seed of SEEDS) {
    // Find by displayName because Person doesn't have a stable seedKey
    // column today — adding one would expand the schema for the seed
    // alone. The displayName carries "(composite)" and is unique per seed,
    // so it serves as the natural key for idempotency.
    const existing = await prisma.creatorProfile.findFirst({
      where: { displayName: seed.displayName },
      select: { id: true, personId: true },
    });

    if (existing) {
      await prisma.creatorProfile.update({
        where: { id: existing.id },
        data: {
          bio: seed.bio,
          city: seed.city,
          roles: seed.roles,
          skills: seed.skills,
          fandoms: seed.fandoms,
          communities: seed.communities,
          portfolioUrls: [seed.portfolioUrl],
          socialUrls: [seed.socialUrl],
          reviewStatus: "APPROVED",
        },
      });
      await prisma.person.update({
        where: { id: existing.personId },
        data: {
          source: "DEMO_COMPOSITE",
          city: seed.city,
          state: seed.state,
          consentStatus: "EXPLICIT",
          optedOut: false,
        },
      });
      updated++;
    } else {
      const person = await prisma.person.create({
        data: {
          name: seed.displayName,
          city: seed.city,
          state: seed.state,
          source: "DEMO_COMPOSITE",
          consentStatus: "EXPLICIT",
          optedOut: false,
        },
      });
      await prisma.creatorProfile.create({
        data: {
          personId: person.id,
          displayName: seed.displayName,
          bio: seed.bio,
          city: seed.city,
          roles: seed.roles,
          skills: seed.skills,
          fandoms: seed.fandoms,
          communities: seed.communities,
          portfolioUrls: [seed.portfolioUrl],
          socialUrls: [seed.socialUrl],
          reviewStatus: "APPROVED",
        },
      });
      created++;
    }
  }
  return { created, updated, totalSeeds: SEEDS.length };
}

export { SEEDS, COMPOSITE_NAME_SUFFIX };

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await seedCreatorPool(prisma);
    console.log(
      `Seeded creator pool: ${result.created} created, ${result.updated} updated (out of ${result.totalSeeds} total).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Run when invoked directly (not when imported by tests).
const invokedDirectly =
  process.argv[1] && /seed-creator-pool\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  void main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
