import type {
  Prisma,
  PublicWebResearchJobStatus,
  PublicWebResearchRunMode as PrismaPublicWebResearchRunMode,
  PublicWebResearchResultStatus,
  TalentResearchSourceReliability,
} from "@prisma/client";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";
import { safeLlmHealth } from "@/sms-engine/llm/llmProvider";
import { logServerError } from "@/sms-engine/safeLogging";
import { getSmsSafetyHealth } from "@/sms-engine/smsSafety";
import {
  createTalentResearchReviewForCandidate,
} from "@/sms-engine/sourcing/talentResearchQuality";
import {
  candidateCardSchema,
  contactabilityAuditEvents,
  publicResearchCandidateCardSchema,
  publicWebResearchAuditEvents,
  sourcingAuditEvents,
  type CandidateCard,
  type PublicResearchCandidateCard,
} from "@/sms-engine/sourcing/talentTypes";
import {
  evaluatePublicWebResearchSafety,
  publicWebResearchRiskLevel,
} from "@/sms-engine/sourcing/publicWebResearchSafety";
import { parseDomainList } from "@/sms-engine/sourcing/publicWebQueryBuilder";
import { buildPublicWebLiveDryRunRequest } from "@/sms-engine/sourcing/publicWebLiveDryRunFixture";
import {
  evaluateContactabilityEvidence,
  extractContactabilityEvidenceFromCandidate,
} from "@/sms-engine/sourcing/contactabilityEvidence";
import { scorePublicWebSourceQuality } from "@/sms-engine/sourcing/sourceQuality";

export type PublicWebResearchMode =
  | "disabled"
  | "shadow"
  | "live_dry_run"
  | "admin_active";
export type PublicWebResearchProviderName = "openai_web_search" | "none";

export type PublicWebResearchRequest = {
  projectBriefId?: string | null;
  projectId?: string | null;
  roleOpeningId?: string | null;
  searchRunId?: string | null;
  sourceTag?: string | null;
  queryPlan: string[];
  roleTargets: Array<{ role: string; city?: string | null; criteria?: string[] }>;
  allowedDomains?: string[];
  blockedDomains?: string[];
};

export type PublicWebResearchSource = {
  url: string;
  title?: string | null;
};

export type PublicWebResearchProviderResponse = {
  candidates: PublicResearchCandidateCard[];
  sources?: PublicWebResearchSource[];
  responseId?: string | null;
  warnings?: string[];
};

export type PublicWebResearchProviderDiagnostic = {
  provider: PublicWebResearchProviderName | "openai_web_search";
  operation:
    | "web_search"
    | "candidate_card_extraction"
    | "provider_response_validation";
  model: string;
  statusCode?: number | null;
  errorCategory:
    | "invalid_schema"
    | "invalid_request"
    | "model_not_found"
    | "auth_error"
    | "rate_limit"
    | "timeout"
    | "provider_5xx"
    | "network_error"
    | "invalid_structured_output"
    | "unknown";
  redactedMessageSnippet?: string | null;
  requestMode: PublicWebResearchMode;
  structuredOutputRequested: boolean;
  webSearchRequested: boolean;
};

export type PublicWebResearchProvider = (
  request: PublicWebResearchRequest,
) => Promise<
  PublicWebResearchProviderResponse | PublicResearchCandidateCard[] | CandidateCard[]
>;

export type PublicWebResearchFailureCategory =
  | "provider_timeout"
  | "provider_4xx"
  | "provider_5xx"
  | "provider_rate_limit"
  | "invalid_schema"
  | "invalid_request"
  | "model_not_found"
  | "auth_error"
  | "network_error"
  | "invalid_citation_set"
  | "invalid_structured_output"
  | "safety_blocked"
  | "gate_blocked"
  | "no_results"
  | "database_not_configured"
  | "provider_not_injected"
  | "unknown";

function booleanEnv(value: string | undefined, fallback = false) {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function intEnv(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function modeEnv(value: string | undefined): PublicWebResearchMode {
  if (value === "shadow" || value === "live_dry_run" || value === "admin_active") {
    return value;
  }
  return "disabled";
}

function providerEnv(value: string | undefined): PublicWebResearchProviderName {
  return value === "openai_web_search" ? "openai_web_search" : "none";
}

function getPublicWebResearchLiveDryRunEnvBlockers(input: {
  provider: PublicWebResearchProviderName;
  liveDryRunAllowed: boolean;
}) {
  const llm = safeLlmHealth();
  const sms = getSmsSafetyHealth();
  return [
    !input.liveDryRunAllowed ? "live_dry_run_not_allowed" : null,
    input.provider === "openai_web_search" && !process.env.OPENAI_API_KEY
      ? "missing_openai_api_key"
      : null,
    llm.providerEffective !== "openai" ? "llm_provider_not_openai" : null,
    llm.activeLiveAllowed ? "active_live_must_remain_disabled" : null,
    !sms.sendsDisabled ? "sms_sends_must_remain_disabled" : null,
  ].filter((item): item is string => Boolean(item));
}

export function getPublicWebResearchConfig() {
  const enabled = booleanEnv(process.env.PUBLIC_WEB_RESEARCH_ENABLED, false);
  const requestedMode = modeEnv(process.env.PUBLIC_WEB_RESEARCH_MODE);
  const mode: PublicWebResearchMode = enabled ? requestedMode : "disabled";
  const provider = providerEnv(process.env.PUBLIC_WEB_RESEARCH_PROVIDER);
  const requireCitations = booleanEnv(
    process.env.PUBLIC_WEB_RESEARCH_REQUIRE_CITATIONS,
    true,
  );
  const allowedDomains = parseDomainList(
    process.env.PUBLIC_WEB_RESEARCH_ALLOWED_DOMAINS,
  );
  const blockedDomains = parseDomainList(
    process.env.PUBLIC_WEB_RESEARCH_BLOCKED_DOMAINS,
  );
  const liveDryRunAllowed = booleanEnv(
    process.env.PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_ALLOWED,
    false,
  );
  const liveDryRunMaxQueries = intEnv(
    process.env.PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_MAX_QUERIES,
    1,
  );
  const liveDryRunTag =
    process.env.PUBLIC_WEB_RESEARCH_LIVE_DRY_RUN_TAG || "live_dry_run";
  const maxResults = intEnv(
    process.env.PUBLIC_WEB_RESEARCH_MAX_RESULTS,
    mode === "live_dry_run" ? 5 : 10,
  );
  const providerRequired =
    mode === "live_dry_run" || mode === "admin_active";
  const liveEnvBlockers = getPublicWebResearchLiveDryRunEnvBlockers({
    provider,
    liveDryRunAllowed,
  });
  const blockers = [
    !enabled ? "public_web_research_disabled" : null,
    mode === "disabled" ? "mode_disabled" : null,
    mode === "admin_active" ? "admin_active_future_mode_blocked" : null,
    providerRequired && provider === "none" ? "provider_none" : null,
    providerRequired &&
    provider === "openai_web_search" &&
    !process.env.OPENAI_API_KEY
      ? "missing_openai_api_key"
      : null,
    !requireCitations ? "citations_not_required" : null,
    ...(mode === "live_dry_run" ? liveEnvBlockers : []),
  ].filter((item): item is string => Boolean(item));
  const uniqueBlockers = [...new Set(blockers)];

  return {
    publicWebResearchShadowAvailable: true,
    publicWebResearchLiveDryRunAvailable: true,
    publicWebResearchAsyncAvailable: true,
    publicWebResearchEnabled: enabled,
    publicWebResearchMode: mode,
    publicWebResearchProvider: provider,
    publicWebResearchMaxResults: maxResults,
    publicWebResearchRequireCitations: requireCitations,
    publicWebResearchStoreRawResults: booleanEnv(
      process.env.PUBLIC_WEB_RESEARCH_STORE_RAW_RESULTS,
      false,
    ),
    publicWebResearchLiveDryRunAllowed: liveDryRunAllowed,
    publicWebResearchLiveDryRunMaxQueries: liveDryRunMaxQueries,
    publicWebResearchLiveDryRunTag: liveDryRunTag,
    publicWebResearchAllowedDomains: allowedDomains,
    publicWebResearchBlockedDomains: blockedDomains,
    publicWebResearchReady:
      uniqueBlockers.length === 0 &&
      (mode === "shadow" || mode === "live_dry_run"),
    publicWebResearchBlockers: uniqueBlockers,
    publicWebResearchBlockerCount: uniqueBlockers.length,
  };
}

export function evaluatePublicWebResearchLiveDryRunReadiness(input?: {
  request?: PublicWebResearchRequest;
  adminTriggered?: boolean;
  demoSafe?: boolean;
  requireActionGate?: boolean;
}) {
  const config = getPublicWebResearchConfig();
  const blockers = [...config.publicWebResearchBlockers];
  const warnings: string[] = [];
  if (config.publicWebResearchMode !== "live_dry_run") {
    blockers.push("mode_not_live_dry_run");
  }
  if (input?.requireActionGate) {
    if (!input.adminTriggered) blockers.push("admin_action_required");
    if (!input.demoSafe) blockers.push("demo_safe_fixture_required");
  }
  if (
    input?.request &&
    input.request.queryPlan.length >
      config.publicWebResearchLiveDryRunMaxQueries
  ) {
    blockers.push("live_dry_run_query_cap_exceeded");
  }
  if (
    input?.request &&
    input.request.sourceTag !== config.publicWebResearchLiveDryRunTag
  ) {
    blockers.push("live_dry_run_source_tag_required");
  }
  if (config.publicWebResearchMaxResults > 5) {
    warnings.push("live_dry_run_max_results_above_default");
  }

  return {
    allowed: blockers.length === 0,
    blockers: [...new Set(blockers)],
    warnings,
    config,
  };
}

export function publicWebResearchErrorCategory(
  error: unknown,
): PublicWebResearchFailureCategory {
  const diagnostic = providerDiagnosticFromError(error);
  if (diagnostic) {
    if (diagnostic.errorCategory === "timeout") return "provider_timeout";
    if (diagnostic.errorCategory === "rate_limit") return "provider_rate_limit";
    if (diagnostic.errorCategory === "provider_5xx") return "provider_5xx";
    if (diagnostic.errorCategory === "invalid_structured_output") {
      return "invalid_structured_output";
    }
    return diagnostic.errorCategory;
  }
  const message =
    error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/invalid_schema/i.test(message)) return "invalid_schema";
  if (/invalid_request/i.test(message)) return "invalid_request";
  if (/model_not_found|model not found/i.test(message)) return "model_not_found";
  if (/auth_error|authentication|api key/i.test(message)) return "auth_error";
  if (/timeout|timed out|etimedout|abort/i.test(message)) {
    return "provider_timeout";
  }
  if (/rate limit|429/i.test(message)) return "provider_rate_limit";
  if (/\b5\d\d\b|server error|bad gateway|service unavailable/i.test(message)) {
    return "provider_5xx";
  }
  if (/\b4\d\d\b|bad request|unauthorized|forbidden/i.test(message)) {
    return "provider_4xx";
  }
  if (/citation|source url|sourceUrls/i.test(message)) {
    return "invalid_citation_set";
  }
  if (/schema|structured|parse|zod/i.test(message)) {
    return "invalid_structured_output";
  }
  return "unknown";
}

function providerDiagnosticFromError(
  error: unknown,
): PublicWebResearchProviderDiagnostic | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as Record<string, unknown>).providerDiagnostic;
  if (!value || typeof value !== "object") return null;
  const diagnostic = value as Partial<PublicWebResearchProviderDiagnostic>;
  return diagnostic.errorCategory && diagnostic.operation && diagnostic.model
    ? (diagnostic as PublicWebResearchProviderDiagnostic)
    : null;
}

