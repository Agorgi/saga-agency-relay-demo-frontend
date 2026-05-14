export type TagCategory =
  | "role"
  | "skill"
  | "fandom"
  | "community"
  | "city"
  | "format"
  | "event_type";

export type NormalizedTag = {
  input: string;
  canonical: string;
  categories: TagCategory[];
  parents: string[];
  aliases: string[];
  confidence: number;
  inferred: boolean;
};

type TaxonomyEntry = {
  canonical: string;
  aliases: string[];
  categories: TagCategory[];
  parents?: string[];
};

const TAG_TAXONOMY: TaxonomyEntry[] = [
  {
    canonical: "Jujutsu Kaisen",
    aliases: ["jjk", "jujutsu kaisen"],
    categories: ["fandom"],
    parents: ["anime"],
  },
  {
    canonical: "Love and Deepspace",
    aliases: ["love and deepspace", "lad", "love & deepspace"],
    categories: ["fandom"],
    parents: ["otome game", "anime-adjacent gaming"],
  },
  {
    canonical: "Maid Cafe",
    aliases: ["maid gigs", "maid cafe", "cosplay host", "maid host"],
    categories: ["community", "event_type"],
    parents: ["cosplay", "performance"],
  },
  {
    canonical: "Cosplay Photographer",
    aliases: ["cosplay photographer", "cosplay photography", "anime event photographer"],
    categories: ["role", "skill"],
    parents: ["photography", "cosplay"],
  },
  {
    canonical: "Artist Alley",
    aliases: ["artist alley", "convention vendor", "artist vendor"],
    categories: ["community", "format"],
    parents: ["illustrator", "convention vendor"],
  },
  {
    canonical: "Illustrator",
    aliases: ["illustrator", "fan artist", "artist"],
    categories: ["role", "skill"],
    parents: ["visual art"],
  },
  {
    canonical: "DJ",
    aliases: ["dj", "anime rave dj", "rave dj"],
    categories: ["role", "skill"],
    parents: ["music", "performance"],
  },
  {
    canonical: "Cosplay",
    aliases: ["cosplay", "cosplayer", "cosplay community"],
    categories: ["fandom", "community"],
    parents: ["anime"],
  },
  {
    canonical: "Anime",
    aliases: ["anime", "anime fandom"],
    categories: ["fandom", "community"],
  },
];

function cleanTag(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
    .join(" ");
}

function findEntry(value: string) {
  const cleaned = cleanTag(value);
  return TAG_TAXONOMY.find((entry) =>
    [entry.canonical, ...entry.aliases].some((alias) => cleanTag(alias) === cleaned),
  );
}

export function normalizeTag(
  value: string,
  options: { categoryHint?: TagCategory; inferred?: boolean } = {},
): NormalizedTag {
  const entry = findEntry(value);
  const inferred = Boolean(options.inferred);
  if (entry) {
    return {
      input: value,
      canonical: entry.canonical,
      categories: entry.categories,
      parents: entry.parents || [],
      aliases: entry.aliases,
      confidence: inferred ? 0.65 : 1,
      inferred,
    };
  }

  return {
    input: value,
    canonical: titleCase(cleanTag(value)),
    categories: options.categoryHint ? [options.categoryHint] : [],
    parents: [],
    aliases: [value],
    confidence: inferred ? 0.45 : 0.75,
    inferred,
  };
}

export function expandTagAliases(tags: string[]) {
  return [
    ...new Set(
      tags.flatMap((tag) => {
        const normalized = normalizeTag(tag);
        return [normalized.canonical, ...normalized.aliases, ...normalized.parents].filter(Boolean);
      }),
    ),
  ];
}

function normalizedSet(tags: string[], inferred = false) {
  return new Map(
    tags.map((tag) => {
      const normalized = normalizeTag(tag, { inferred });
      return [cleanTag(normalized.canonical), normalized] as const;
    }),
  );
}

export function computeTagOverlap(input: {
  candidateTags: string[];
  targetTags: string[];
  candidateTagsInferred?: boolean;
  targetTagsInferred?: boolean;
}) {
  const candidate = normalizedSet(input.candidateTags, input.candidateTagsInferred);
  const target = normalizedSet(input.targetTags, input.targetTagsInferred);
  const candidateExpanded = new Map(
    [...candidate.values()].flatMap((tag) =>
      [tag.canonical, ...tag.parents].map((value) => [cleanTag(value), tag] as const),
    ),
  );
  const matchedTags = [...target.values()].filter((tag) =>
    [tag.canonical, ...tag.parents].some((value) => candidateExpanded.has(cleanTag(value))),
  );
  const max = Math.max(target.size, 1);
  const confidence =
    matchedTags.reduce((sum, tag) => sum + tag.confidence, 0) / Math.max(matchedTags.length, 1);
  const score = matchedTags.length === 0 ? 0 : Math.min(1, (matchedTags.length / max) * confidence);

  return {
    matchedTags: matchedTags.map((tag) => tag.canonical),
    missingTags: [...target.values()]
      .filter((tag) => !matchedTags.some((match) => match.canonical === tag.canonical))
      .map((tag) => tag.canonical),
    score: Number(score.toFixed(2)),
  };
}

export function computeFandomFit(input: {
  candidateFandomTags: string[];
  targetFandomTags: string[];
  inferredCandidateTags?: boolean;
}) {
  return computeTagOverlap({
    candidateTags: input.candidateFandomTags,
    targetTags: input.targetFandomTags,
    candidateTagsInferred: input.inferredCandidateTags,
  });
}

export function computeRoleFitFromTags(input: {
  candidateRoleTags: string[];
  targetRoleTags: string[];
  inferredCandidateTags?: boolean;
}) {
  return computeTagOverlap({
    candidateTags: input.candidateRoleTags,
    targetTags: input.targetRoleTags,
    candidateTagsInferred: input.inferredCandidateTags,
  });
}

export function explainTagMatch(input: {
  candidateTags: string[];
  targetTags: string[];
  inferredCandidateTags?: boolean;
}) {
  const overlap = computeTagOverlap(input);
  if (overlap.matchedTags.length === 0) {
    return "No evidence-backed tag overlap found.";
  }
  const inferredNote = input.inferredCandidateTags
    ? " Candidate tags are inferred, so confidence is lower."
    : "";
  return `Matched ${overlap.matchedTags.join(", ")} with score ${overlap.score}.${inferredNote}`;
}
