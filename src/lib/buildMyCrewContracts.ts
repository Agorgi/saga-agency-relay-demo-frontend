import { getRecommendationsForRole } from "@/data/sagaAgencyData";
import type { WebChatPrefill } from "@/lib/webChatNextStep";
import type {
  AvailabilitySignal,
  CreativeProject,
  TalentFilters,
  TalentRecommendation,
} from "@/types/sagaAgency";

export type CrewReviewStatus =
  | "Needs review"
  | "Shortlist draft"
  | "Outreach gated"
  | "Reply demo only"
  | "Terms demo only"
  | "Needs admin review"
  | "Legacy demo record"
  | "Availability unconfirmed"
  | "Set aside";

export type CrewContactabilityStatus = "Human review required";
export type CrewSourceMode = "brief_handoff" | "saved_project" | "demo_seed";

export interface SuggestedRoleForUI {
  id: string;
  role: string;
  rationale: string;
  sourceMode: CrewSourceMode;
}

export interface ProjectBriefForUI {
  title: string;
  projectIdea: string;
  city: string;
  dateWindow: string;
  scale: string;
  vibeTags: string[];
  suggestedRoles: SuggestedRoleForUI[];
  sourceMode: Exclude<CrewSourceMode, "demo_seed">;
}

export interface CrewCandidateForUI {
  id: string;
  name: string;
  role: string;
  location: string;
  whyThisPersonMayFit: string;
  evidence: string;
  reviewStatus: CrewReviewStatus;
  contactabilityStatus: CrewContactabilityStatus;
  sourceMode: CrewSourceMode;
  contacted: false;
  confirmed: false;
  imageSrc: string;
  availabilityLabel: string;
}

export interface CrewRecommendationState {
  brief: ProjectBriefForUI | null;
  suggestedRoles: SuggestedRoleForUI[];
  candidateGroups: Array<{
    role: SuggestedRoleForUI;
    candidates: CrewCandidateForUI[];
  }>;
  noOneContactedDisclaimer: string;
}

export const PROJECT_BRIEF_EMPTY_STATE = {
  title: "Start with Sagasan.",
  subhead: "Start in chat first.",
  helper:
    "Sagasan builds the brief with you first, then this page turns that context into a reviewable draft.",
  ctaLabel: "Talk to Sagasan",
} as const;