function prismaMode(mode: PublicWebResearchMode): PrismaPublicWebResearchRunMode {
  if (mode === "live_dry_run") return "LIVE_DRY_RUN";
  return mode === "admin_active" ? "ADMIN_ACTIVE" : "SHADOW";
}

function jsonArray(value: unknown): Prisma.InputJsonValue {
  return Array.isArray(value) ? value : [];
}

function jsonObject(value: unknown): Prisma.InputJsonValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toCandidateCard(card: PublicResearchCandidateCard): CandidateCard {
  return candidateCardSchema.parse({
    displayName: card.displayName,
    likelyRole: card.likelyRole,
    city: card.city,
    publicProfileUrls: card.publicProfileUrls,
    portfolioEvidence: card.portfolioEvidence,
    fandomFitEvidence: card.fandomFitEvidence,
    roleFitEvidence: card.roleFitEvidence,
    locationEvidence: card.locationEvidence,
    whyTheyMayFit: card.whyTheyMayFit,
    risks: card.riskFlags,
    missingInfo: card.missingEvidence,
    confidence: card.confidence,
    sourceUrls: card.sourceUrls,
    sourceSummary: card.sourceTitles?.join("; ") || card.sourceUrls.join("; "),
    requiresHumanReview: true,
  });
}

function normalizeProviderResponse(
  response:
    | PublicWebResearchProviderResponse
    | PublicResearchCandidateCard[]
    | CandidateCard[],
) {
  if (Array.isArray(response)) {
    return {
      candidates: response,
      sources: [] as PublicWebResearchSource[],
      responseId: null,
      warnings: [] as string[],
    };
  }

  return {
    candidates: response.candidates,
    sources: response.sources || [],
    responseId: response.responseId || null,
    warnings: response.warnings || [],
  };
}

function normalizeCandidateCard(
  item: PublicResearchCandidateCard | CandidateCard,
): PublicResearchCandidateCard | null {
  const parsedPublic = publicResearchCandidateCardSchema.safeParse(item);
  if (parsedPublic.success) return parsedPublic.data;

  const parsedLegacy = candidateCardSchema.safeParse(item);
  if (!parsedLegacy.success) return null;

  return publicResearchCandidateCardSchema.parse({
    displayName: parsedLegacy.data.displayName,
    likelyRole: parsedLegacy.data.likelyRole,
    city: parsedLegacy.data.city,
    region: null,
    publicProfileUrls: parsedLegacy.data.publicProfileUrls,
    sourceUrls: parsedLegacy.data.sourceUrls,
    sourceTitles: [],
    roleFitEvidence: parsedLegacy.data.roleFitEvidence,
    fandomFitEvidence: parsedLegacy.data.fandomFitEvidence,
    locationEvidence: parsedLegacy.data.locationEvidence,
    portfolioEvidence: parsedLegacy.data.portfolioEvidence,
    recentActivityEvidence: [],
    whyTheyMayFit: parsedLegacy.data.whyTheyMayFit,
    missingEvidence: parsedLegacy.data.missingInfo,
    riskFlags: parsedLegacy.data.risks,
    confidence: parsedLegacy.data.confidence,
    requiresHumanReview: true,
    availabilityKnown: false,
    willingnessKnown: false,
    ratesKnown: false,
    sensitiveDataDetected: false,
    privateSourceDetected: false,
  });
}

function reliabilityForCard(
  card: PublicResearchCandidateCard,
): TalentResearchSourceReliability {
  const allSources = [...card.sourceUrls, ...card.publicProfileUrls].join(" ");
  if (/portfolio|personal|website|behance|dribbble|youtube/i.test(allSources)) {
    return "MEDIUM";
  }
  if (/directory|vendor|convention|event/i.test(allSources)) return "MEDIUM";
  if (card.sourceUrls.length > 1 && card.roleFitEvidence.length > 0) return "MEDIUM";
  if (card.sourceUrls.length > 0) return "LOW";
  return "UNKNOWN";
}

async function auditPublicResearch(input: {
  action: string;
  request: PublicWebResearchRequest;
  mode: PublicWebResearchMode;
  provider: PublicWebResearchProviderName;
  jobId?: string | null;
  count?: number;
  citationCount?: number;
  researchRunId?: string | null;
  resultId?: string | null;
  status?: string | null;
  errorCategory?: string | null;
}) {
  if (!process.env.DATABASE_URL) return;
  await logAudit({
    actorType: "ADMIN",
    action: input.action,
    entityType: input.researchRunId ? "PublicWebResearchRun" : "TalentSearchRun",
    entityId:
      input.researchRunId ||
      input.request.searchRunId ||
      input.request.projectBriefId ||
      "public_research_plan",
    metadata: {
      projectBriefId: input.request.projectBriefId || null,
      projectId: input.request.projectId || null,
      roleOpeningId: input.request.roleOpeningId || null,
      searchRunId: input.request.searchRunId || null,
      researchRunId: input.researchRunId || null,
      jobId: input.jobId || null,
      resultId: input.resultId || null,
      sourceMode: input.mode,
      status: input.status || null,
      provider: input.provider,
      queryCount: input.request.queryPlan.length,
      roleCount: input.request.roleTargets.length,
      resultCount: input.count ?? 0,
      citationCount: input.citationCount ?? 0,
      errorCategory: input.errorCategory || null,
      noSmsSent: true,
      noOutreach: true,
      noGroupChat: true,
      noPrivateSources: true,
    },
  });
}

async function ensureShadowSearchRun(input: {
  request: PublicWebResearchRequest;
  config: ReturnType<typeof getPublicWebResearchConfig>;
  resultCount: number;
  warnings: string[];
}) {
  const db = getDb();
  if (input.request.searchRunId) {
    return db.talentSearchRun.update({
      where: { id: input.request.searchRunId },
      data: {
        status: "NEEDS_REVIEW",
        sourceMode: "WEB_RESEARCH_SHADOW",
        resultCount: { increment: input.resultCount },
        warnings: input.warnings,
      },
    });
  }

  return db.talentSearchRun.create({
    data: {
      projectBriefId: input.request.projectBriefId || null,
      projectId: input.request.projectId || null,
      roleOpeningId: input.request.roleOpeningId || null,
      status: "NEEDS_REVIEW",
      sourceMode: "WEB_RESEARCH_SHADOW",
      querySummary:
        input.config.publicWebResearchMode === "live_dry_run"
          ? "Public web research live dry run"
          : "Public web research shadow run",
      rolesSearched: input.request.roleTargets.map((role) => role.role),
      resultCount: input.resultCount,
      warnings: input.warnings,
    },
  });
}

