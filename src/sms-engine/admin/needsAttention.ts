import { getDb } from "@/sms-engine/db";
import {
  autonomyAuditEvents,
  autonomyNeedsAttentionAuditActions,
} from "@/sms-engine/conversation/conversationAutonomy";
import { redactSensitiveJson } from "@/sms-engine/dataOps/dataClassification";

export type NeedsAttentionSeverity = "critical" | "needs_review" | "warning" | "info";

export type NeedsAttentionItem = {
  id: string;
  type:
    | "outbound_draft"
    | "blocked_draft"
    | "pending_reply"
    | "autonomy_reply"
    | "autonomy_handoff"
    | "shortlist_packet"
    | "candidate_review"
    | "public_web_result"
    | "contactability"
    | "ai_reply"
    | "conversation"
    | "pipeline_job"
    | "public_web_job"
    | "system_health"
    | "launch_blocker"
    | "data_ops";
  severity: NeedsAttentionSeverity;
  title: string;
  description: string;
  href: string;
  createdAt: string | null;
  projectBriefId?: string | null;
  source: string;
};

export type NeedsAttentionSummary = {
  totalCount: number;
  criticalCount: number;
  reviewCount: number;
  pendingApprovalCount: number;
  warningCount: number;
  messageCount: number;
  projectCount: number;
  sourcingCount: number;
  qualitySafetyCount: number;
  operationsCount: number;
  items: NeedsAttentionItem[];
  generatedAt: string;
  noSmsSent: true;
  noTwilioRequired: true;
  noProductionSagaAppDataRequired: true;
};

type NeedsAttentionOptions = {
  limit?: number;
};

const severityRank: Record<NeedsAttentionSeverity, number> = {
  critical: 0,
  needs_review: 1,
  warning: 2,
  info: 3,
};

function safeText(value: string) {
  return value
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-contact]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted-secret]")
    .replace(/postgres:\/\/\S+/g, "[redacted-secret]");
}

function makeItem(input: NeedsAttentionItem): NeedsAttentionItem {
  return {
    ...input,
    title: safeText(input.title),
    description: safeText(input.description),
  };
}

