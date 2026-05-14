import { normalizeTag } from "@/lib/graph/tagTaxonomy";

function clean(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export type FandomCommunityFitResult = {
  score: number;
  matchedTags: string[];
  aliasMatches: string[];
  parentCategoryMatches: string[];
  inferredMatches: string[];
  evidenceStrength: "none" | "weak" | "medium" | "strong";
  explanation: string;
};

export function computeFandomCommunityFit(input: {
  projectTags: string[];
  candidateTags: string[];
  candidateTagsInferred?: boolean;
  evidence?: string[];
}): FandomCommunityFitResult {
  const project = input.projectTags.map((tag) => normalizeTag(tag, { categoryHint: "fandom" }));
  const candidate = input.candidateTags.map((tag) =>
    normalizeTag(tag, {
      categoryHint: "fandom",
      inferred: input.candidateTagsInferred,
    }),
  );
  const exact = candidate.filter((candidateTag) =>
    project.some((projectTag) => clean(projectTag.canonical) === clean(candidateTag.canonical)),
  );
  const aliasMatches = candidate.filter((candidateTag) =>
    project.some((projectTag) =>
      [projectTag.input, ...projectTag.aliases]
        .map(clean)
        .some((projectAlias) =>
          [candidateTag.input, ...candidateTag.aliases].map(clean).includes(projectAlias),
        ),
    ),
  );
  const parentCategoryMatches = candidate.filter((candidateTag) =>
    candidateTag.parents.some((parent) =>
      project.some((projectTag) =>
        [projectTag.canonical, ...projectTag.parents].map(clean).includes(clean(parent)),
      ),
    ),
  );
  const inferredMatches = input.candidateTagsInferred
    ? [...new Set([...exact, ...aliasMatches, ...parentCategoryMatches].map((tag) => tag.canonical))]
    : [];

  const exactScore = exact.length * 0.5;
  const aliasScore = aliasMatches.length * 0.4;
  const parentScore = parentCategoryMatches.length * 0.25;
  const evidenceBoost = (input.evidence || []).length > 0 ? 0.1 : 0;
  const inferencePenalty = input.candidateTagsInferred ? 0.75 : 1;
  const score = Math.min(15, Math.round((exactScore + aliasScore + parentScore + evidenceBoost) * 15 * inferencePenalty));
  const evidenceStrength =
    score >= 11 ? "strong" : score >= 7 ? "medium" : score > 0 ? "weak" : "none";
  const matchedTags = [
    ...new Set([...exact, ...aliasMatches, ...parentCategoryMatches].map((tag) => tag.canonical)),
  ];
  const explanation =
    matchedTags.length === 0
      ? "No evidence-backed fandom or community overlap found."
      : `Fandom/community affinity from ${matchedTags.join(", ")}. ${
          input.candidateTagsInferred
            ? "Candidate tags are public/inferred, so confidence is lower."
            : "Candidate tags are internal or reviewed evidence."
        }`;

  return {
    score,
    matchedTags,
    aliasMatches: [...new Set(aliasMatches.map((tag) => tag.canonical))],
    parentCategoryMatches: [...new Set(parentCategoryMatches.map((tag) => tag.canonical))],
    inferredMatches,
    evidenceStrength,
    explanation,
  };
}