async function persistShadowResearch(input: {
  request: PublicWebResearchRequest;
  config: ReturnType<typeof getPublicWebResearchConfig>;
  candidates: PublicResearchCandidateCard[];
  providerWarnings: string[];
  safety: Array<ReturnType<typeof evaluatePublicWebResearchSafety>>;
  existingResearchRunId?: string | null;
}) {
  if (!process.env.DATABASE_URL) {
    return {
      researchRunId: null,
      persistedCandidates: false,
      talentCandidateIds: [] as string[],
      resultIds: [] as string[],
    };
  }

  const db = getDb();
  const citations = input.candidates.reduce(
    (count, candidate) => count + candidate.sourceUrls.length,
    0,
  );
  const warnings = [
    ...input.providerWarnings,
    ...input.safety.flatMap((item) => item.warnings),
    ...input.safety.flatMap((item) => item.blockers),
  ];
  const existingRun = input.existingResearchRunId
    ? await db.publicWebResearchRun.findUnique({
        where: { id: input.existingResearchRunId },
      })
    : null;
  const searchRun =
    existingRun?.talentSearchRunId
      ? await db.talentSearchRun.update({
          where: { id: existingRun.talentSearchRunId },
          data: {
            status: "NEEDS_REVIEW",
            sourceMode: "WEB_RESEARCH_SHADOW",
            resultCount: { increment: input.candidates.length },
            warnings,
          },
        })
      : await ensureShadowSearchRun({
          request: input.request,
          config: input.config,
          resultCount: input.candidates.length,
          warnings,
        });
  const run = existingRun
    ? await db.publicWebResearchRun.update({
        where: { id: existingRun.id },
        data: {
          talentSearchRunId: searchRun.id,
          status: input.candidates.length > 0 ? "NEEDS_REVIEW" : "COMPLETED",
          resultCount: input.candidates.length,
          citationCount: citations,
          warnings: jsonArray(warnings),
          errorCategory: null,
          completedAt: new Date(),
        },
      })
    : await db.publicWebResearchRun.create({
        data: {
          projectBriefId: input.request.projectBriefId || null,
          projectId: input.request.projectId || null,
          roleOpeningId: input.request.roleOpeningId || null,
          talentSearchRunId: searchRun.id,
          status: input.candidates.length > 0 ? "NEEDS_REVIEW" : "COMPLETED",
          mode: prismaMode(input.config.publicWebResearchMode),
          provider: input.config.publicWebResearchProvider,
          sourceTag: input.request.sourceTag || null,
          queryPlan: jsonArray(input.request.queryPlan),
          roleTargets: jsonArray(input.request.roleTargets),
          allowedDomains: jsonArray(input.config.publicWebResearchAllowedDomains),
          blockedDomains: jsonArray(input.config.publicWebResearchBlockedDomains),
          resultCount: input.candidates.length,
          citationCount: citations,
          warnings: jsonArray(warnings),
          completedAt: new Date(),
        },
      });
  const talentCandidateIds: string[] = [];
  const resultIds: string[] = [];

  for (let index = 0; index < input.candidates.length; index += 1) {
    const card = input.candidates[index];
    const safety = input.safety[index];
    const sourceReliability = reliabilityForCard(card);
    const sourceQuality = scorePublicWebSourceQuality({
      candidate: card,
      blockedDomains: input.config.publicWebResearchBlockedDomains,
      allowedDomains: input.config.publicWebResearchAllowedDomains,
    });
    const status: PublicWebResearchResultStatus = safety.safe
      ? "SHADOW_RESULT"
      : "NEEDS_REVIEW";
    const result = await db.publicWebResearchResult.create({
      data: {
        researchRunId: run.id,
        role: card.likelyRole,
        displayName: card.displayName,
        city: card.city || null,
        publicProfileUrls: jsonArray(card.publicProfileUrls),
        sourceUrls: jsonArray(card.sourceUrls),
        sourceTitles: jsonArray(card.sourceTitles || []),
        evidence: jsonObject({
          roleFitEvidence: card.roleFitEvidence,
          fandomFitEvidence: card.fandomFitEvidence,
          locationEvidence: card.locationEvidence,
          portfolioEvidence: card.portfolioEvidence,
          recentActivityEvidence: card.recentActivityEvidence || [],
          whyTheyMayFit: card.whyTheyMayFit,
        }),
        candidateCard: input.config.publicWebResearchStoreRawResults
          ? jsonObject(card)
          : jsonObject(toCandidateCard(card)),
        status,
        confidence: card.confidence,
        sourceReliability,
        sourceQualityScore: sourceQuality.totalScore,
        sourceQualityBand: sourceQuality.band,
        riskFlags: jsonArray([
          ...card.riskFlags,
          ...safety.blockers,
          ...safety.warnings,
          ...sourceQuality.blockers,
          ...sourceQuality.warnings,
        ]),
        missingEvidence: jsonArray([
          ...card.missingEvidence,
          ...safety.requiredActions,
          ...sourceQuality.warnings,
        ]),
      },
    });
    resultIds.push(result.id);
    await auditPublicResearch({
      action:
        input.config.publicWebResearchMode === "live_dry_run"
          ? publicWebResearchAuditEvents.liveDryRunResultCreated
          : publicWebResearchAuditEvents.resultCreated,
      request: input.request,
      mode: input.config.publicWebResearchMode,
      provider: input.config.publicWebResearchProvider,
      count: 1,
      citationCount: card.sourceUrls.length,
      researchRunId: run.id,
      resultId: result.id,
    });

    const candidate = await db.talentCandidate.create({
      data: {
        searchRunId: searchRun.id,
        publicWebResearchResultId: result.id,
        source: "PUBLIC_WEB_RESEARCH",
        displayName: card.displayName,
        role: card.likelyRole,
        city: card.city || null,
        fandoms: [],
        skills: card.roleFitEvidence,
        portfolioUrls: card.publicProfileUrls,
        publicSourceUrls: card.sourceUrls,
        evidence: {
          matchingReasons: card.whyTheyMayFit,
          roleFitEvidence: card.roleFitEvidence,
          fandomFitEvidence: card.fandomFitEvidence,
          locationEvidence: card.locationEvidence,
          portfolioEvidence: card.portfolioEvidence,
          sourceTitles: card.sourceTitles || [],
          publicWebResearchRunId: run.id,
          requiresHumanReview: true,
        },
        score: Math.round(card.confidence * 100),
        scoreBreakdown: {
          publicWebConfidence: card.confidence,
          sourceReliability,
          safetyRiskLevel: publicWebResearchRiskLevel({
            blockers: safety.blockers,
            warnings: safety.warnings,
          }),
        },
        status: "NEEDS_MORE_INFO",
        risks: [...card.riskFlags, ...safety.blockers, ...safety.warnings],
        missingInfo: [...card.missingEvidence, ...safety.requiredActions],
        adminNotes:
          input.config.publicWebResearchMode === "live_dry_run"
            ? "Public web live dry-run result. Human review required before shortlist."
            : "Public web shadow result. Human review required before shortlist.",
      },
    });
    talentCandidateIds.push(candidate.id);
    try {
      await createTalentResearchReviewForCandidate({
        talentCandidateId: candidate.id,
        reviewer:
          input.config.publicWebResearchMode === "live_dry_run"
            ? "public_web_live_dry_run"
            : "public_web_shadow",
        adminReviewed: false,
      });
    } catch (error) {
      logServerError("Public web research quality review creation failed", error, {
        entityType: "TalentCandidate",
        entityId: candidate.id,
        metadata: { publicWebResearchRunId: run.id },
      });
    }
    for (const evidence of extractContactabilityEvidenceFromCandidate(card)) {
      const review = evaluateContactabilityEvidence(evidence);
      const createdEvidence = await db.contactabilityEvidence.create({
        data: {
          publicWebResearchResultId: result.id,
          talentCandidateId: candidate.id,
          channel: evidence.channel,
          valueRedacted: review.valueRedacted,
          sourceUrl: evidence.sourceUrl || null,
          sourceTitle: evidence.sourceTitle || null,
          evidenceTextSummary: evidence.evidenceTextSummary || null,
          isPubliclyVisible: Boolean(evidence.isPubliclyVisible),
          isBusinessFacing: Boolean(evidence.isBusinessFacing),
          isPersonalContact: Boolean(evidence.isPersonalContact),
          outreachRisk: review.outreachRisk,
          complianceNotes: review.complianceNotes.join(" "),
        },
      });
      await logAudit({
        actorType: "SYSTEM",
        action: contactabilityAuditEvents.evidenceCreated,
        entityType: "ContactabilityEvidence",
        entityId: createdEvidence.id,
        metadata: {
          resultId: result.id,
          candidateId: candidate.id,
          channel: createdEvidence.channel,
          riskLevel: createdEvidence.outreachRisk,
          reviewStatus: createdEvidence.reviewStatus,
          noRawEmail: true,
          noRawPhone: true,
          noSmsSent: true,
          noOutreachSent: true,
        },
      });
    }
  }

  return {
    researchRunId: run.id,
    persistedCandidates: true,
    talentCandidateIds,
    resultIds,
  };
}

