import { computeLocationFit } from "@/lib/graph/locationNormalization";

export type RoleLocationStrictness =
  | "LOCAL_REQUIRED"
  | "LOCAL_STRONGLY_PREFERRED"
  | "REGIONAL_PREFERRED"
  | "REMOTE_ACCEPTABLE";

export type RoleLocationFit = {
  score: number;
  strictness: RoleLocationStrictness;
  bucket: ReturnType<typeof computeLocationFit>["bucket"];
  explanation: string;
  penalty: number;
};

const ROLE_LOCATION_DEFAULTS: Array<{
  patterns: RegExp[];
  strictness: RoleLocationStrictness;
}> = [
  { patterns: [/venue owner/i, /^venue$/i, /venue partner/i], strictness: "LOCAL_REQUIRED" },
  { patterns: [/volunteer coordinator/i], strictness: "LOCAL_REQUIRED" },
  { patterns: [/photographer/i, /videographer/i], strictness: "LOCAL_STRONGLY_PREFERRED" },
  { patterns: [/\bdj\b/i, /guest cosplayer/i], strictness: "REGIONAL_PREFERRED" },
  { patterns: [/illustrator/i, /graphic designer/i, /designer/i], strictness: "REMOTE_ACCEPTABLE" },
  { patterns: [/social/i, /content creator/i], strictness: "REMOTE_ACCEPTABLE" },
];

export function getRoleLocationRequirement(input: {
  role: string;
  roleMapLocalRequired?: boolean;
}): RoleLocationStrictness {
  if (input.roleMapLocalRequired) return "LOCAL_REQUIRED";
  const match = ROLE_LOCATION_DEFAULTS.find((item) =>
    item.patterns.some((pattern) => pattern.test(input.role)),
  );
  return match?.strictness || "REGIONAL_PREFERRED";
}

export function computeRoleAwareLocationFit(input: {
  role: string;
  candidateLocation?: string | null;
  projectLocation?: string | null;
  roleMapLocalRequired?: boolean;
}) : RoleLocationFit {
  const strictness = getRoleLocationRequirement(input);
  const remoteAllowed = strictness === "REMOTE_ACCEPTABLE";
  const location = computeLocationFit(input.candidateLocation, input.projectLocation, {
    remoteAllowed,
  });
  const baseScore = Math.round(location.score * 15);
  let penalty = 0;

  if (strictness === "LOCAL_REQUIRED") {
    if (location.bucket === "same_neighborhood" || location.bucket === "same_city") penalty = 0;
    else if (location.bucket === "same_metro") penalty = 3;
    else if (location.bucket === "unknown") penalty = 8;
    else penalty = 15;
  } else if (strictness === "LOCAL_STRONGLY_PREFERRED") {
    if (location.bucket === "same_city" || location.bucket === "same_metro") penalty = 0;
    else if (location.bucket === "regional") penalty = 4;
    else if (location.bucket === "unknown") penalty = 6;
    else penalty = 10;
  } else if (strictness === "REGIONAL_PREFERRED") {
    if (location.bucket === "mismatch") penalty = 7;
    else if (location.bucket === "unknown") penalty = 4;
  } else if (strictness === "REMOTE_ACCEPTABLE") {
    penalty = 0;
  }

  const score = Math.max(0, Math.min(15, baseScore - penalty));
  const roleNote =
    strictness === "LOCAL_REQUIRED"
      ? "This role is local-required."
      : strictness === "LOCAL_STRONGLY_PREFERRED"
        ? "This role strongly prefers local candidates."
        : strictness === "REGIONAL_PREFERRED"
          ? "This role prefers local or regional candidates."
          : "This role can be remote when scope supports it.";

  return {
    score,
    strictness,
    bucket: location.bucket,
    penalty,
    explanation: `${roleNote} ${location.explanation}`,
  };
}