function sortItems(items: NeedsAttentionItem[]) {
  return [...items].sort((a, b) => {
    const severityDelta = severityRank[a.severity] - severityRank[b.severity];
    if (severityDelta !== 0) return severityDelta;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
}

function categoryCounts(items: NeedsAttentionItem[]) {
  const messageTypes = new Set([
    "outbound_draft",
    "blocked_draft",
    "pending_reply",
    "autonomy_reply",
    "autonomy_handoff",
    "conversation",
  ]);
  const projectTypes = new Set([
    "conversation",
    "shortlist_packet",
    "autonomy_handoff",
  ]);
  const sourcingTypes = new Set([
    "shortlist_packet",
    "candidate_review",
    "public_web_result",
    "contactability",
    "autonomy_handoff",
  ]);
  const qualityTypes = new Set(["ai_reply", "conversation"]);
  const operationTypes = new Set([
    "pipeline_job",
    "public_web_job",
    "system_health",
    "launch_blocker",
    "data_ops",
  ]);
  return {
    messageCount: items.filter((item) => messageTypes.has(item.type)).length,
    projectCount: items.filter((item) => projectTypes.has(item.type)).length,
    sourcingCount: items.filter((item) => sourcingTypes.has(item.type)).length,
    qualitySafetyCount: items.filter((item) => qualityTypes.has(item.type)).length,
    operationsCount: items.filter((item) => operationTypes.has(item.type)).length,
  };
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringFromMetadata(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function autonomyItemCopy(action: string) {
  if (action === autonomyAuditEvents.pausedInboundReceived) {
    return {
      type: "autonomy_reply" as const,
      title: "User is paused; review before replying",
      description: "This phone number is paused for autonomous replies.",
    };
  }
  if (action === autonomyAuditEvents.candidateOutreachBoundaryReached) {
    return {
      type: "autonomy_handoff" as const,
      title: "Project ready for candidate outreach approval",
      description: "Review possible collaborators before anyone is contacted.",
    };
  }
  if (action === autonomyAuditEvents.shortlistBoundaryReached) {
    return {
      type: "autonomy_handoff" as const,
      title: "Candidate shortlist needs human review",
      description: "Review the shortlist before anything becomes organizer-facing.",
    };
  }
  if (action === autonomyAuditEvents.groupChatBoundaryReached) {
    return {
      type: "autonomy_handoff" as const,
      title: "Group chat creation requires approval",
      description: "Review consent and safety before any group chat is created.",
    };
  }
  if (action === autonomyAuditEvents.handoffRequired) {
    return {
      type: "autonomy_handoff" as const,
      title: "Conversation needs a human handoff",
      description: "Saga reached an external action, rate/payment, legal, or safety boundary.",
    };
  }
  return {
    type: "autonomy_reply" as const,
    title: "Reply needs review before sending",
    description: "Per-phone autonomy is off, paused, or blocked by safety gates.",
  };
}

export function buildNeedsAttentionSummary(
  items: NeedsAttentionItem[],
  options: NeedsAttentionOptions = {},
): NeedsAttentionSummary {
  const sorted = sortItems(items.map(makeItem));
  const limited =
    typeof options.limit === "number" && options.limit >= 0
      ? sorted.slice(0, options.limit)
      : sorted;
  const counts = categoryCounts(sorted);
  return {
    totalCount: sorted.length,
    criticalCount: sorted.filter((item) => item.severity === "critical").length,
    reviewCount: sorted.filter((item) => item.severity === "needs_review").length,
    pendingApprovalCount: sorted.filter((item) => item.severity === "needs_review").length,
    warningCount: sorted.filter((item) => item.severity === "warning").length,
    ...counts,
    items: limited,
    generatedAt: new Date().toISOString(),
    noSmsSent: true,
    noTwilioRequired: true,
    noProductionSagaAppDataRequired: true,
  };
}

function staticSafetyItems(): NeedsAttentionItem[] {
  const items: NeedsAttentionItem[] = [];
  if (process.env.SMS_SENDS_DISABLED === "false") {
    items.push(makeItem({
      id: "safety:sms_sends_enabled",
      type: "system_health",
      severity: "critical",
      title: "SMS sending is on",
      description: "Turn SMS sending off unless an approved test window is active.",
      href: "/admin/command-center",
      createdAt: null,
      source: "env_safety",
    }));
  }
  if (process.env.PUBLIC_LAUNCH_ENABLED === "true") {
    items.push(makeItem({
      id: "safety:public_launch_enabled",
      type: "launch_blocker",
      severity: "critical",
      title: "Public launch is on",
      description: "Public launch should remain off before explicit launch approval.",
      href: "/admin/public-beta",
      createdAt: null,
      source: "env_safety",
    }));
  }
  if (process.env.SMS_COMPLIANCE_APPROVED !== "true") {
    items.push(makeItem({
      id: "launch:a2p_pending",
      type: "launch_blocker",
      severity: "warning",
      title: "A2P approval is still needed",
      description: "The one-number self-test and design partner pilot remain blocked.",
      href: "/admin/launch-drill",
      createdAt: null,
      source: "launch_gate",
    }));
  }
  return items;
}

export async function getNeedsAttentionSummary(
  options: NeedsAttentionOptions = {},
): Promise<NeedsAttentionSummary> {
  const items = staticSafetyItems();
  if (!process.env.DATABASE_URL) {
    return buildNeedsAttentionSummary(items, options);
  }

  try {
    const db = getDb();
    const [
      outboundDrafts,
      blockedApprovedDrafts,
      shortlistPackets,
      candidateRecommendations,
      publicWebResults,
      contactabilityEvidence,
      llmReviewItems,
      needsAdminBriefs,
      failedPipelineJobs,
      failedPublicWebJobs,
      autonomyAuditLogs,
    ] = await Promise.all([
      db.outboundDraft.findMany({
        where: { status: { in: ["DRAFT", "NEEDS_REVIEW", "BLOCKED"] } },
        select: { id: true, status: true, type: true, projectBriefId: true, createdAt: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      db.outboundDraft.findMany({
        where: { status: "APPROVED", blockReason: { not: null } },
        select: { id: true, projectBriefId: true, createdAt: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      db.shortlistPacket.findMany({
        where: { status: "NEEDS_REVIEW" },
        select: { id: true, projectBriefId: true, createdAt: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      db.candidateRecommendation.findMany({
        where: { status: { in: ["SUGGESTED", "NEEDS_MORE_INFO"] } },
        select: { id: true, status: true, createdAt: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      db.publicWebResearchResult.findMany({
        where: { status: { in: ["SHADOW_RESULT", "NEEDS_REVIEW", "IN_QUALITY_REVIEW"] } },
        select: { id: true, status: true, researchRunId: true, createdAt: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      db.contactabilityEvidence.findMany({
        where: { reviewStatus: { in: ["UNREVIEWED", "NEEDS_MORE_RESEARCH"] } },
        select: { id: true, reviewStatus: true, publicWebResearchResultId: true, createdAt: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      db.llmReviewItem.findMany({
        where: {
          OR: [
            { needsReview: true },
            { reviewStatus: { in: ["UNREVIEWED", "NEEDS_PROMPT_TUNING", "UNSAFE"] } },
          ],
        },
        select: { id: true, reviewStatus: true, projectBriefId: true, createdAt: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      db.projectBrief.findMany({
        where: { status: "NEEDS_ADMIN" },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      db.inboundProcessingJob.findMany({
        where: { status: "FAILED" },
        select: { id: true, projectBriefId: true, createdAt: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      db.publicWebResearchJob.findMany({
        where: { status: "FAILED" },
        select: { id: true, researchRunId: true, createdAt: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      db.auditLog.findMany({
        where: { action: { in: [...autonomyNeedsAttentionAuditActions] } },
        select: { id: true, action: true, metadata: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    for (const draft of outboundDrafts) {
      items.push(makeItem({
        id: `outbound-draft:${draft.id}`,
        type: draft.status === "BLOCKED" ? "blocked_draft" : "outbound_draft",
        severity: draft.status === "BLOCKED" ? "warning" : "needs_review",
        title:
          draft.status === "BLOCKED"
            ? "A draft is blocked by safety gates"
            : "A reply draft needs review",
        description:
          draft.status === "BLOCKED"
            ? "A message was blocked before sending. Review the safety reason."
            : "Review the draft before it can move forward. Approval still does not bypass SMS gates.",
        href: "/admin/outbound-drafts",
        createdAt: draft.createdAt.toISOString(),
        projectBriefId: draft.projectBriefId,
        source: "outbound_draft",
      }));
    }

    for (const draft of blockedApprovedDrafts) {
      items.push(makeItem({
        id: `blocked-approved-draft:${draft.id}`,
        type: "blocked_draft",
        severity: "warning",
        title: "An approved draft is still blocked",
        description: "No message is sent unless every safety gate passes.",
        href: "/admin/outbound-drafts",
        createdAt: draft.createdAt.toISOString(),
        projectBriefId: draft.projectBriefId,
        source: "outbound_draft",
      }));
    }

    for (const packet of shortlistPackets) {
      items.push(makeItem({
        id: `shortlist-packet:${packet.id}`,
        type: "shortlist_packet",
        severity: "needs_review",
        title: "A shortlist packet needs approval",
        description: "Review candidate summaries before anything becomes user-facing.",
        href: packet.projectBriefId
          ? `/admin/projects/${packet.projectBriefId}`
          : "/admin/outbound-drafts",
        createdAt: packet.createdAt.toISOString(),
        projectBriefId: packet.projectBriefId,
        source: "shortlist_packet",
      }));
    }

    for (const candidate of candidateRecommendations) {
      items.push(makeItem({
        id: `candidate-recommendation:${candidate.id}`,
        type: "candidate_review",
        severity: "needs_review",
        title: "A candidate recommendation needs review",
        description: "Review fit and risk before a candidate can move forward.",
        href: "/admin/recommendations",
        createdAt: candidate.createdAt.toISOString(),
        source: "candidate_recommendation",
      }));
    }

    for (const result of publicWebResults) {
      items.push(makeItem({
        id: `public-web-result:${result.id}`,
        type: "public_web_result",
        severity: "needs_review",
        title: "A public web candidate needs review",
        description: "Check citations, source quality, duplicates, and safety before promotion.",
        href: "/admin/sourcing/public-web-review",
        createdAt: result.createdAt.toISOString(),
        source: "public_web_research",
      }));
    }

    for (const evidence of contactabilityEvidence) {
      items.push(makeItem({
        id: `contactability:${evidence.id}`,
        type: "contactability",
        severity: "needs_review",
        title: "A contact path needs review",
        description: "Contactability is evidence, not permission to contact anyone.",
        href: "/admin/sourcing/public-web-review",
        createdAt: evidence.createdAt.toISOString(),
        source: "contactability",
      }));
    }

    for (const reviewItem of llmReviewItems) {
      items.push(makeItem({
        id: `llm-review:${reviewItem.id}`,
        type: "ai_reply",
        severity: reviewItem.reviewStatus === "UNSAFE" ? "critical" : "needs_review",
        title:
          reviewItem.reviewStatus === "NEEDS_PROMPT_TUNING"
            ? "An AI reply may need tuning"
            : "An AI reply needs review",
        description: "Review the redacted item for tone, safety, and next-step clarity.",
        href: "/admin/llm-review",
        createdAt: reviewItem.createdAt.toISOString(),
        projectBriefId: reviewItem.projectBriefId,
        source: "llm_review",
      }));
    }

    for (const brief of needsAdminBriefs) {
      items.push(makeItem({
        id: `conversation:${brief.id}`,
        type: "conversation",
        severity: "needs_review",
        title: "A conversation needs admin review",
        description: "Review the project before Saga replies further.",
        href: `/admin/projects/${brief.id}`,
        createdAt: brief.updatedAt.toISOString(),
        projectBriefId: brief.id,
        source: "project_brief",
      }));
    }

    for (const job of failedPipelineJobs) {
      items.push(makeItem({
        id: `pipeline-job:${job.id}`,
        type: "pipeline_job",
        severity: "warning",
        title: "A pipeline job failed",
        description: "Review the failed job. This does not send SMS.",
        href: "/admin/pipeline",
        createdAt: job.createdAt.toISOString(),
        projectBriefId: job.projectBriefId,
        source: "messaging_pipeline",
      }));
    }

    for (const job of failedPublicWebJobs) {
      items.push(makeItem({
        id: `public-web-job:${job.id}`,
        type: "public_web_job",
        severity: "warning",
        title: "A public web research job failed",
        description: "Review the async research job. No candidates were contacted.",
        href: "/admin/sourcing/public-web",
        createdAt: job.createdAt.toISOString(),
        source: "public_web_research",
      }));
    }

    for (const audit of autonomyAuditLogs) {
      const metadata = metadataRecord(audit.metadata);
      const projectBriefId = stringFromMetadata(metadata.projectBriefId);
      const copy = autonomyItemCopy(audit.action);
      items.push(makeItem({
        id: `autonomy:${audit.id}`,
        type: copy.type,
        severity:
          audit.action === autonomyAuditEvents.handoffRequired
            ? "warning"
            : "needs_review",
        title: copy.title,
        description: copy.description,
        href: projectBriefId
          ? `/admin/projects/${projectBriefId}`
          : "/admin/needs-attention",
        createdAt: audit.createdAt.toISOString(),
        projectBriefId,
        source: "conversation_autonomy",
      }));
    }

    return buildNeedsAttentionSummary(items, options);
  } catch {
    return buildNeedsAttentionSummary(
      [
        ...items,
        makeItem({
          id: "needs-attention:summary-unavailable",
          type: "system_health",
          severity: "warning",
          title: "Needs Attention summary could not load",
          description: "Open System Health for details. No SMS was sent.",
          href: "/admin/observability",
          createdAt: null,
          source: "needs_attention",
        }),
      ],
      options,
    );
  }
}

export function getNeedsAttentionSidebarBadges(summary: NeedsAttentionSummary) {
  return {
    needsAttention: summary.totalCount,
    messages: summary.messageCount,
    projects: summary.projectCount,
    sourcing: summary.sourcingCount,
    qualitySafety: summary.qualitySafetyCount,
    operations: summary.operationsCount,
  };
}

export function safeNeedsAttentionSummary(summary: NeedsAttentionSummary) {
  return redactSensitiveJson(summary) as NeedsAttentionSummary;
}