export async function runPublicWebResearch(input: {
  request: PublicWebResearchRequest;
  provider?: PublicWebResearchProvider;
  persistShadowResults?: boolean;
  adminTriggered?: boolean;
  demoSafe?: boolean;
  existingResearchRunId?: string | null;
}) {
  const config = getPublicWebResearchConfig();
  const request = {
    ...input.request,
    allowedDomains:
      input.request.allowedDomains || config.publicWebResearchAllowedDomains,
    blockedDomains:
      input.request.blockedDomains || config.publicWebResearchBlockedDomains,
  };
  const liveDryRunReadiness = evaluatePublicWebResearchLiveDryRunReadiness({
    request,
    adminTriggered: input.adminTriggered,
    demoSafe: input.demoSafe,
    requireActionGate: config.publicWebResearchMode === "live_dry_run",
  });

  if (config.publicWebResearchMode === "disabled") {
    await auditPublicResearch({
      action: publicWebResearchAuditEvents.disabledModeBlocked,
      request,
      mode: config.publicWebResearchMode,
      provider: config.publicWebResearchProvider,
    });
    await auditPublicResearch({
      action: sourcingAuditEvents.publicWebResearchSkipped,
      request,
      mode: config.publicWebResearchMode,
      provider: config.publicWebResearchProvider,
    });
    return {
      mode: config.publicWebResearchMode,
      enabled: config.publicWebResearchEnabled,
      provider: config.publicWebResearchProvider,
      calledProvider: false,
      persistedCandidates: false,
      candidates: [] as CandidateCard[],
      publicResearchCandidates: [] as PublicResearchCandidateCard[],
      researchRunId: null,
      resultIds: [] as string[],
      talentCandidateIds: [] as string[],
      citationCount: 0,
      safetyBlockers: [] as string[],
      safetyWarnings: [] as string[],
      skippedReason: "public_web_research_disabled",
    };
  }

  if (config.publicWebResearchMode === "live_dry_run") {
    await auditPublicResearch({
      action: publicWebResearchAuditEvents.liveDryRunRequested,
      request,
      mode: config.publicWebResearchMode,
      provider: config.publicWebResearchProvider,
    });
    if (!liveDryRunReadiness.allowed) {
      await auditPublicResearch({
        action: publicWebResearchAuditEvents.liveDryRunBlocked,
        request,
        mode: config.publicWebResearchMode,
        provider: config.publicWebResearchProvider,
        errorCategory: liveDryRunReadiness.blockers[0] || "blocked",
      });
      return {
        mode: config.publicWebResearchMode,
        enabled: config.publicWebResearchEnabled,
        provider: config.publicWebResearchProvider,
        calledProvider: false,
        persistedCandidates: false,
        candidates: [] as CandidateCard[],
        publicResearchCandidates: [] as PublicResearchCandidateCard[],
        researchRunId: null,
        resultIds: [] as string[],
        talentCandidateIds: [] as string[],
        citationCount: 0,
        safetyBlockers: liveDryRunReadiness.blockers,
        safetyWarnings: liveDryRunReadiness.warnings,
        skippedReason: "live_dry_run_blocked",
      };
    }
  }

  if (config.publicWebResearchMode === "shadow") {
    await auditPublicResearch({
      action: sourcingAuditEvents.publicWebResearchSkipped,
      request,
      mode: config.publicWebResearchMode,
      provider: config.publicWebResearchProvider,
      errorCategory: "shadow_mode_no_live_web_call",
    });
    return {
      mode: config.publicWebResearchMode,
      enabled: config.publicWebResearchEnabled,
      provider: config.publicWebResearchProvider,
      calledProvider: false,
      persistedCandidates: false,
      candidates: [] as CandidateCard[],
      publicResearchCandidates: [] as PublicResearchCandidateCard[],
      researchRunId: null,
      resultIds: [] as string[],
      talentCandidateIds: [] as string[],
      citationCount: 0,
      safetyBlockers: [] as string[],
      safetyWarnings: ["live_dry_run_required_for_provider_call"],
      skippedReason: "shadow_mode_no_live_web_call",
    };
  }

  if (config.publicWebResearchMode === "admin_active") {
    await auditPublicResearch({
      action: publicWebResearchAuditEvents.safetyBlocked,
      request,
      mode: config.publicWebResearchMode,
      provider: config.publicWebResearchProvider,
      errorCategory: "admin_active_future_mode_blocked",
    });
    return {
      mode: config.publicWebResearchMode,
      enabled: config.publicWebResearchEnabled,
      provider: config.publicWebResearchProvider,
      calledProvider: false,
      persistedCandidates: false,
      candidates: [] as CandidateCard[],
      publicResearchCandidates: [] as PublicResearchCandidateCard[],
      researchRunId: null,
      resultIds: [] as string[],
      talentCandidateIds: [] as string[],
      citationCount: 0,
      safetyBlockers: ["admin_active_future_mode_blocked"],
      safetyWarnings: [] as string[],
      skippedReason: "admin_active_future_mode_blocked",
    };
  }

  if (config.publicWebResearchProvider === "none") {
    await auditPublicResearch({
      action: publicWebResearchAuditEvents.disabledModeBlocked,
      request,
      mode: config.publicWebResearchMode,
      provider: config.publicWebResearchProvider,
      errorCategory: "provider_none",
    });
    await auditPublicResearch({
      action: sourcingAuditEvents.publicWebResearchSkipped,
      request,
      mode: config.publicWebResearchMode,
      provider: config.publicWebResearchProvider,
    });
    return {
      mode: config.publicWebResearchMode,
      enabled: config.publicWebResearchEnabled,
      provider: config.publicWebResearchProvider,
      calledProvider: false,
      persistedCandidates: false,
      candidates: [] as CandidateCard[],
      publicResearchCandidates: [] as PublicResearchCandidateCard[],
      researchRunId: null,
      resultIds: [] as string[],
      talentCandidateIds: [] as string[],
      citationCount: 0,
      safetyBlockers: ["provider_none"],
      safetyWarnings: [] as string[],
      skippedReason: "provider_none",
    };
  }

  if (!input.provider) {
    await auditPublicResearch({
      action: publicWebResearchAuditEvents.disabledModeBlocked,
      request,
      mode: config.publicWebResearchMode,
      provider: config.publicWebResearchProvider,
      errorCategory: "provider_not_injected",
    });
    await auditPublicResearch({
      action: sourcingAuditEvents.publicWebResearchSkipped,
      request,
      mode: config.publicWebResearchMode,
      provider: config.publicWebResearchProvider,
    });
    return {
      mode: config.publicWebResearchMode,
      enabled: config.publicWebResearchEnabled,
      provider: config.publicWebResearchProvider,
      calledProvider: false,
      persistedCandidates: false,
      candidates: [] as CandidateCard[],
      publicResearchCandidates: [] as PublicResearchCandidateCard[],
      researchRunId: null,
      resultIds: [] as string[],
      talentCandidateIds: [] as string[],
      citationCount: 0,
      safetyBlockers: [] as string[],
      safetyWarnings: [] as string[],
      skippedReason: "provider_not_injected",
    };
  }

  await auditPublicResearch({
    action:
      config.publicWebResearchMode === "live_dry_run"
        ? publicWebResearchAuditEvents.liveDryRunStarted
        : publicWebResearchAuditEvents.runStarted,
    request,
    mode: config.publicWebResearchMode,
    provider: config.publicWebResearchProvider,
  });
  await auditPublicResearch({
    action: sourcingAuditEvents.publicWebResearchStarted,
    request,
    mode: config.publicWebResearchMode,
    provider: config.publicWebResearchProvider,
  });

  try {
    const raw = normalizeProviderResponse(await input.provider(request));
    const publicResearchCandidates: PublicResearchCandidateCard[] = [];
    for (const item of raw.candidates) {
      const normalized = normalizeCandidateCard(item);
      if (normalized) publicResearchCandidates.push(normalized);
      if (
        publicResearchCandidates.length >= config.publicWebResearchMaxResults
      ) {
        break;
      }
    }
    const safety = publicResearchCandidates.map((candidate) =>
      evaluatePublicWebResearchSafety({
        candidate,
        citationsRequired: config.publicWebResearchRequireCitations,
        blockedDomains: config.publicWebResearchBlockedDomains,
      }),
    );
    const safeCards = safety
      .map((item) => item.sanitizedCard)
      .filter((item): item is PublicResearchCandidateCard => Boolean(item));
    const candidates = safeCards.map(toCandidateCard);
    const citationCount = safeCards.reduce(
      (count, candidate) => count + candidate.sourceUrls.length,
      0,
    );
    const safetyBlockers = safety.flatMap((item) => item.blockers);
    const safetyWarnings = safety.flatMap((item) => item.warnings);
    const persistence =
      input.persistShadowResults &&
      config.publicWebResearchMode === "live_dry_run"
        ? await persistShadowResearch({
            request,
            config,
            candidates: safeCards,
            providerWarnings: raw.warnings,
            safety,
            existingResearchRunId: input.existingResearchRunId,
          })
        : {
            researchRunId: null,
            persistedCandidates: false,
            talentCandidateIds: [] as string[],
            resultIds: [] as string[],
          };

    await auditPublicResearch({
      action:
        config.publicWebResearchMode === "live_dry_run"
          ? publicWebResearchAuditEvents.liveDryRunCompleted
          : publicWebResearchAuditEvents.runCompleted,
      request,
      mode: config.publicWebResearchMode,
      provider: config.publicWebResearchProvider,
      count: candidates.length,
      citationCount,
      researchRunId: persistence.researchRunId,
    });
    await auditPublicResearch({
      action: sourcingAuditEvents.publicWebResearchCompleted,
      request,
      mode: config.publicWebResearchMode,
      provider: config.publicWebResearchProvider,
      count: candidates.length,
      citationCount,
      researchRunId: persistence.researchRunId,
    });

    return {
      mode: config.publicWebResearchMode,
      enabled: config.publicWebResearchEnabled,
      provider: config.publicWebResearchProvider,
      calledProvider: true,
      persistedCandidates: persistence.persistedCandidates,
      candidates,
      publicResearchCandidates: safeCards,
      researchRunId: persistence.researchRunId,
      resultIds: persistence.resultIds,
      talentCandidateIds: persistence.talentCandidateIds,
      citationCount,
      safetyBlockers,
      safetyWarnings,
      skippedReason: null,
    };
  } catch (error) {
    const errorCategory = publicWebResearchErrorCategory(error);
    const providerDiagnostic = providerDiagnosticFromError(error);
    await auditPublicResearch({
      action:
        config.publicWebResearchMode === "live_dry_run"
          ? publicWebResearchAuditEvents.liveDryRunFailed
          : publicWebResearchAuditEvents.runFailed,
      request,
      mode: config.publicWebResearchMode,
      provider: config.publicWebResearchProvider,
      errorCategory,
    });
    logServerError("Public web research provider failed", error, {
      entityType: "PublicWebResearchRun",
      entityId: request.projectBriefId || request.projectId || "shadow",
      metadata: {
        provider: config.publicWebResearchProvider,
        mode: config.publicWebResearchMode,
      },
    });
    return {
      mode: config.publicWebResearchMode,
      enabled: config.publicWebResearchEnabled,
      provider: config.publicWebResearchProvider,
      calledProvider: true,
      persistedCandidates: false,
      candidates: [] as CandidateCard[],
      publicResearchCandidates: [] as PublicResearchCandidateCard[],
      researchRunId: null,
      resultIds: [] as string[],
      talentCandidateIds: [] as string[],
      citationCount: 0,
      safetyBlockers: [errorCategory],
      safetyWarnings: [] as string[],
      skippedReason: "provider_call_failed",
      providerDiagnostic,
    };
  }
}

