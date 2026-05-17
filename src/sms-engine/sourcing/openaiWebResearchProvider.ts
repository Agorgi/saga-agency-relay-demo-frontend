import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { categorizeOpenAiProviderError } from "@/sms-engine/llm/openaiProvider";
import { compactLlmText } from "@/sms-engine/llm/llmTypes";
import {
  publicResearchCandidateCardSchema,
  type PublicResearchCandidateCard,
} from "@/sms-engine/sourcing/talentTypes";
import type {
  PublicWebResearchMode,
  PublicWebResearchProviderDiagnostic,
  PublicWebResearchProvider,
  PublicWebResearchProviderResponse,
  PublicWebResearchRequest,
  PublicWebResearchSource,
} from "@/sms-engine/sourcing/publicWebResearchProvider";

const extractionCandidateSchema = z.object({
  displayName: z.string(),
  likelyRole: z.string(),
  city: z.string(),
  region: z.string(),
  publicProfileUrls: z.array(z.string()),
  sourceUrls: z.array(z.string()),
  sourceTitles: z.array(z.string()),
  roleFitEvidence: z.array(z.string()),
  fandomFitEvidence: z.array(z.string()),
  locationEvidence: z.array(z.string()),
  portfolioEvidence: z.array(z.string()),
  recentActivityEvidence: z.array(z.string()),
  whyTheyMayFit: z.array(z.string()),
  missingEvidence: z.array(z.string()),
  riskFlags: z.array(z.string()),
  confidence: z.number(),
  requiresHumanReview: z.boolean(),
  availabilityKnown: z.boolean(),
  willingnessKnown: z.boolean(),
  ratesKnown: z.boolean(),
  sensitiveDataDetected: z.boolean(),
  privateSourceDetected: z.boolean(),
});

const extractionResponseSchema = z.object({
  candidates: z.array(extractionCandidateSchema),
  warnings: z.array(z.string()),
});

type OpenAiWebResearchClient = Pick<OpenAI, "responses">;

export class OpenAiWebResearchProviderError extends Error {
  providerDiagnostic: PublicWebResearchProviderDiagnostic;

  constructor(diagnostic: PublicWebResearchProviderDiagnostic) {
    super(
      `OpenAI web research failed: ${diagnostic.errorCategory}${
        diagnostic.statusCode ? `:${diagnostic.statusCode}` : ""
      }`,
    );
    this.name = "OpenAiWebResearchProviderError";
    this.providerDiagnostic = diagnostic;
  }
}

let cachedClient: OpenAI | null = null;
let cachedKey: string | null = null;
let cachedBaseUrl: string | null = null;

function getClient(apiKey: string, baseUrl?: string | null) {
  const normalizedBaseUrl = baseUrl || null;
  if (cachedClient && cachedKey === apiKey && cachedBaseUrl === normalizedBaseUrl) {
    return cachedClient;
  }

  cachedClient = new OpenAI({
    apiKey,
    baseURL: normalizedBaseUrl || undefined,
    maxRetries: 1,
  });
  cachedKey = apiKey;
  cachedBaseUrl = normalizedBaseUrl;
  return cachedClient;
}