function sentenceCase(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function toTitleCase(input: string) {
  return sentenceCase(input).replace(/\b\w/g, (char) => char.toUpperCase());
}

function splitVibeTags(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(/[,\u00b7]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function getCandidateImage(candidate: TalentRecommendation) {
  return candidate.avatar || candidate.portfolioImages[0] || "/branding/saga-mark-cobalt.png";
}

function getReviewStatus(candidate: TalentRecommendation): CrewReviewStatus {
  switch (candidate.candidateStatus) {
    case "shortlisted":
      return "Shortlist draft";
    case "saga-contacted":
      return "Outreach gated";
    case "replied":
      return "Reply demo only";
    case "negotiating":
      return "Terms demo only";
    case "terms-ready":
      return "Needs admin review";
    case "booked":
      return "Legacy demo record";
    case "unavailable":
      return "Availability unconfirmed";
    case "passed":
      return "Set aside";
    case "suggested":
    default:
      return "Needs review";
  }
}

function getAvailabilityLabel(signal: AvailabilitySignal) {
  switch (signal) {
    case "available":
      return "Availability review";
    case "maybe":
      return "Timing to review";
    case "busy":
      return "Likely busy";
    case "unknown":
    default:
      return "Availability unknown";
  }
}

function getRoleRationale(
  role: string,
  brief: Pick<ProjectBriefForUI, "projectIdea" | "vibeTags">,
  prefill: WebChatPrefill | null,
) {
  const lowerRole = role.toLowerCase();
  const vibeCue = brief.vibeTags[0];
  const helpNeeded =
    typeof prefill?.helpNeeded === "string" ? prefill.helpNeeded.toLowerCase() : "";

  if (helpNeeded.includes(lowerRole)) {
    return `Saga flagged ${lowerRole} support because you asked for it directly.`;
  }

  if (vibeCue) {
    return `This brief likely needs ${lowerRole} support to carry the ${vibeCue.toLowerCase()} direction.`;
  }

  return `This project likely needs ${lowerRole} support to turn the brief into a real production plan.`;
}

function matchesCandidateFilters(
  candidate: TalentRecommendation,
  role: string,
  searchQuery: string,
  filters: TalentFilters,
) {
  const search = searchQuery.trim().toLowerCase();
  const searchMatch =
    !search ||
    `${candidate.name} ${candidate.city} ${role} ${candidate.tags.join(" ")} ${candidate.credits.join(" ")}`
      .toLowerCase()
      .includes(search);
  const roleMatch =
    filters.role === "All roles" || filters.role.toLowerCase() === role.toLowerCase();
  const cityMatch =
    filters.city === "All cities" ||
    candidate.city.toLowerCase().includes(filters.city.toLowerCase());
  const projectTypeMatch =
    filters.projectType === "All" ||
    candidate.projectTypes.includes(filters.projectType);
  const tagMatch =
    filters.tag === "All tags" ||
    candidate.tags.some((tag) => tag.toLowerCase().includes(filters.tag.toLowerCase()));
  const availabilityMatch =
    filters.availability === "all" ||
    candidate.availabilitySignal === filters.availability;
  const budgetMatch =
    filters.budget === "All budgets" ||
    candidate.rateRange.toLowerCase().includes(filters.budget.toLowerCase());

  return (
    searchMatch &&
    roleMatch &&
    cityMatch &&
    projectTypeMatch &&
    tagMatch &&
    availabilityMatch &&
    budgetMatch
  );
}

function getCandidateRationale(
  candidate: TalentRecommendation,
  project: CreativeProject,
  role: string,
) {
  const evidence =
    candidate.whySagaMatched.find(Boolean) ||
    candidate.tags[0] ||
    candidate.credits[0] ||
    `${role} review`;

  const reason =
    candidate.whySagaMatched.find(
      (line) =>
        !/strong portfolio fit|saga ranks them highly/i.test(line),
    ) || candidate.whySagaMatched[0];

  if (reason) {
    return `${candidate.name} may fit the ${role.toLowerCase()} lane for ${project.title} because ${reason
      .replace(/\.$/, "")
      .toLowerCase()}.`;
  }

  return `${candidate.name} may fit the ${role.toLowerCase()} lane for ${project.title} based on ${evidence.toLowerCase()}.`;
}

function getCandidateEvidence(candidate: TalentRecommendation) {
  return (
    candidate.credits[0] ||
    candidate.tags[0] ||
    candidate.projectTypes[0] ||
    "Seeded demo profile"
  );
}

export function buildProjectBriefForUI(
  project: CreativeProject | null,
  prefill: WebChatPrefill | null | undefined,
): ProjectBriefForUI | null {
  if (!project) {
    return null;
  }

  const sourceMode: Exclude<CrewSourceMode, "demo_seed"> =
    prefill && Object.keys(prefill).length > 0 ? "brief_handoff" : "saved_project";
  const projectIdea =
    typeof prefill?.projectIdea === "string" && prefill.projectIdea.trim()
      ? prefill.projectIdea.trim()
      : project.title;
  const city =
    typeof prefill?.city === "string" && prefill.city.trim()
      ? prefill.city.trim()
      : project.city;
  const dateWindow =
    typeof prefill?.date === "string" && prefill.date.trim()
      ? prefill.date.trim()
      : project.dateLabel;
  const scale =
    typeof prefill?.expectedAttendance === "string" && prefill.expectedAttendance.trim()
      ? prefill.expectedAttendance.trim()
      : typeof prefill?.scale === "string" && prefill.scale.trim()
        ? prefill.scale.trim()
        : "Not specified yet";
  const vibeTags = splitVibeTags(
    typeof prefill?.themeVibe === "string"
      ? prefill.themeVibe
      : typeof prefill?.vibe === "string"
        ? prefill.vibe
        : project.description,
  );
  const roleNames =
    Array.isArray(prefill?.desiredTalentRoles) && prefill.desiredTalentRoles.length > 0
      ? prefill.desiredTalentRoles
      : Array.isArray(prefill?.suggestedRoles) && prefill.suggestedRoles.length > 0
        ? prefill.suggestedRoles
        : project.requiredRoles.map((role) => role.name);

  const briefBase = {
    projectIdea: sentenceCase(projectIdea),
    vibeTags,
  } satisfies Pick<ProjectBriefForUI, "projectIdea" | "vibeTags">;

  const suggestedRoles = roleNames.slice(0, 8).map((role) => ({
    id: `${project.id}-${role.toLowerCase().replace(/\s+/g, "-")}`,
    role,
    rationale: getRoleRationale(role, briefBase, prefill || null),
    sourceMode,
  }));

  return {
    title: toTitleCase(project.title),
    projectIdea: briefBase.projectIdea,
    city: sentenceCase(city),
    dateWindow: sentenceCase(dateWindow),
    scale: sentenceCase(scale),
    vibeTags,
    suggestedRoles,
    sourceMode,
  };
}

function toCrewCandidateForUI(
  candidate: TalentRecommendation,
  project: CreativeProject,
  role: SuggestedRoleForUI,
): CrewCandidateForUI {
  return {
    id: candidate.id,
    name: candidate.name,
    role: role.role,
    location: candidate.city,
    whyThisPersonMayFit: getCandidateRationale(candidate, project, role.role),
    evidence: getCandidateEvidence(candidate),
    reviewStatus: getReviewStatus(candidate),
    contactabilityStatus: "Human review required",
    sourceMode: "demo_seed",
    contacted: false,
    confirmed: false,
    imageSrc: getCandidateImage(candidate),
    availabilityLabel: getAvailabilityLabel(candidate.availabilitySignal),
  };
}

export function buildCrewRecommendationState({
  project,
  prefill,
  searchQuery,
  filters,
}: {
  project: CreativeProject | null;
  prefill: WebChatPrefill | null | undefined;
  searchQuery: string;
  filters: TalentFilters;
}): CrewRecommendationState {
  const brief = buildProjectBriefForUI(project, prefill);
  if (!project || !brief) {
    return {
      brief: null,
      suggestedRoles: [],
      candidateGroups: [],
      noOneContactedDisclaimer:
        "No one has been contacted or confirmed. These are demo recommendations for human review only.",
    };
  }

  const candidateGroups = brief.suggestedRoles
    .filter((role) => filters.role === "All roles" || filters.role === role.role)
    .map((role) => {
      const candidates = getRecommendationsForRole(project, role.role, 6)
        .filter((candidate) =>
          matchesCandidateFilters(candidate, role.role, searchQuery, filters),
        )
        .map((candidate) => toCrewCandidateForUI(candidate, project, role));

      return {
        role,
        candidates,
      };
    });

  return {
    brief,
    suggestedRoles: brief.suggestedRoles,
    candidateGroups,
    noOneContactedDisclaimer:
      "No one here is contacted, confirmed, available, or booked yet. Saga is only surfacing demo candidates for human review.",
  };
}