function publicWebModeFromPrisma(
  mode: PrismaPublicWebResearchRunMode,
): PublicWebResearchMode {
  if (mode === "LIVE_DRY_RUN") return "live_dry_run";
  if (mode === "ADMIN_ACTIVE") return "admin_active";
  return "shadow";
}

function stringArrayFromJson(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function roleTargetsFromJson(
  value: Prisma.JsonValue | null | undefined,
  fallbackRole?: string | null,
): PublicWebResearchRequest["roleTargets"] {
  if (Array.isArray(value)) {
    const parsed = value
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const role = "role" in item && typeof item.role === "string" ? item.role : null;
        if (!role) return null;
        const city = "city" in item && typeof item.city === "string" ? item.city : null;
        const criteria =
          "criteria" in item && Array.isArray(item.criteria)
            ? item.criteria.filter(
                (criterion): criterion is string => typeof criterion === "string",
              )
            : [];
        return { role, city, criteria };
      })
      .filter(
        (item): item is { role: string; city: string | null; criteria: string[] } =>
          Boolean(item),
      );
    if (parsed.length > 0) return parsed;
  }
  return fallbackRole ? [{ role: fallbackRole, city: null, criteria: [] }] : [];
}

function summarizePublicWebJobResult(input: {
  resultCount: number;
  citationCount: number;
  blockers?: string[];
  warnings?: string[];
  skippedReason?: string | null;
  diagnostic?: PublicWebResearchProviderDiagnostic | null;
}): Prisma.InputJsonValue {
  return {
    resultCount: input.resultCount,
    citationCount: input.citationCount,
    blockerCount: input.blockers?.length || 0,
    warningCount: input.warnings?.length || 0,
    skippedReason: input.skippedReason || null,
    noSmsSent: true,
    noOutreachSent: true,
    noGroupChatCreated: true,
    noShortlistPromotion: true,
    providerDiagnostic: input.diagnostic
      ? {
          provider: input.diagnostic.provider,
          operation: input.diagnostic.operation,
          model: input.diagnostic.model,
          statusCode: input.diagnostic.statusCode || null,
          errorCategory: input.diagnostic.errorCategory,
          redactedMessageSnippet:
            input.diagnostic.redactedMessageSnippet || null,
          requestMode: input.diagnostic.requestMode,
          structuredOutputRequested:
            input.diagnostic.structuredOutputRequested,
          webSearchRequested: input.diagnostic.webSearchRequested,
        }
      : null,
  };
}

function requestFromResearchRun(input: {
  run: {
    projectBriefId: string | null;
    projectId: string | null;
    roleOpeningId: string | null;
    talentSearchRunId: string | null;
    sourceTag: string | null;
    queryPlan: Prisma.JsonValue;
    roleTargets: Prisma.JsonValue;
    allowedDomains: Prisma.JsonValue | null;
    blockedDomains: Prisma.JsonValue | null;
  };
  role?: string | null;
  querySummary?: string | null;
}): PublicWebResearchRequest {
  const queryPlan = stringArrayFromJson(input.run.queryPlan);
  return {
    projectBriefId: input.run.projectBriefId,
    projectId: input.run.projectId,
    roleOpeningId: input.run.roleOpeningId,
    searchRunId: input.run.talentSearchRunId,
    sourceTag: input.run.sourceTag,
    queryPlan:
      queryPlan.length > 0
        ? queryPlan
        : input.querySummary
          ? [input.querySummary]
          : [],
    roleTargets: roleTargetsFromJson(input.run.roleTargets, input.role),
    allowedDomains: stringArrayFromJson(input.run.allowedDomains),
    blockedDomains: stringArrayFromJson(input.run.blockedDomains),
  };
}

async function markPublicWebResearchJobFailed(input: {
  jobId: string;
  researchRunId?: string | null;
  request: PublicWebResearchRequest;
  mode: PublicWebResearchMode;
  provider: PublicWebResearchProviderName;
  errorCategory: PublicWebResearchFailureCategory;
  errorMessage?: string | null;
  resultCount?: number;
  citationCount?: number;
  diagnostic?: PublicWebResearchProviderDiagnostic | null;
}) {
  const db = getDb();
  await db.publicWebResearchJob.update({
    where: { id: input.jobId },
    data: {
      status: "FAILED",
      errorCategory: input.errorCategory,
      lastErrorMessageRedacted: input.errorMessage || null,
      lockedAt: null,
      lockedBy: null,
      completedAt: new Date(),
      resultSummary: summarizePublicWebJobResult({
        resultCount: input.resultCount || 0,
        citationCount: input.citationCount || 0,
        blockers: [input.errorCategory],
        warnings: [],
        skippedReason: "failed",
        diagnostic: input.diagnostic,
      }),
    },
  });
  if (input.researchRunId) {
    await db.publicWebResearchRun.update({
      where: { id: input.researchRunId },
      data: {
        status: "FAILED",
        errorCategory: input.errorCategory,
        resultCount: input.resultCount || 0,
        citationCount: input.citationCount || 0,
        completedAt: new Date(),
      },
    });
  }
  await auditPublicResearch({
    action: publicWebResearchAuditEvents.jobFailed,
    request: input.request,
    mode: input.mode,
    provider: input.provider,
    jobId: input.jobId,
    researchRunId: input.researchRunId || null,
    errorCategory: input.errorCategory,
    status: "FAILED",
    count: input.resultCount || 0,
    citationCount: input.citationCount || 0,
  });
  if (input.errorCategory === "provider_timeout") {
    await auditPublicResearch({
      action: publicWebResearchAuditEvents.runFailedTimeout,
      request: input.request,
      mode: input.mode,
      provider: input.provider,
      jobId: input.jobId,
      researchRunId: input.researchRunId || null,
      errorCategory: input.errorCategory,
      status: "FAILED",
    });
  }
}