function configuredModel() {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

function configuredTimeout() {
  const parsed = Number.parseInt(process.env.LLM_TIMEOUT_MS || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12000;
}

function webSearchInstructions() {
  return [
    "You are an admin-only public web research assistant for Saga's standalone SMS Producer pilot.",
    "Use only public web search results and cite source URLs for every candidate.",
    "Return a concise cited research summary and source list only. Do not produce JSON in this step.",
    "Do not contact anyone. Do not infer availability, willingness, rates, age, protected characteristics, or private relationship status.",
    "Do not use private, login-gated, DM, private-group, or scraped sources.",
    "If evidence is weak or missing, say so rather than guessing.",
  ].join("\n");
}

function extractionInstructions() {
  return [
    "You convert cited public web research into review-only candidate cards for Saga admins.",
    "Use only the provided research summary and source list. Do not invent sources.",
    "Every candidate must include at least one source URL from the provided source list.",
    "Availability, willingness, and rates must be false unless explicitly sourced, and should normally be false.",
    "All candidates require human review. Do not approve or contact candidates.",
    "Use empty strings or empty arrays for unknown optional details.",
  ].join("\n");
}

function webSearchPromptForRequest(request: PublicWebResearchRequest) {
  return JSON.stringify(
    {
      task: "Search for public, citation-backed candidate leads for admin review only.",
      queryPlan: request.queryPlan,
      roleTargets: request.roleTargets,
      sourceRules: {
        allowed: [
          "public portfolio websites",
          "public social/profile pages available through public search",
          "personal websites",
          "public event/vendor directories",
          "public convention artist/vendor pages",
          "public press/articles",
        ],
        disallowed: [
          "private or login-gated content",
          "private groups",
          "DMs/messages",
          "private contact databases",
          "sensitive personal information",
          "minors or underage-focused queries",
        ],
      },
      outputRules: {
        conciseSummary: true,
        includeInlineCitations: true,
        includeSourceUrls: true,
        sourceUrlsRequired: true,
        availabilityKnownDefault: false,
        willingnessKnownDefault: false,
        ratesKnownDefault: false,
        requiresHumanReview: true,
        noOutreach: true,
      },
    },
    null,
    2,
  );
}

function extractionPromptForRequest(input: {
  request: PublicWebResearchRequest;
  researchSummary: string;
  sources: PublicWebResearchSource[];
}) {
  return JSON.stringify(
    {
      task: "Extract candidate cards from the cited research summary.",
      queryPlan: input.request.queryPlan,
      roleTargets: input.request.roleTargets,
      researchSummary: input.researchSummary,
      sources: input.sources.map((source) => ({
        url: source.url,
        title: source.title || "",
      })),
      requiredCandidateFields: [
        "displayName",
        "likelyRole",
        "sourceUrls",
        "whyTheyMayFit",
        "confidence",
        "requiresHumanReview",
      ],
      rules: {
        sourceUrlsMustComeFromSourcesList: true,
        availabilityKnownDefault: false,
        willingnessKnownDefault: false,
        ratesKnownDefault: false,
        requiresHumanReview: true,
        noOutreach: true,
      },
    },
    null,
    2,
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function sourceFromRecord(value: unknown): PublicWebResearchSource | null {
  const record = asRecord(value);
  if (!record) return null;
  const url = typeof record.url === "string" ? record.url : "";
  if (!url) return null;
  const title = typeof record.title === "string" ? record.title : null;
  return { url, title };
}

function collectSources(value: unknown, sources: PublicWebResearchSource[] = []) {
  if (!value || sources.length >= 200) return sources;
  if (Array.isArray(value)) {
    for (const item of value) collectSources(item, sources);
    return sources;
  }
  const record = asRecord(value);
  if (!record) return sources;
  const directSource = sourceFromRecord(record);
  if (directSource) sources.push(directSource);
  if (Array.isArray(record.sources)) {
    for (const source of record.sources) {
      const parsed = sourceFromRecord(source);
      if (parsed) sources.push(parsed);
    }
  }
  for (const item of Object.values(record)) collectSources(item, sources);
  return sources;
}

function collectOutputText(value: unknown): string {
  const record = asRecord(value);
  if (record && typeof record.output_text === "string") return record.output_text;
  const chunks: string[] = [];
  function visit(item: unknown) {
    if (!item) return;
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    const childRecord = asRecord(item);
    if (!childRecord) return;
    if (
      childRecord.type === "output_text" &&
      typeof childRecord.text === "string"
    ) {
      chunks.push(childRecord.text);
      return;
    }
    for (const child of Object.values(childRecord)) visit(child);
  }
  visit(record?.output);
  return chunks.join("\n\n");
}

function collectUrlSourcesFromText(text: string): PublicWebResearchSource[] {
  const matches = text.match(/https?:\/\/[^\s)\]}>"']+/g) || [];
  return matches.map((url) => ({ url: url.replace(/[.,;:]+$/, ""), title: null }));
}

function dedupeSources(sources: PublicWebResearchSource[]) {
  const byUrl = new Map<string, PublicWebResearchSource>();
  for (const source of sources) {
    if (!byUrl.has(source.url)) byUrl.set(source.url, source);
  }
  return Array.from(byUrl.values());
}

function mergeSourceUrls(
  candidates: PublicResearchCandidateCard[],
  sources: PublicWebResearchSource[],
) {
  const known = new Set(sources.map((source) => source.url));
  return candidates.map((candidate) => ({
    ...candidate,
    sourceUrls: candidate.sourceUrls.filter((url) => known.size === 0 || known.has(url)),
  }));
}

function providerDiagnostic(input: {
  error: unknown;
  operation: PublicWebResearchProviderDiagnostic["operation"];
  model: string;
  requestMode: PublicWebResearchMode;
  structuredOutputRequested: boolean;
  webSearchRequested: boolean;
}): PublicWebResearchProviderDiagnostic {
  const details = categorizeOpenAiProviderError(input.error);
  const message =
    input.error instanceof Error
      ? input.error.message.toLowerCase()
      : String(input.error).toLowerCase();
  const category =
    details.errorCategory === "timeout"
      ? "timeout"
      : details.errorCategory === "rate_limit"
        ? "rate_limit"
        : details.errorCategory === "provider_5xx"
          ? "provider_5xx"
          : details.errorCategory === "network_error"
            ? "network_error"
            : details.errorCategory === "auth_error"
              ? "auth_error"
              : details.errorCategory === "model_not_found"
                ? "model_not_found"
                : details.errorCategory === "invalid_schema"
                  ? "invalid_schema"
                  : details.errorCategory === "invalid_request"
                    ? "invalid_request"
                    : /structured output|valid candidates|parse|zod/.test(message)
                      ? "invalid_structured_output"
                    : "unknown";
  return {
    provider: "openai_web_search",
    operation: input.operation,
    model: input.model,
    statusCode: details.statusCode,
    errorCategory: category,
    redactedMessageSnippet: details.redactedMessageSnippet
      ? compactLlmText(details.redactedMessageSnippet, 120)
      : null,
    requestMode: input.requestMode,
    structuredOutputRequested: input.structuredOutputRequested,
    webSearchRequested: input.webSearchRequested,
  };
}

function requestModeFromTag(request: PublicWebResearchRequest): PublicWebResearchMode {
  return request.sourceTag === "live_dry_run" ? "live_dry_run" : "shadow";
}

function normalizeExtractedCandidate(
  candidate: z.infer<typeof extractionCandidateSchema>,
): PublicResearchCandidateCard | null {
  const parsed = publicResearchCandidateCardSchema.safeParse({
    ...candidate,
    city: candidate.city.trim() || null,
    region: candidate.region.trim() || null,
    publicProfileUrls: candidate.publicProfileUrls.filter(Boolean),
    sourceUrls: candidate.sourceUrls.filter(Boolean),
    sourceTitles: candidate.sourceTitles.filter(Boolean),
    requiresHumanReview: true,
    availabilityKnown: Boolean(candidate.availabilityKnown),
    willingnessKnown: Boolean(candidate.willingnessKnown),
    ratesKnown: Boolean(candidate.ratesKnown),
    sensitiveDataDetected: Boolean(candidate.sensitiveDataDetected),
    privateSourceDetected: Boolean(candidate.privateSourceDetected),
  });
  return parsed.success ? parsed.data : null;
}

export function createOpenAiWebResearchProvider(input?: {
  client?: OpenAiWebResearchClient;
}): PublicWebResearchProvider {
  return async (
    request: PublicWebResearchRequest,
  ): Promise<PublicWebResearchProviderResponse> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey && !input?.client) {
      throw new Error("OPENAI_API_KEY is required for OpenAI web research.");
    }

    const client = input?.client || getClient(apiKey || "", process.env.OPENAI_BASE_URL);
    const model = configuredModel();
    const requestMode = requestModeFromTag(request);
    const webSearchTool: OpenAI.Responses.WebSearchTool = {
      type: "web_search",
      search_context_size: "low",
      filters:
        request.allowedDomains && request.allowedDomains.length > 0
          ? { allowed_domains: request.allowedDomains }
          : undefined,
    };

    let webResponse: Awaited<ReturnType<OpenAI.Responses["create"]>>;
    try {
      webResponse = await client.responses.create(
        {
          model,
          instructions: webSearchInstructions(),
          input: webSearchPromptForRequest(request),
          tools: [webSearchTool],
          tool_choice: "required",
          include: ["web_search_call.action.sources"],
          max_output_tokens: 1800,
          temperature: 0.1,
        },
        {
          timeout: configuredTimeout(),
          maxRetries: 1,
        },
      );
    } catch (error) {
      throw new OpenAiWebResearchProviderError(
        providerDiagnostic({
          error,
          operation: "web_search",
          model,
          requestMode,
          structuredOutputRequested: false,
          webSearchRequested: true,
        }),
      );
    }

    const researchSummary = collectOutputText(webResponse);
    const sources = dedupeSources([
      ...collectSources(webResponse.output),
      ...collectUrlSourcesFromText(researchSummary),
    ]);
    if (!researchSummary.trim() || sources.length === 0) {
      throw new OpenAiWebResearchProviderError({
        provider: "openai_web_search",
        operation: "provider_response_validation",
        model,
        statusCode: null,
        errorCategory: "invalid_structured_output",
        redactedMessageSnippet: "web search returned no cited summary or sources",
        requestMode,
        structuredOutputRequested: false,
        webSearchRequested: true,
      });
    }

    try {
      const extractionResponse = await client.responses.parse(
        {
          model,
          instructions: extractionInstructions(),
          input: extractionPromptForRequest({
            request,
            researchSummary,
            sources,
          }),
          tool_choice: "none",
          text: {
            format: zodTextFormat(
              extractionResponseSchema,
              "PublicWebResearchCandidateExtraction",
            ),
          },
          max_output_tokens: 1800,
          temperature: 0.1,
        },
        {
          timeout: configuredTimeout(),
          maxRetries: 1,
        },
      );
      const parsed = extractionResponse.output_parsed;
      if (!parsed) {
        throw new Error("OpenAI web research extraction returned no structured output.");
      }
      const candidates = parsed.candidates
        .map(normalizeExtractedCandidate)
        .filter((candidate): candidate is PublicResearchCandidateCard =>
          Boolean(candidate),
        );
      if (candidates.length === 0) {
        throw new Error("OpenAI web research extraction returned no valid candidates.");
      }
      return {
        candidates: mergeSourceUrls(candidates, sources),
        sources,
        responseId: extractionResponse.id || webResponse.id || null,
        warnings: parsed.warnings,
      };
    } catch (error) {
      throw new OpenAiWebResearchProviderError(
        providerDiagnostic({
          error,
          operation: "candidate_card_extraction",
          model,
          requestMode,
          structuredOutputRequested: true,
          webSearchRequested: false,
        }),
      );
    }
  };
}
