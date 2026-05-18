/**
 * Cross-persona identity-signal extraction (PR #64).
 *
 * Every chat turn — host, creative, venue, fan — may mention things
 * that say something about the user beyond the surface they came in
 * through. A host briefing a "Love and Deepspace formal ball" is a
 * Love-and-Deepspace fan. A creative listing "anime event posters"
 * in their intake is too. A fan typing "rooftop k-pop nights" is.
 * For the cross-pollination promise (PRs #63–68) to mean anything,
 * those signals all have to land on the same `Person` row.
 *
 * This module is the single source of truth for what counts as a
 * fandom vs an interest, and produces both lists from arbitrary
 * free-text. It runs after every user message and is the input to
 * `upsertSessionIdentitySignals` (DB write).
 *
 * Pattern philosophy:
 *   - `FANDOM_PATTERNS` — specific media / franchises / scenes.
 *     Overlap between two people on a fandom is meaningful
 *     collaboration signal (the matching helper in PR #68 weights
 *     this).
 *   - `INTEREST_PATTERNS` — broader preferences (nightlife, brunch,
 *     rooftop venues). Useful but weaker signal. Doesn't trip
 *     fandom matching.
 *
 * Both lists are intentionally biased toward Saga's design-partner
 * cohort right now (anime + K-pop + Love and Deepspace fandoms, LA
 * / NYC / Brooklyn venues, creator-led nightlife). They'll grow as
 * we observe more user input — but the extractor will always be
 * pattern-based, not free-text, until the LLM live mode flips on
 * (PR #66 / #67 unblock that path).
 *
 * Framework-agnostic — no Next.js imports, no Prisma client. Pure
 * string → list. The DB-touching wrapper lives in
 * `sessionPersonStore.ts`.
 */

/**
 * Specific media / franchises / scenes. Overlap on these is the
 * strongest collaboration signal in the matching helper (PR #68).
 *
 * The producer engine already has a parallel list in
 * `src/sms-engine/producer/projectUnderstanding.ts` for Project
 * fandoms. They aren't merged yet (different shapes — that one
 * returns alongside other understanding fields). PR #68 reconciles.
 */
const FANDOM_PATTERNS: Array<[RegExp, string]> = [
  // Anime / manga
  [/\banime\b/i, "anime"],
  [/\bmanga\b/i, "manga"],
  [/\bone piece\b/i, "One Piece"],
  [/\bjujutsu( kaisen)?\b|\bjjk\b/i, "JJK"],
  [/\bdemon slayer\b/i, "Demon Slayer"],
  [/\bnaruto\b/i, "Naruto"],
  [/\bstudio ghibli\b|\bghibli\b/i, "Studio Ghibli"],
  // K-pop / J-pop / idol
  [/\bk[- ]?pop\b/i, "K-pop"],
  [/\bj[- ]?pop\b/i, "J-pop"],
  [/\bidol\b/i, "idol culture"],
  [/\bbts\b/i, "BTS"],
  [/\bblackpink\b/i, "Blackpink"],
  [/\btwice\b/i, "Twice"],
  // Gaming / interactive
  [/\bgaming\b/i, "gaming"],
  [/\besports?\b/i, "esports"],
  [/\blove and deepspace\b/i, "Love and Deepspace"],
  [/\bgenshin( impact)?\b/i, "Genshin Impact"],
  [/\bhonkai( star rail)?\b/i, "Honkai Star Rail"],
  [/\bstardew valley\b/i, "Stardew Valley"],
  // Cosplay / community
  [/\bcosplay\b/i, "cosplay"],
  [/\bj[- ]?fashion\b/i, "J-fashion"],
  [/\bharajuku\b/i, "Harajuku"],
  [/\blolita\b/i, "Lolita fashion"],
  // Other
  [/\bhorror\b/i, "horror"],
  [/\bcomics?\b/i, "comics"],
  [/\bdrag\b/i, "drag culture"],
];

/**
 * Broader preferences / scenes. Weaker signal than fandoms; useful
 * for "people who also like X" suggestions but doesn't cross
 * categories in matching.
 */
const INTEREST_PATTERNS: Array<[RegExp, string]> = [
  [/\bnightlife\b|\bnightclub\b|\bclubbing\b/i, "nightlife"],
  [/\bdj\b|\bdj nights?\b/i, "DJ nights"],
  [/\brave\b|\braves\b/i, "raves"],
  [/\bpop[- ]?ups?\b/i, "pop-ups"],
  [/\bbrunch\b/i, "brunch"],
  [/\brooftop\b/i, "rooftop venues"],
  [/\bdive bar\b/i, "dive bars"],
  [/\bbookshop\b|\bbookstore\b/i, "bookshops"],
  [/\brecord store\b/i, "record stores"],
  [/\bgallery (night|opening)\b/i, "gallery openings"],
  [/\bcoffee shop\b|\bcafe\b/i, "coffee shops"],
  [/\bfilm screening\b|\bmovie night\b/i, "film screenings"],
  [/\bwatch party\b/i, "watch parties"],
  [/\bcreator (event|night|meetup)\b/i, "creator events"],
  [/\bfan meetup\b/i, "fan meetups"],
  [/\bvariety show\b/i, "variety shows"],
];

export type IdentitySignals = {
  fandoms: string[];
  interests: string[];
};

const EMPTY_SIGNALS: IdentitySignals = Object.freeze({
  fandoms: [],
  interests: [],
}) as IdentitySignals;

export function emptyIdentitySignals(): IdentitySignals {
  return { fandoms: [], interests: [] };
}

/**
 * Scan a free-text string and return any fandoms + interests it
 * mentions. Deduplicates within each list and preserves the
 * pattern's canonical capitalization (e.g., "Love and Deepspace"
 * not "love and deepspace").
 *
 * Empty input → empty signals. Idempotent.
 */
export function extractIdentitySignals(text: string | null | undefined): IdentitySignals {
  if (!text || !text.trim()) return emptyIdentitySignals();
  return {
    fandoms: matchUnique(text, FANDOM_PATTERNS),
    interests: matchUnique(text, INTEREST_PATTERNS),
  };
}

/**
 * Merge two signal sets without duplicates. Used when accumulating
 * across multiple chat turns — the Person row's stored fandoms /
 * interests are the union of everything ever extracted from that
 * session, not just the latest turn.
 *
 * Case-insensitive dedup so "Anime" and "anime" don't both land.
 * Keeps the FIRST canonical capitalization (so once a fandom has
 * been stored as "K-pop", future turns that say "kpop" preserve
 * "K-pop").
 */
export function mergeIdentitySignals(
  existing: IdentitySignals,
  incoming: IdentitySignals,
): IdentitySignals {
  return {
    fandoms: unionCaseInsensitive(existing.fandoms, incoming.fandoms),
    interests: unionCaseInsensitive(existing.interests, incoming.interests),
  };
}

function matchUnique(text: string, patterns: Array<[RegExp, string]>): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const [pattern, label] of patterns) {
    if (pattern.test(text)) {
      const key = label.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        found.push(label);
      }
    }
  }
  return found;
}

function unionCaseInsensitive(...lists: string[][]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const item of list) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
}

// Exported only for tests that want to verify the patterns directly.
export const __INTERNAL = {
  FANDOM_PATTERNS,
  INTEREST_PATTERNS,
  EMPTY_SIGNALS,
};