export async function queuePublicWebResearchLiveDryRun(input?: {
  request?: PublicWebResearchRequest;
}) {
  const request = input?.request || buildPublicWebLiveDryRunRequest();
  const readiness = evaluatePublicWebResearchLiveDryRunReadiness({
    request,
    adminTriggered: true,
    demoSafe: true,
    requireActionGate: true,
  });
  const config = readiness.config;

  await auditPublicResearch({
    action: publicWebResearchAuditEvents.liveDryRunRequested,
    request,
    mode: config.publicWebResearchMode,
    provider: config.publicWebResearchProvider,
  });

  if (!readiness.allowed) {
    await auditPublicResearch({
      action: publicWebResearchAuditEvents.liveDryRunBlocked,
      request,
      mode: config.publicWebResearchMode,
      provider: config.publicWebResearchProvider,
      errorCategory: readiness.blockers[0] || "gate_blocked",
    });
    return {
      queued: false,
      researchRunId: null,
      jobId: null,
      blockers: readiness.blockers,
      warnings: readiness.warnings,
      message: "Live dry-run blocked by safety gates.",
    };
  }

  if (!process.env.DATABASE_URL) {
    return {
      queued: false,
      researchRunId: null,
      jobId: null,
      blockers: ["database_not_configured"],
      warnings: readiness.warnings,
      message: "Live dry-run queue requires the standalone pilot database.",
    };
  }

  const db = getDb();
  const role = request.roleTargets[0]?.role || null;
  const run = await db.publicWebResearchRun.create({
    data: {
      projectBriefId: request.projectBriefId || null,
      projectId: request.projectId || null,
      roleOpeningId: request.roleOpeningId || null,
      talentSearchRunId: request.searchRunId || null,
      status: "DRAFT",
      mode: "LIVE_DRY_RUN",
      provider: config.publicWebResearchProvider,
      sourceTag: request.sourceTag || config.publicWebResearchLiveDryRunTag,
      queryPlan: jsonArray(request.queryPlan),
      roleTargets: jsonArray(request.roleTargets),
      allowedDomains: jsonArray(request.allowedDomains || []),
      blockedDomains: jsonArray(request.blockedDomains || []),
      warnings: jsonArray(readiness.warnings),
    },
  });
  const job = await db.publicWebResearchJob.create({
    data: {
      researchRunId: run.id,
      projectBriefId: request.projectBriefId || null,
      projectId: request.projectId || null,
      role,
      querySummary: request.queryPlan.slice(0, 2).join(" | "),
      mode: "LIVE_DRY_RUN",
      status: "PENDING",
      maxAttempts: 2,
      runAfter: new Date(),
      resultSummary: summarizePublicWebJobResult({
        resultCount: 0,
        citationCount: 0,
        warnings: readiness.warnings,
        skippedReason: "queued",
      }),
    },
  });

  await auditPublicResearch({
    action: publicWebResearchAuditEvents.runQueued,
    request,
    mode: config.publicWebResearchMode,
    provider: config.publicWebResearchProvider,
    jobId: job.id,
    researchRunId: run.id,
    status: "PENDING",
  });
  await auditPublicResearch({
    action: publicWebResearchAuditEvents.jobCreated,
    request,
    mode: config.publicWebResearchMode,
    provider: config.publicWebResearchProvider,
    jobId: job.id,
    researchRunId: run.id,
    status: "PENDING",
  });

  return {
    queued: true,
    researchRunId: run.id,
    jobId: job.id,
    blockers: [] as string[],
    warnings: readiness.warnings,
    message: "Live dry-run queued. Process from the job runner or wait for worker.",
  };
}

export async function cancelPublicWebResearchJob(jobId: string) {
  if (!process.env.DATABASE_URL) {
    return { cancelled: false, reason: "database_not_configured" };
  }
  const db = getDb();
  const job = await db.publicWebResearchJob.findUnique({
    where: { id: jobId },
    include: { researchRun: true },
  });
  if (!job || (job.status !== "PENDING" && job.status !== "FAILED")) {
    return { cancelled: false, reason: "not_cancelable" };
  }
  const request = job.researchRun
    ? requestFromResearchRun({
        run: job.researchRun,
        role: job.role,
        querySummary: job.querySummary,
      })
    : buildPublicWebLiveDryRunRequest();
  await db.publicWebResearchJob.update({
    where: { id: job.id },
    data: {
      status: "CANCELLED",
      lockedAt: null,
      lockedBy: null,
      completedAt: new Date(),
    },
  });
  await auditPublicResearch({
    action: publicWebResearchAuditEvents.jobCancelled,
    request,
    mode: publicWebModeFromPrisma(job.mode),
    provider: getPublicWebResearchConfig().publicWebResearchProvider,
    jobId: job.id,
    researchRunId: job.researchRunId,
    status: "CANCELLED",
  });
  return { cancelled: true, reason: null };
}

