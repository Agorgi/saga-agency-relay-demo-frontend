export type NormalizedLocation = {
  raw: string | null;
  city: string | null;
  metro: string | null;
  neighborhood: string | null;
  region: string | null;
  state: string | null;
  country: string | null;
  remote: boolean;
  confidence: number;
  unknown: boolean;
};

export type LocationFitResult = {
  score: number;
  bucket: "same_neighborhood" | "same_city" | "same_metro" | "regional" | "remote" | "unknown" | "mismatch";
  explanation: string;
};

function clean(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const LOCATION_ALIASES: Array<{
  aliases: string[];
  city: string;
  metro: string;
  neighborhood?: string;
  region: string;
  state: string;
  country: string;
}> = [
  {
    aliases: ["los angeles", "la", "l a"],
    city: "Los Angeles",
    metro: "Los Angeles",
    region: "Southern California",
    state: "CA",
    country: "US",
  },
  {
    aliases: ["silver lake", "silverlake"],
    city: "Los Angeles",
    metro: "Los Angeles",
    neighborhood: "Silver Lake",
    region: "Southern California",
    state: "CA",
    country: "US",
  },
  {
    aliases: ["nyc", "new york", "new york city", "brooklyn", "manhattan"],
    city: "New York City",
    metro: "New York City",
    region: "New York Metro",
    state: "NY",
    country: "US",
  },
  {
    aliases: ["atlanta", "atl"],
    city: "Atlanta",
    metro: "Atlanta",
    region: "Georgia",
    state: "GA",
    country: "US",
  },
  {
    aliases: ["san francisco", "sf", "bay area", "oakland", "berkeley"],
    city: "San Francisco",
    metro: "Bay Area",
    region: "Northern California",
    state: "CA",
    country: "US",
  },
];

export function normalizeLocationText(value?: string | null): NormalizedLocation {
  const raw = value?.trim() || null;
  if (!raw) {
    return {
      raw,
      city: null,
      metro: null,
      neighborhood: null,
      region: null,
      state: null,
      country: null,
      remote: false,
      confidence: 0,
      unknown: true,
    };
  }

  const cleaned = clean(raw);
  if (["remote", "online", "virtual"].includes(cleaned)) {
    return {
      raw,
      city: null,
      metro: null,
      neighborhood: null,
      region: null,
      state: null,
      country: null,
      remote: true,
      confidence: 1,
      unknown: false,
    };
  }

  const match = LOCATION_ALIASES.find((entry) =>
    entry.aliases.some((alias) => {
      const cleanedAlias = clean(alias);
      return cleanedAlias.length <= 3
        ? cleaned === cleanedAlias
        : cleaned.includes(cleanedAlias);
    }),
  );

  if (!match) {
    return {
      raw,
      city: raw,
      metro: null,
      neighborhood: null,
      region: null,
      state: null,
      country: null,
      remote: false,
      confidence: 0.35,
      unknown: true,
    };
  }

  return {
    raw,
    city: match.city,
    metro: match.metro,
    neighborhood: match.neighborhood || null,
    region: match.region,
    state: match.state,
    country: match.country,
    remote: false,
    confidence: match.neighborhood ? 0.95 : 0.9,
    unknown: false,
  };
}

export function computeDistanceBucket(
  candidateLocation?: string | null,
  targetLocation?: string | null,
  options: { remoteAllowed?: boolean } = {},
): LocationFitResult["bucket"] {
  const candidate = normalizeLocationText(candidateLocation);
  const target = normalizeLocationText(targetLocation);
  if (options.remoteAllowed || candidate.remote || target.remote) return "remote";
  if (candidate.unknown || target.unknown) return "unknown";
  if (
    candidate.neighborhood &&
    target.neighborhood &&
    candidate.neighborhood === target.neighborhood
  ) {
    return "same_neighborhood";
  }
  if (candidate.city && candidate.city === target.city) return "same_city";
  if (candidate.metro && candidate.metro === target.metro) return "same_metro";
  if (candidate.region && candidate.region === target.region) return "regional";
  return "mismatch";
}

export function computeLocationFit(
  candidateLocation?: string | null,
  targetLocation?: string | null,
  options: { remoteAllowed?: boolean } = {},
): LocationFitResult {
  const bucket = computeDistanceBucket(candidateLocation, targetLocation, options);
  const scoreByBucket: Record<LocationFitResult["bucket"], number> = {
    same_neighborhood: 1,
    same_city: 0.9,
    same_metro: 0.8,
    regional: 0.55,
    remote: 0.65,
    unknown: 0.2,
    mismatch: 0,
  };
  return {
    bucket,
    score: scoreByBucket[bucket],
    explanation: explainLocationFit(candidateLocation, targetLocation, options),
  };
}

export function explainLocationFit(
  candidateLocation?: string | null,
  targetLocation?: string | null,
  options: { remoteAllowed?: boolean } = {},
) {
  const bucket = computeDistanceBucket(candidateLocation, targetLocation, options);
  if (bucket === "same_neighborhood") return "Candidate and project share a known neighborhood.";
  if (bucket === "same_city") return "Candidate and project are in the same city.";
  if (bucket === "same_metro") return "Candidate and project are in the same metro area.";
  if (bucket === "regional") return "Candidate and project are in the same broader region.";
  if (bucket === "remote") return "Remote or online participation is acceptable.";
  if (bucket === "unknown") return "Location evidence is incomplete and should not be guessed.";
  return "No deterministic location match found.";
}