export async function processPublicWebResearchJob(
  jobId: string,
  input?: { provider?: PublicWebResearchProvider; lockedBy?: string },
) {
  if (!process.env.DATABASE_URL) {
    return {
      jobId,
      status: "SKIPPED" as PublicWebResearchJobStatus,
      calledProvider: false,
      resultCount: 0,
      citationCount: 0,
      errorCategory: "database_not_configured" as PublicWebResearchFailureCategory,
      blockers: ["database_not_configured"],
      warnings: [] as string[],
    };
  }

  const db = getDb();
  const current = await db.publicWebResearchJob.findUnique({
    where: { id: jobId },
    include: {
      researchRun: {
        include: { _count: { select: { results: true } } },
      },
    },
  });
  if (!current) {
    return {
      jobId,
      status: "SKIPPED" as PublicWebResearchJobStatus,
      calledProvider: false,
      resultCount: 0,
      citationCount: 0,
      errorCategory: "unknown" as PublicWebResearchFailureCategory,
      blockers: ["job_not_found"],
      warnings: [] as string[],
    };
  }
  if (
    current.status === "SUCCEEDED" ||
    current.status === "CANCELLED" ||
    current.status === "SKIPPED"
  ) {
    return {
      jobId,
      status: current.status,
      calledProvider: false,
      resultCount: current.researchRun?.resultCount || 0,
      citationCount: current.researchRun?.citationCount || 0,
      errorCategory: current.errorCategory as PublicWebResearchFailureCategory | null,
      blockers: [] as string[],
      warnings: ["job_already_terminal"],
    };
  }
  if (current.attempts >= current.maxAttempts) {
    const request = current.researchRun
      ? requestFromResearchRun({
          run: current.researchRun,
          role: current.role,
          querySummary: current.querySummary,
        })
      : buildPublicWebLiveDryRunRequest();
    await markPublicWebResearchJobFailed({
      jobId: current.id,
      researchRunId: current.researchRunId,
      request,
      mode: publicWebModeFromPrisma(current.mode),
      provider: getPublicWebResearchConfig().publicWebResearchProvider,
      errorCategory: "provider_timeout",
      errorMessage: "max attempts exhausted",
    });
    return {
      jobId,
      status: "FAILED" as PublicWebResearchJobStatus,
      calledProvider: false,
      resultCount: 0,
      citationCount: 0,
      errorCategory: "provider_timeout" as PublicWebResearchFailureCategory,
      blockers: ["max_attempts_exhausted"],
      warnings: [] as string[],
    };
  }

  const lock = await db.publicWebResearchJob.updateMany({
    where: {
      id: current.id,
      status: current.status,
    },
    data: {
      status: "PROCESSING",
      lockedAt: new Date(),
      lockedBy: input?.lockedBy || "public_web_research_job_runner",
      attempts: { increment: 1 },
      errorCategory: null,
      lastErrorMessageRedacted: null,
    },
  });
  if (lock.count !== 1) {
    return {
      jobId,
      status: "SKIPPED" as PublicWebResearchJobStatus,
      calledProvider: false,
      resultCount: 0,
      citationCount: 0,
      errorCategory: "unknown" as PublicWebResearchFailureCategory,
      blockers: ["job_locked"],
      warnings: [] as string[],
    };
  }

  const job = await db.publicWebResearchJob.findUnique({
    where: { id: current.id },
    include: {
      researchRun: {
        include: { _count: { select: { results: true } } },
      },
    },
  });
  if (!job || !job.researchRun) {
    const request = buildPublicWebLiveDryRunRequest();
    await markPublicWebResearchJobFailed({
      jobId: current.id,
      researchRunId: current.researchRunId,
      request,
      mode: publicWebModeFromPrisma(current.mode),
      provider: getPublicWebResearchConfig().publicWebResearchProvider,
      errorCategory: "unknown",
      errorMessage: "missing research run context",
    });
    return {
      jobId,
      status: "FAILED" as PublicWebResearchJobStatus,
      calledProvider: false,
      resultCount: 0,
      citationCount: 0,
      errorCategory: "unknown" as PublicWebResearchFailureCategory,
      blockers: ["missing_research_run_context"],
      warnings: [] as string[],
    };
  }

  const request = requestFromResearchRun({
    run: job.researchRun,
    role: job.role,
    querySummary: job.querySummary,
  });
  const mode = publicWebModeFromPrisma(job.mode);
  const provider = getPublicWebResearchConfig().publicWebResearchProvider;

  if (job.researchRun._count.results > 0) {
    await db.publicWebResearchJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCEEDED",
        lockedAt: null,
        lockedBy: null,
        completedAt: new Date(),
        resultSummary: summarizePublicWebJobResult({
          resultCount: job.researchRun.resultCount,
          citationCount: job.researchRun.citationCount,
          warnings: ["results_already_persisted"],
          skippedReason: "idempotent_skip",
        }),
      },
    });
    return {
      jobId,
      status: "SUCCEEDED" as PublicWebResearchJobStatus,
      calledProvider: false,
      resultCount: job.researchRun.resultCount,
      citationCount: job.researchRun.citationCount,
      errorCategory: null,
      blockers: [] as string[],
      warnings: ["results_already_persisted"],
    };
  }

  const readiness = evaluatePublicWebResearchLiveDryRunReadiness({
    request,
    adminTriggered: true,
    demoSafe: true,
    requireActionGate: mode === "live_dry_run",
  });
  if (!readiness.allowed || request.queryPlan.length === 0) {
    await markPublicWebResearchJobFailed({
      jobId: job.id,
      researchRunId: job.researchRunId,
      request,
      mode,
      provider,
      errorCategory: "gate_blocked",
      errorMessage: readiness.blockers.join(", ") || "missing query context",
    });
    return {
      jobId,
      status: "FAILED" as PublicWebResearchJobStatus,
      calledProvider: false,
      resultCount: 0,
      citationCount: 0,
      errorCategory: "gate_blocked" as PublicWebResearchFailureCategory,
      blockers:
        readiness.blockers.length > 0
          ? readiness.blockers
          : ["missing_query_context"],
      warnings: readiness.warnings,
    };
  }
  if (!input?.provider) {
    await markPublicWebResearchJobFailed({
      jobId: job.id,
      researchRunId: job.researchRunId,
      request,
      mode,
      provider,
      errorCategory: "provider_not_injected",
      errorMessage: "provider not injected into job processor",
    });
    return {
      jobId,
      status: "FAILED" as PublicWebResearchJobStatus,
      calledProvider: false,
      resultCount: 0,
      citationCount: 0,
      errorCategory: "provider_not_injected" as PublicWebResearchFailureCategory,
      blockers: ["provider_not_injected"],
      warnings: readiness.warnings,
    };
  }

  await auditPublicResearch({
    action: publicWebResearchAuditEvents.jobStarted,
    request,
    mode,
    provider,
    jobId: job.id,
    researchRunId: job.researchRunId,
    status: "PROCESSING",
  });
  await db.publicWebResearchRun.update({
    where: { id: job.researchRun.id },
    data: { status: "RUNNING", errorCategory: null },
  });

  const result = await runPublicWebResearch({
    request,
    provider: input.provider,
    persistShadowResults: true,
    adminTriggered: true,
    demoSafe: true,
    existingResearchRunId: job.researchRun.id,
  });

  const resultCount = result.publicResearchCandidates.length;
  const citationCount = result.citationCount;
  if (result.skippedReason || resultCount === 0) {
    const category: PublicWebResearchFailureCategory =
      result.skippedReason === "provider_call_failed"
        ? (result.safetyBlockers[0] as PublicWebResearchFailureCategory) ||
          "unknown"
        : resultCount === 0
          ? "no_results"
          : "gate_blocked";
    await markPublicWebResearchJobFailed({
      jobId: job.id,
      researchRunId: job.researchRunId,
      request,
      mode,
      provider,
      errorCategory: category,
      errorMessage:
        result.providerDiagnostic?.redactedMessageSnippet ||
        result.skippedReason ||
        category,
      resultCount,
      citationCount,
      diagnostic: result.providerDiagnostic,
    });
    return {
      jobId,
      status: "FAILED" as PublicWebResearchJobStatus,
      calledProvider: result.calledProvider,
      resultCount,
      citationCount,
      errorCategory: category,
      blockers: result.safetyBlockers.length > 0 ? result.safetyBlockers : [category],
      warnings: result.safetyWarnings,
    };
  }

  await db.publicWebResearchJob.update({
    where: { id: job.id },
    data: {
      status: "SUCCEEDED",
      lockedAt: null,
      lockedBy: null,
      completedAt: new Date(),
      resultSummary: summarizePublicWebJobResult({
        resultCount,
        citationCount,
        blockers: result.safetyBlockers,
        warnings: result.safetyWarnings,
        skippedReason: null,
      }),
    },
  });
  await auditPublicResearch({
    action: publicWebResearchAuditEvents.jobSucceeded,
    request,
    mode,
    provider,
    jobId: job.id,
    researchRunId: job.researchRunId,
    status: "SUCCEEDED",
    count: resultCount,
    citationCount,
  });

  return {
    jobId,
    status: "SUCCEEDED" as PublicWebResearchJobStatus,
    calledProvider: result.calledProvider,
    resultCount,
    citationCount,
    errorCategory: null,
    blockers: result.safetyBlockers,
    warnings: result.safetyWarnings,
  };
}

export async function processNextPublicWebResearchJobs(input?: {
  limit?: number;
  provider?: PublicWebResearchProvider;
  lockedBy?: string;
}) {
  if (!process.env.DATABASE_URL) {
    return {
      processed: 0,
      results: [
        {
          jobId: null,
          status: "SKIPPED",
          calledProvider: false,
          resultCount: 0,
          citationCount: 0,
          errorCategory: "database_not_configured",
          blockers: ["database_not_configured"],
          warnings: [],
        },
      ],
    };
  }
  const db = getDb();
  const now = new Date();
  const candidates = await db.publicWebResearchJob.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      OR: [{ runAfter: null }, { runAfter: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: Math.max(input?.limit || 1, 1) * 2,
  });
  const jobs = candidates
    .filter((job) => job.attempts < job.maxAttempts)
    .slice(0, Math.max(input?.limit || 1, 1));
  const results = [];
  for (const job of jobs) {
    results.push(
      await processPublicWebResearchJob(job.id, {
        provider: input?.provider,
        lockedBy: input?.lockedBy,
      }),
    );
  }
  return {
    processed: results.length,
    results,
  };
}

export async function updatePublicWebResearchResultStatus(input: {
  resultId: string;
  status: PublicWebResearchResultStatus;
}) {
  const db = getDb();
  const result = await db.publicWebResearchResult.update({
    where: { id: input.resultId },
    data: { status: input.status },
    include: { researchRun: true },
  });
  const action =
    result.researchRun.mode === "LIVE_DRY_RUN" && input.status === "DISCARDED"
      ? publicWebResearchAuditEvents.liveDryRunResultDiscarded
      : result.researchRun.mode === "LIVE_DRY_RUN" &&
          input.status === "APPROVED_FOR_REVIEW"
        ? publicWebResearchAuditEvents.liveDryRunSentToQualityReview
        : input.status === "REJECTED"
      ? publicWebResearchAuditEvents.resultRejected
      : input.status === "DISCARDED"
        ? publicWebResearchAuditEvents.resultDiscarded
        : publicWebResearchAuditEvents.resultSentToQualityReview;
  await logAudit({
    actorType: "ADMIN",
    action,
    entityType: "PublicWebResearchResult",
    entityId: result.id,
    metadata: {
      projectBriefId: result.researchRun.projectBriefId,
      projectId: result.researchRun.projectId,
      researchRunId: result.researchRunId,
      resultId: result.id,
      status: result.status,
      noSmsSent: true,
      noOutreachSent: true,
    },
  });
  return result;
}

export async function getPublicWebResearchHealthSnapshot() {
  const config = getPublicWebResearchConfig();
  if (!process.env.DATABASE_URL) {
    return {
      publicWebResearchShadowAvailable: true,
      publicWebResearchLiveDryRunAvailable: true,
      publicWebResearchAsyncAvailable: true,
      publicWebResearchReviewAvailable: true,
      publicWebResearchEnabled: config.publicWebResearchEnabled,
      publicWebResearchMode: config.publicWebResearchMode,
      publicWebResearchProvider: config.publicWebResearchProvider,
      publicWebResearchRequireCitations:
        config.publicWebResearchRequireCitations,
      publicWebResearchLiveDryRunAllowed:
        config.publicWebResearchLiveDryRunAllowed,
      publicWebResearchMaxResults: config.publicWebResearchMaxResults,
      publicWebResearchReady: config.publicWebResearchReady,
      publicWebResearchBlockerCount: config.publicWebResearchBlockerCount,
      recentPublicWebLiveDryRunCount: null,
      publicWebResearchLastRunAt: null,
      publicWebResearchLastRunStatus: null,
      publicWebResearchLastCitationCount: null,
      publicWebResearchLastResultCount: null,
      publicWebResearchPendingJobCount: null,
      publicWebResearchFailedJobCount: null,
      recentPublicWebResearchRunCount: null,
      publicWebResultsPendingReviewCount: null,
      publicWebResearchPendingReviewCount: null,
      publicWebPendingReviewCount: null,
      publicWebNeedsMoreResearchCount: null,
      publicWebNeedsMoreContactResearchCount: null,
      publicWebDiscardedCount: null,
      publicWebDuplicateCount: null,
      publicWebDoNotContactCount: null,
      publicWebSourceQualityRiskLevel: "green",
      publicWebReviewRiskLevel:
        config.publicWebResearchBlockerCount > 0 ? "yellow" : "green",
      publicWebResultsRejectedCount: null,
      publicWebResearchRiskLevel:
        config.publicWebResearchBlockerCount > 0 ? "yellow" : "green",
      contactabilityEvidenceAvailable: true,
      contactabilityPendingReviewCount: null,
      contactabilityHighRiskCount: null,
    };
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      recentPublicWebResearchRunCount,
      recentPublicWebLiveDryRunCount,
      publicWebResultsPendingReviewCount,
      publicWebResultsRejectedCount,
      rejectedRecentCount,
      lastRun,
      publicWebResearchPendingJobCount,
      publicWebResearchFailedJobCount,
      publicWebPendingReviewCount,
      publicWebNeedsMoreResearchCount,
      publicWebDiscardedCount,
      publicWebDuplicateCount,
      publicWebDoNotContactCount,
      publicWebNeedsMoreContactResearchCount,
      contactabilityPendingReviewCount,
      contactabilityHighRiskCount,
      lowQualityResultCount,
    ] = await Promise.all([
      getDb().publicWebResearchRun.count({
        where: { createdAt: { gte: since } },
      }),
      getDb().publicWebResearchRun.count({
        where: { mode: "LIVE_DRY_RUN", createdAt: { gte: since } },
      }),
      getDb().publicWebResearchResult.count({
        where: { status: { in: ["SHADOW_RESULT", "NEEDS_REVIEW"] } },
      }),
      getDb().publicWebResearchResult.count({
        where: { status: "REJECTED" },
      }),
      getDb().publicWebResearchResult.count({
        where: {
          status: "REJECTED",
          createdAt: { gte: since },
        },
      }),
      getDb().publicWebResearchRun.findFirst({
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          status: true,
          citationCount: true,
          resultCount: true,
        },
      }),
      getDb().publicWebResearchJob.count({
        where: { status: "PENDING" },
      }),
      getDb().publicWebResearchJob.count({
        where: { status: "FAILED" },
      }),
      getDb().publicWebResearchResult.count({
        where: { status: { in: ["SHADOW_RESULT", "NEEDS_REVIEW", "IN_QUALITY_REVIEW"] } },
      }),
      getDb().publicWebResearchResult.count({
        where: { status: "NEEDS_REVIEW" },
      }),
      getDb().publicWebResearchResult.count({
        where: { status: { in: ["DISCARDED", "ARCHIVED"] } },
      }),
      getDb().publicWebResearchResult.count({
        where: { status: "DUPLICATE" },
      }),
      getDb().publicWebResearchResult.count({
        where: { status: "DO_NOT_CONTACT" },
      }),
      getDb().contactabilityEvidence.count({
        where: { reviewStatus: "NEEDS_MORE_RESEARCH" },
      }),
      getDb().contactabilityEvidence.count({
        where: { reviewStatus: "UNREVIEWED" },
      }),
      getDb().contactabilityEvidence.count({
        where: { outreachRisk: { in: ["HIGH", "BLOCKED"] } },
      }),
      getDb().publicWebResearchResult.count({
        where: { sourceQualityBand: { in: ["INSUFFICIENT_SOURCE", "BLOCKED_SOURCE"] } },
      }),
    ]);
    const publicWebSourceQualityRiskLevel =
      lowQualityResultCount > 0 ? "yellow" : "green";
    const publicWebResearchRiskLevel =
      publicWebResearchFailedJobCount > 0
        ? "red"
        : rejectedRecentCount > 0
        ? "red"
        : config.publicWebResearchBlockerCount > 0
          ? "yellow"
          : "green";

    return {
      publicWebResearchShadowAvailable: true,
      publicWebResearchLiveDryRunAvailable: true,
      publicWebResearchAsyncAvailable: true,
      publicWebResearchReviewAvailable: true,
      publicWebResearchEnabled: config.publicWebResearchEnabled,
      publicWebResearchMode: config.publicWebResearchMode,
      publicWebResearchProvider: config.publicWebResearchProvider,
      publicWebResearchRequireCitations:
        config.publicWebResearchRequireCitations,
      publicWebResearchLiveDryRunAllowed:
        config.publicWebResearchLiveDryRunAllowed,
      publicWebResearchMaxResults: config.publicWebResearchMaxResults,
      publicWebResearchReady: config.publicWebResearchReady,
      publicWebResearchBlockerCount: config.publicWebResearchBlockerCount,
      recentPublicWebLiveDryRunCount,
      publicWebResearchLastRunAt: lastRun?.createdAt.toISOString() || null,
      publicWebResearchLastRunStatus: lastRun?.status || null,
      publicWebResearchLastCitationCount: lastRun?.citationCount ?? null,
      publicWebResearchLastResultCount: lastRun?.resultCount ?? null,
      publicWebResearchPendingJobCount,
      publicWebResearchFailedJobCount,
      recentPublicWebResearchRunCount,
      publicWebResultsPendingReviewCount,
      publicWebResearchPendingReviewCount: publicWebResultsPendingReviewCount,
      publicWebPendingReviewCount,
      publicWebNeedsMoreResearchCount,
      publicWebNeedsMoreContactResearchCount,
      publicWebDiscardedCount,
      publicWebDuplicateCount,
      publicWebDoNotContactCount,
      publicWebSourceQualityRiskLevel,
      publicWebReviewRiskLevel:
        publicWebDoNotContactCount > 0 ||
        contactabilityHighRiskCount > 0 ||
        publicWebResearchFailedJobCount > 0
          ? "red"
          : publicWebPendingReviewCount > 0 ||
              publicWebNeedsMoreContactResearchCount > 0 ||
              contactabilityPendingReviewCount > 0 ||
              lowQualityResultCount > 0
            ? "yellow"
            : "green",
      publicWebResultsRejectedCount,
      publicWebResearchRiskLevel,
      contactabilityEvidenceAvailable: true,
      contactabilityPendingReviewCount,
      contactabilityHighRiskCount,
    };
  } catch {
    return {
      publicWebResearchShadowAvailable: true,
      publicWebResearchLiveDryRunAvailable: true,
      publicWebResearchAsyncAvailable: true,
      publicWebResearchReviewAvailable: true,
      publicWebResearchEnabled: config.publicWebResearchEnabled,
      publicWebResearchMode: config.publicWebResearchMode,
      publicWebResearchProvider: config.publicWebResearchProvider,
      publicWebResearchRequireCitations:
        config.publicWebResearchRequireCitations,
      publicWebResearchLiveDryRunAllowed:
        config.publicWebResearchLiveDryRunAllowed,
      publicWebResearchMaxResults: config.publicWebResearchMaxResults,
      publicWebResearchReady: config.publicWebResearchReady,
      publicWebResearchBlockerCount: config.publicWebResearchBlockerCount,
      recentPublicWebLiveDryRunCount: null,
      publicWebResearchLastRunAt: null,
      publicWebResearchLastRunStatus: null,
      publicWebResearchLastCitationCount: null,
      publicWebResearchLastResultCount: null,
      publicWebResearchPendingJobCount: null,
      publicWebResearchFailedJobCount: null,
      recentPublicWebResearchRunCount: null,
      publicWebResultsPendingReviewCount: null,
      publicWebResearchPendingReviewCount: null,
      publicWebPendingReviewCount: null,
      publicWebNeedsMoreResearchCount: null,
      publicWebNeedsMoreContactResearchCount: null,
      publicWebDiscardedCount: null,
      publicWebDuplicateCount: null,
      publicWebDoNotContactCount: null,
      publicWebSourceQualityRiskLevel: "green",
      publicWebReviewRiskLevel:
        config.publicWebResearchBlockerCount > 0 ? "yellow" : "green",
      publicWebResultsRejectedCount: null,
      publicWebResearchRiskLevel:
        config.publicWebResearchBlockerCount > 0 ? "yellow" : "green",
      contactabilityEvidenceAvailable: true,
      contactabilityPendingReviewCount: null,
      contactabilityHighRiskCount: null,
    };
  }
}
