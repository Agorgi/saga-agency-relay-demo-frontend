import Link from "next/link";
import { MessageCircle, Plus, RotateCcw, Send, Sparkles } from "lucide-react";
import { DemoSummaryButton } from "@/components/admin/DemoSummaryButton";
import { MessageThread } from "@/components/admin/MessageThread";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getConversationEngineRuntime } from "@/sms-engine/conversation/conversationEngineMode";
import { redactPhoneForDisplay } from "@/sms-engine/adminPrivacy";
import { getDb } from "@/sms-engine/db";
import { normalizePhone } from "@/sms-engine/phone";
import { briefTitle } from "@/sms-engine/workflow";
import {
  resetSimulationAction,
  simulateInboundAction,
} from "@/app/(admin)/admin/(dashboard)/dev/actions";
import {
  addInterestAction,
  approveMockRecommendationOutreachAction,
  convertInterestCheckAction,
  createFullDemoScenarioAction,
  createInterestCheckAction,
  createMockConversationAction,
  createNetworkProjectAction,
  resetNetworkDemoDataAction,
  runRecommendationsAction,
  simulateCandidateReplyAction,
  simulateCreatorInboundAction,
  simulateInterestCheckInboundAction,
} from "@/app/(admin)/admin/(dashboard)/network-actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const labelClass = "block text-sm font-medium text-zinc-300";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";
const demoScenarioEventId = "evt_demo_full_scenario";

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function metadataText(value: unknown) {
  if (Array.isArray(value)) return value.join(", ") || "none";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value ? value : "none";
}

function replySourceText(metadata: Record<string, unknown>) {
  return metadataText(
    metadata.conversationReplySourceDetail ||
      metadata.replySourceDetail ||
      metadata.source ||
      metadata.generatedReplySource,
  );
}

export default async function DevTestLabPage({
  searchParams,
}: {
  searchParams: Promise<{
    phone?: string;
    creatorPhone?: string;
    demoError?: string;
    demoNotice?: string;
  }>;
}) {
  const params = await searchParams;
  const phone = normalizePhone(params.phone || "+14155550000");
  const creatorPhone = normalizePhone(params.creatorPhone || "+14155550101");
  const returnTo = `/admin/dev?${new URLSearchParams({
    phone,
    creatorPhone,
  }).toString()}`;
  const adminConversationRuntime = getConversationEngineRuntime({
    providerMode: "MOCK",
    requestedMode: "mock_active",
    source: "admin_dev",
  });
  const db = getDb();
  const [
    user,
    creatorPerson,
    latestNetworkProjects,
    demoScenarioProject,
    interestChecks,
  ] =
    await Promise.all([
      db.user.findUnique({
        where: { phone },
        include: {
          projectBriefs: {
            orderBy: { updatedAt: "desc" },
            include: {
              messages: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      }),
      db.person.findUnique({
        where: { phone: creatorPhone },
        include: { creatorProfile: true },
      }),
      db.project.findMany({
        include: {
          roleOpenings: { include: { opportunities: true } },
          conversations: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
      db.project.findUnique({
        where: { existingSagaEventId: demoScenarioEventId },
        include: {
          projectBrief: {
            include: {
              messages: { orderBy: { createdAt: "asc" } },
            },
          },
          roleOpenings: { include: { opportunities: true } },
          conversations: true,
          tasks: true,
        },
      }),
      db.interestCheck.findMany({
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
    ]);
  const demoScenarioRecommendations = demoScenarioProject
    ? await db.candidateRecommendation.findMany({
        where: {
          opportunity: {
            roleOpening: {
              projectId: demoScenarioProject.id,
            },
          },
        },
        include: {
          person: { include: { creatorProfile: true } },
          opportunity: { include: { roleOpening: { include: { project: true } } } },
        },
        orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
        take: 8,
      })
    : [];
  const [demoScenarioReplyMessages, demoScenarioAuditLogs] =
    demoScenarioProject
      ? await Promise.all([
          db.message.count({
            where: {
              AND: [
                { metadata: { path: ["flow"], equals: "network_candidate_reply" } },
                { metadata: { path: ["projectId"], equals: demoScenarioProject.id } },
              ],
            },
          }),
          db.auditLog.findMany({
            where: {
              action: "demo.shortlist_generated",
              entityType: "Project",
              entityId: demoScenarioProject.id,
            },
            orderBy: { createdAt: "desc" },
            take: 6,
          }),
        ])
      : [0, []];
  const networkProjects = [
    ...(demoScenarioProject ? [demoScenarioProject] : []),
    ...latestNetworkProjects.filter(
      (item) => item.id !== demoScenarioProject?.id,
    ),
  ].slice(0, 5);
  const recommendations = demoScenarioRecommendations;
  const demoChecklistBrief = demoScenarioProject?.projectBrief || null;
  const demoChecklistInboundCount =
    demoChecklistBrief?.messages.filter((message) => message.direction === "INBOUND")
      .length ?? 0;
  const demoChecklistOutboundCount =
    demoChecklistBrief?.messages.filter(
      (message) => message.direction === "OUTBOUND",
    ).length ?? 0;
  const demoScenarioIntakeCompleted = Boolean(
    demoChecklistBrief &&
      (demoScenarioProject?.legacyProjectBriefId ||
        demoChecklistBrief.status === "BRIEF_READY_FOR_REVIEW" ||
        (demoChecklistInboundCount > 0 && demoChecklistOutboundCount > 0)),
  );
  const demoScenarioHasRoleOpenings =
    (demoScenarioProject?.roleOpenings.length ?? 0) > 0;
  const demoScenarioHasOpportunities = Boolean(
    demoScenarioProject?.roleOpenings.some(
      (role) => role.opportunities.length > 0,
    ),
  );
  const demoScenarioHasMockConversation =
    (demoScenarioProject?.conversations.length ?? 0) > 0;
  const demoScenarioTaskCount = demoScenarioProject?.tasks.length ?? 0;
  const project = user?.projectBriefs[0] || null;
  const organizerConversationAuditLogs = project
    ? await db.auditLog.findMany({
        where: {
          entityId: project.id,
          action: {
            in: [
              "conversation.reply_plan_applied",
              "conversation.reply_plan_shadowed",
              "conversation.intent_classified",
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    : [];
  const latestReplyPlanAudit =
    organizerConversationAuditLogs.find(
      (log) => log.action === "conversation.reply_plan_applied",
    ) || organizerConversationAuditLogs[0] || null;
  const latestReplyPlanMetadata = latestReplyPlanAudit
    ? metadataRecord(latestReplyPlanAudit.metadata)
    : {};
  const latestGigSeekerAudit = await db.auditLog.findFirst({
    where: {
      action: {
        in: [
          "conversation.gig_seeker_reply_plan_applied",
          "conversation.gig_seeker_reply_plan_shadowed",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const latestGigSeekerMetadata = latestGigSeekerAudit
    ? metadataRecord(latestGigSeekerAudit.metadata)
    : {};
  const latestInterestCheckAudit = await db.auditLog.findFirst({
    where: {
      action: {
        in: [
          "conversation.interest_check_reply_plan_applied",
          "conversation.interest_check_reply_plan_shadowed",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const latestInterestCheckMetadata = latestInterestCheckAudit
    ? metadataRecord(latestInterestCheckAudit.metadata)
    : {};
  const latestInterestCheckPreparedAudit = await db.auditLog.findFirst({
    where: {
      action: "conversation.interest_check_prepared",
    },
    orderBy: { createdAt: "desc" },
  });
  const latestInterestCheckPreparedMetadata = latestInterestCheckPreparedAudit
    ? metadataRecord(latestInterestCheckPreparedAudit.metadata)
    : {};
  const latestContactReplyAudit = await db.auditLog.findFirst({
    where: {
      action: {
        in: [
          "conversation.contact_reply_plan_applied",
          "conversation.contact_reply_plan_shadowed",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const latestContactReplyMetadata = latestContactReplyAudit
    ? metadataRecord(latestContactReplyAudit.metadata)
    : {};
  const scopedDemoLabel = demoScenarioProject
    ? `${demoScenarioProject.title || "Full demo scenario"} (${demoScenarioEventId})`
    : `Not created yet (${demoScenarioEventId})`;
  const requiredChecklist = [
    {
      label: "Organizer intake completed",
      done: demoScenarioIntakeCompleted,
    },
    { label: "Canonical project created", done: Boolean(demoScenarioProject) },
    { label: "Role openings generated", done: demoScenarioHasRoleOpenings },
    { label: "Opportunities created", done: demoScenarioHasOpportunities },
    { label: "Recommendations generated", done: recommendations.length > 0 },
    {
      label: "Mock outreach drafted/sent",
      done: recommendations.some((item) =>
        ["CONTACTED", "INTERESTED", "SHORTLISTED"].includes(item.status),
      ),
    },
    {
      label: "Consent recorded",
      done:
        recommendations.some(
          (item) =>
            item.status === "SHORTLISTED" ||
            item.person.consentStatus === "EXPLICIT",
        ),
    },
    {
      label: "Shortlist generated",
      done: demoScenarioAuditLogs.some(
        (log) => log.action === "demo.shortlist_generated",
      ),
    },
    {
      label: "Mock group conversation created",
      done: demoScenarioHasMockConversation,
    },
    {
      label: "Kickoff/tasks generated",
      done:
        demoScenarioTaskCount > 0 ||
        demoScenarioHasMockConversation,
    },
  ];
  const optionalDiagnostics = [
    {
      label: "Fake replies received",
      done: demoScenarioReplyMessages > 0,
      description:
        "Useful for contact-reply testing, but not required for the staging baseline.",
    },
  ];
  const requiredCompleteCount = requiredChecklist.filter((item) => item.done).length;
  const demoSummary = [
    `Saga demo mode summary`,
    `Checklist scenario: ${scopedDemoLabel}`,
    `Organizer phone: ${redactPhoneForDisplay(phone)}`,
    `Creator phone: ${redactPhoneForDisplay(creatorPhone)}`,
    `Legacy brief: ${project ? `${briefTitle(project)} (${project.status})` : "not created"}`,
    `Scenario project: ${demoScenarioProject?.id || "not created"}`,
    `Scenario roles: ${demoScenarioProject?.roleOpenings.length || 0}`,
    `Scenario opportunities: ${demoScenarioProject?.roleOpenings.reduce((sum, role) => sum + role.opportunities.length, 0) || 0}`,
    `Recommendations shown: ${recommendations.length}`,
    `Mock conversations: ${demoScenarioProject?.conversations.length || 0}`,
    `Required checks complete: ${requiredCompleteCount}/${requiredChecklist.length}`,
    `Optional diagnostics complete: ${optionalDiagnostics.filter((item) => item.done).length}/${optionalDiagnostics.length}`,
  ].join("\n");
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Demo mode
        </p>
        <h2 className="mt-2 text-2xl font-semibold">End-to-end simulation lab</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          Run the full Saga production-network loop without Twilio: organizer
          intake, creator onboarding, existing Saga event import, interest
          checks, deterministic matching, mock outreach, consent, shortlist, and
          mock team chat.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge status="MOCK MODE" />
          <StatusBadge status="NO LIVE SMS" />
          <DemoSummaryButton summary={demoSummary} />
          <form action={createFullDemoScenarioAction}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <button className={buttonClass}>
              <Sparkles aria-hidden className="h-4 w-4" />
              Create/refresh full demo scenario
            </button>
          </form>
          {process.env.NODE_ENV !== "production" ? (
            <form action={resetNetworkDemoDataAction}>
              <button className={buttonClass}>
                <RotateCcw aria-hidden className="h-4 w-4" />
                Reset demo data
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {params.demoError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-100"
        >
          {params.demoError}
        </div>
      ) : null}
      {params.demoNotice ? (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
          {params.demoNotice}
        </div>
      ) : null}

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Demo QA checklist</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Evaluating dedicated scenario: {scopedDemoLabel}
            </p>
          </div>
          <p className="text-sm text-zinc-500">
            {requiredCompleteCount}/{requiredChecklist.length} required complete
          </p>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {requiredChecklist.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              <span className={item.done ? "text-zinc-200" : "text-zinc-500"}>
                {item.label}
              </span>
              <StatusBadge status={item.done ? "DONE" : "PENDING"} />
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-zinc-900 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-zinc-200">
                Optional diagnostics
              </h4>
              <p className="mt-1 text-xs text-zinc-500">
                These are helpful for deeper QA, but a pending diagnostic does
                not fail the required staging baseline.
              </p>
            </div>
            <p className="text-xs text-zinc-500">
              {optionalDiagnostics.filter((item) => item.done).length}/
              {optionalDiagnostics.length} diagnostic complete
            </p>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {optionalDiagnostics.map((item) => (
              <div
                key={item.label}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={item.done ? "text-zinc-200" : "text-zinc-500"}>
                    Optional diagnostic: {item.label}
                  </span>
                  <StatusBadge status={item.done ? "DONE" : "PENDING"} />
                </div>
                <p className="mt-1 text-xs text-zinc-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <form action={simulateInboundAction} className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">1. Organizer idea intake</h3>
              <button className={buttonClass}><Send aria-hidden className="h-4 w-4" />Send</button>
            </div>
            <div className="mb-4 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status="CONVERSATION ENGINE" />
                <StatusBadge status={adminConversationRuntime.mode} />
                <StatusBadge
                  status={
                    adminConversationRuntime.effectiveActive
                      ? "MOCK ACTIVE"
                      : "SHADOW"
                  }
                />
              </div>
              <p className="mt-2">
                Admin simulation uses mock-active organizer replies only in MOCK
                mode. Twilio staging remains shadow-only.
              </p>
            </div>
            <label className={labelClass}>
              Conversation engine mode
              <select name="conversationEngineMode" defaultValue="mock_active" className={inputClass}>
                <option value="mock_active">mock_active</option>
                <option value="shadow">shadow</option>
              </select>
            </label>
            <label className={labelClass}>Fake organizer phone<input name="phone" defaultValue={params.phone ? phone : ""} className={inputClass} placeholder="+14155550000" /></label>
            <label className={`${labelClass} mt-4`}>Organizer message<textarea name="body" rows={4} required className={inputClass} placeholder="I want to host an anime rave in LA..." /></label>
          </form>

          <form action={resetSimulationAction} className="rounded-lg border border-zinc-800 bg-black p-4">
            <input type="hidden" name="phone" value={phone} />
            <button className={buttonClass}><RotateCcw aria-hidden className="h-4 w-4" />Reset organizer test phone</button>
          </form>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <h3 className="text-lg font-semibold">Organizer brief</h3>
            {project ? (
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between"><p className="font-medium">{briefTitle(project)}</p><StatusBadge status={project.status} /></div>
                <p className="text-zinc-400">{project.description || "No description yet."}</p>
                <MessageThread messages={project.messages} />
              </div>
            ) : <p className="mt-4 text-sm text-zinc-500">No organizer project for this phone yet.</p>}
          </section>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <h3 className="text-lg font-semibold">Conversation engine debug</h3>
            {latestReplyPlanAudit ? (
              <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                <p className="text-zinc-500">
                  Event:{" "}
                  <span className="text-zinc-200">
                    {latestReplyPlanAudit.action}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Flow:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestReplyPlanMetadata.flow)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Intent:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestReplyPlanMetadata.intent)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Stage:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestReplyPlanMetadata.stage)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Next:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestReplyPlanMetadata.nextStage)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Enough info:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestReplyPlanMetadata.enoughInfoForBrief)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Reply source:{" "}
                  <span className="text-zinc-200">
                    {replySourceText(latestReplyPlanMetadata)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  LLM operation:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestReplyPlanMetadata.llmOperation)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  LLM mode:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestReplyPlanMetadata.llmMode)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Surface:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestReplyPlanMetadata.llmExecutionSurface)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Validation:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestReplyPlanMetadata.llmValidationPassed)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Fallback used:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestReplyPlanMetadata.llmFallbackUsed)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Fallback reason:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestReplyPlanMetadata.llmFallbackReason)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Forbidden claims:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestReplyPlanMetadata.forbiddenClaimsDetected,
                    )}
                  </span>
                </p>
                <p className="text-zinc-500 md:col-span-2">
                  Missing required:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestReplyPlanMetadata.missingRequiredFields)}
                  </span>
                </p>
                <p className="text-zinc-500 md:col-span-2">
                  Missing optional:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestReplyPlanMetadata.missingOptionalFields)}
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">
                Send an organizer simulation message to see the latest
                mock-active ReplyPlan.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <form action={simulateCreatorInboundAction} className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">2. Creator / gig-seeker onboarding</h3>
              <button className={buttonClass}><MessageCircle aria-hidden className="h-4 w-4" />Send</button>
            </div>
            <div className="mb-4 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status="CONVERSATION ENGINE" />
                <StatusBadge status={adminConversationRuntime.mode} />
                <StatusBadge
                  status={
                    adminConversationRuntime.effectiveActive
                      ? "MOCK ACTIVE"
                      : "SHADOW"
                  }
                />
              </div>
              <p className="mt-2">
                Creator simulation can apply gig-seeker replies and prepare
                pending profiles only in MOCK/admin mode. Twilio stays
                shadow-only.
              </p>
            </div>
            <input type="hidden" name="conversationEngineMode" value="mock_active" />
            <label className={labelClass}>Fake creator phone<input name="phone" defaultValue={creatorPhone} className={inputClass} /></label>
            <label className={`${labelClass} mt-4`}>Creator message<textarea name="body" rows={4} required className={inputClass} placeholder="I'm a photographer in LA looking for paid anime and cosplay gigs. @portfolio" /></label>
          </form>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <h3 className="text-lg font-semibold">Creator profile result</h3>
            {creatorPerson?.creatorProfile ? (
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex flex-wrap gap-2"><StatusBadge status={creatorPerson.creatorProfile.reviewStatus} /><StatusBadge status={creatorPerson.consentStatus} /></div>
                <p className="text-zinc-300">
                  {creatorPerson.name || redactPhoneForDisplay(creatorPhone)}
                </p>
                <p className="text-zinc-500">Person: {creatorPerson.id}</p>
                <p className="text-zinc-500">
                  CreatorProfile: {creatorPerson.creatorProfile.id}
                </p>
                <p className="text-zinc-500">Roles: {creatorPerson.creatorProfile.roles.join(", ") || "unknown"}</p>
                <p className="text-zinc-500">Fandoms: {creatorPerson.creatorProfile.fandoms.join(", ") || "unknown"}</p>
                <p className="text-zinc-500">Links: {creatorPerson.creatorProfile.socialUrls.join(", ") || "none"}</p>
              </div>
            ) : <p className="mt-4 text-sm text-zinc-500">No creator profile for this phone yet.</p>}
          </section>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <h3 className="text-lg font-semibold">Gig-seeker conversation debug</h3>
            {latestGigSeekerAudit ? (
              <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                <p className="text-zinc-500">
                  Event:{" "}
                  <span className="text-zinc-200">
                    {latestGigSeekerAudit.action}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Intent:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestGigSeekerMetadata.intent)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Stage:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestGigSeekerMetadata.stage)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Next:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestGigSeekerMetadata.nextStage)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Profile review ready:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestGigSeekerMetadata.enoughInfoForProfileReview,
                    )}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Reply type:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestGigSeekerMetadata.replyType)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Reply source:{" "}
                  <span className="text-zinc-200">
                    {replySourceText(latestGigSeekerMetadata)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  LLM operation:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestGigSeekerMetadata.llmOperation)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  LLM mode:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestGigSeekerMetadata.llmMode)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Surface:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestGigSeekerMetadata.llmExecutionSurface)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Validation:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestGigSeekerMetadata.llmValidationPassed)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Fallback used:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestGigSeekerMetadata.llmFallbackUsed)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Fallback reason:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestGigSeekerMetadata.llmFallbackReason)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Forbidden claims:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestGigSeekerMetadata.forbiddenClaimsDetected,
                    )}
                  </span>
                </p>
                <p className="text-zinc-500 md:col-span-2">
                  Missing required:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestGigSeekerMetadata.missingRequiredFields,
                    )}
                  </span>
                </p>
                <p className="text-zinc-500 md:col-span-2">
                  Missing optional:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestGigSeekerMetadata.missingOptionalFields)}
                  </span>
                </p>
                <p className="text-zinc-500 md:col-span-2">
                  Next question:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestGigSeekerMetadata.nextQuestion)}
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">
                Send a creator simulation message to see the latest gig-seeker
                ReplyPlan. This does not activate live Twilio replies.
              </p>
            )}
          </section>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-zinc-800 bg-black p-4">
          <form action={simulateInterestCheckInboundAction}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">4. Interest-check simulation</h3>
              <button className={buttonClass}>
                <Sparkles aria-hidden className="h-4 w-4" />
                Send
              </button>
            </div>
            <div className="mb-4 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status="CONVERSATION ENGINE" />
                <StatusBadge status={adminConversationRuntime.mode} />
                <StatusBadge
                  status={
                    adminConversationRuntime.effectiveActive
                      ? "MOCK ACTIVE"
                      : "SHADOW"
                  }
                />
                <StatusBadge status="DRAFT ONLY" />
              </div>
              <p className="mt-2">
                Admin simulation can apply interest-check replies and prepare a
                draft InterestCheck only in MOCK/admin mode. It never converts
                to a Project and never touches ticketing, RSVP, QR, payments, or
                live SMS.
              </p>
            </div>
            <input type="hidden" name="conversationEngineMode" value="mock_active" />
            <label className={labelClass}>
              Fake interest-check phone
              <input name="phone" defaultValue={phone} className={inputClass} />
            </label>
            <label className={`${labelClass} mt-4`}>
              Interest-check message
              <textarea
                name="body"
                rows={4}
                required
                className={inputClass}
                placeholder="I wish someone would host a Love and Deepspace picnic in LA."
              />
            </label>
          </form>
          <div className="mt-5 border-t border-zinc-900 pt-4">
            <h4 className="text-sm font-semibold text-zinc-200">
              Interest-check conversation debug
            </h4>
            {latestInterestCheckAudit ? (
              <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                <p className="text-zinc-500">
                  Event:{" "}
                  <span className="text-zinc-200">
                    {latestInterestCheckAudit.action}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Intent:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestInterestCheckMetadata.intent)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Stage:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestInterestCheckMetadata.stage)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Next:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestInterestCheckMetadata.nextStage)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Ready:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestInterestCheckMetadata.enoughInfoForInterestCheck,
                    )}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Reply type:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestInterestCheckMetadata.replyType)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Reply source:{" "}
                  <span className="text-zinc-200">
                    {replySourceText(latestInterestCheckMetadata)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  LLM operation:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestInterestCheckMetadata.llmOperation)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  LLM mode:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestInterestCheckMetadata.llmMode)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Surface:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestInterestCheckMetadata.llmExecutionSurface,
                    )}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Validation:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestInterestCheckMetadata.llmValidationPassed,
                    )}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Fallback used:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestInterestCheckMetadata.llmFallbackUsed)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Fallback reason:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestInterestCheckMetadata.llmFallbackReason)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Forbidden claims:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestInterestCheckMetadata.forbiddenClaimsDetected,
                    )}
                  </span>
                </p>
                <p className="text-zinc-500 md:col-span-2">
                  Draft InterestCheck:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestInterestCheckMetadata.interestCheckId ||
                        latestInterestCheckPreparedMetadata.interestCheckId,
                    )}
                  </span>
                </p>
                <p className="text-zinc-500 md:col-span-2">
                  Draft status:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestInterestCheckPreparedMetadata.status)}
                  </span>
                </p>
                <p className="text-zinc-500 md:col-span-2">
                  Missing required:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestInterestCheckMetadata.missingRequiredFields,
                    )}
                  </span>
                </p>
                <p className="text-zinc-500 md:col-span-2">
                  Missing optional:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestInterestCheckMetadata.missingOptionalFields,
                    )}
                  </span>
                </p>
                <p className="text-zinc-500 md:col-span-2">
                  Ambiguity:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestInterestCheckMetadata.ambiguityNotes)}
                  </span>
                </p>
                <p className="text-zinc-500 md:col-span-2">
                  Next question:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestInterestCheckMetadata.nextQuestion)}
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">
                Send an interest-check simulation message to see the mock/admin
                ReplyPlan. Draft creation only happens when enough safe info is
                present.
              </p>
            )}
          </div>
        </section>

        <form action={createNetworkProjectAction} className="rounded-lg border border-zinc-800 bg-black p-4">
          <input type="hidden" name="source" value="IMPORT" />
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">3. Existing Saga event import mock</h3>
            <button className={buttonClass}><Plus aria-hidden className="h-4 w-4" />Import</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClass}>Saga event ID<input name="existingSagaEventId" defaultValue="evt_demo_anime_rave" className={inputClass} /></label>
            <label className={labelClass}>Title<input name="title" defaultValue="Anime Rave LA" className={inputClass} /></label>
            <label className={labelClass}>City<input name="city" defaultValue="Los Angeles" className={inputClass} /></label>
            <label className={labelClass}>Date<input name="targetDate" defaultValue="Late summer" className={inputClass} /></label>
            <label className={labelClass}>Fandom/community<input name="fandoms" defaultValue="anime, cosplay, gaming" className={inputClass} /></label>
            <label className={labelClass}>Organizer phone<input name="organizerPhone" defaultValue={phone} className={inputClass} /></label>
            <label className={`${labelClass} md:col-span-2`}>Description<textarea name="description" rows={3} defaultValue="A fandom-aligned music night with DJs, guest cosplayers, photo moments, and community vendors." className={inputClass} /></label>
          </div>
        </form>

        <form action={createInterestCheckAction} className="rounded-lg border border-zinc-800 bg-black p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">4b. Interest check record</h3>
            <button className={buttonClass}><Plus aria-hidden className="h-4 w-4" />Create</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClass}>Creator phone<input name="creatorPhone" defaultValue={creatorPhone} className={inputClass} /></label>
            <label className={labelClass}>Title<input name="title" defaultValue="Maid cafe pop-up interest check" className={inputClass} /></label>
            <label className={labelClass}>City<input name="city" defaultValue="Los Angeles" className={inputClass} /></label>
            <label className={labelClass}>Fandoms<input name="fandoms" defaultValue="anime, maid cafe, cosplay" className={inputClass} /></label>
            <label className={labelClass}>Threshold<input name="thresholdValue" type="number" defaultValue="3" className={inputClass} /></label>
            <label className={`${labelClass} md:col-span-2`}>Description<textarea name="description" rows={3} defaultValue="A cute, fandom-led maid cafe pop-up with performers, themed snacks, and photo moments." className={inputClass} /></label>
          </div>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-lg border border-zinc-800 bg-black p-4">
          <h3 className="text-lg font-semibold">5-7. Matching, mock outreach, replies, and chat</h3>
          <div className="mt-4 space-y-4">
            {networkProjects.map((networkProject) => (
              <div key={networkProject.id} className="rounded-md border border-zinc-800 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link href={`/admin/network-projects/${networkProject.id}`} className="font-medium hover:text-white">{networkProject.title || "Untitled project"}</Link>
                    <p className="mt-1 text-xs text-zinc-500">{networkProject.roleOpenings.length} roles | {networkProject.conversations.length} conversations</p>
                  </div>
                  <StatusBadge status={networkProject.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {networkProject.roleOpenings.flatMap((role) => role.opportunities).map((opportunity) => (
                    <form key={opportunity.id} action={runRecommendationsAction.bind(null, opportunity.id)}>
                      <button className={buttonClass}><Sparkles aria-hidden className="h-4 w-4" />Match {opportunity.id.slice(0, 5)}</button>
                    </form>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <form action={approveMockRecommendationOutreachAction} className="mt-4 space-y-2">
            <input type="hidden" name="returnTo" value={returnTo} />
            {recommendations.map((recommendation) => (
              <label key={recommendation.id} className="flex items-start gap-3 rounded-md border border-zinc-800 p-3">
                <input name="recommendationIds" type="checkbox" value={recommendation.id} className="mt-1" />
                <span className="text-sm">
                  <span className="font-medium">{recommendation.person.name || recommendation.person.creatorProfile?.displayName || "Candidate"}</span>{" "}
                  <span className="text-zinc-500">for {recommendation.opportunity.roleOpening.title}, score {recommendation.score}, {recommendation.status}</span>
                  <span className="mt-1 block text-xs text-zinc-500">{recommendation.matchingReasons.join(", ")}</span>
                </span>
              </label>
            ))}
            {recommendations.length > 0 ? <button className={buttonClass}><Send aria-hidden className="h-4 w-4" />Approve mock outreach</button> : null}
          </form>
        </div>

        <aside className="space-y-4">
          <form action={simulateCandidateReplyAction} className="rounded-lg border border-zinc-800 bg-black p-4">
            <input type="hidden" name="returnTo" value={returnTo} />
            <h3 className="text-lg font-semibold">Fake contact reply</h3>
            <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status="CONVERSATION ENGINE" />
                <StatusBadge status="MOCK ACTIVE" />
                <StatusBadge status="NO LIVE SMS" />
              </div>
              <p className="mt-2">
                Contact replies update mock recommendation state only. Group
                chat creation remains a separate admin action.
              </p>
            </div>
            <select name="personId" className={`${inputClass} mt-4`}>
              {recommendations.length === 0 ? (
                <option value="">No demo recommendations yet</option>
              ) : null}
              {recommendations.map((recommendation) => (
                <option key={recommendation.id} value={recommendation.personId}>
                  {recommendation.person.name ||
                    redactPhoneForDisplay(recommendation.person.phone) ||
                    recommendation.personId}
                </option>
              ))}
            </select>
            <select name="body" className={inputClass}>
              <option value="YES">YES</option>
              <option value="MAYBE">MAYBE</option>
              <option value="NO">NO</option>
              <option value="YES, you can introduce me in the group">YES, consent to group</option>
              <option value="How much does it pay?">Payment question</option>
              <option value="What is this?">Clarifying question</option>
            </select>
            <button className={`${buttonClass} mt-3`}>Simulate reply</button>
          </form>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <h3 className="text-lg font-semibold">Contact reply debug</h3>
            {latestContactReplyAudit ? (
              <div className="mt-4 grid gap-2 text-sm">
                <p className="text-zinc-500">
                  Event:{" "}
                  <span className="text-zinc-200">
                    {latestContactReplyAudit.action}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Reply kind:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestContactReplyMetadata.replyKind)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Status:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestContactReplyMetadata.oldStatus)}
                    {" -> "}
                    {metadataText(latestContactReplyMetadata.newStatus)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Consent:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestContactReplyMetadata.consentToGroupChatBefore,
                    )}
                    {" -> "}
                    {metadataText(
                      latestContactReplyMetadata.consentToGroupChatAfter,
                    )}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Escalated:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestContactReplyMetadata.shouldEscalate)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Reply type:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestContactReplyMetadata.replyType)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Reply source:{" "}
                  <span className="text-zinc-200">
                    {replySourceText(latestContactReplyMetadata)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  LLM operation:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestContactReplyMetadata.llmOperation)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  LLM mode:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestContactReplyMetadata.llmMode)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Surface:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestContactReplyMetadata.llmExecutionSurface,
                    )}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Validation:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestContactReplyMetadata.llmValidationPassed,
                    )}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Fallback used:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestContactReplyMetadata.llmFallbackUsed)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Fallback reason:{" "}
                  <span className="text-zinc-200">
                    {metadataText(latestContactReplyMetadata.llmFallbackReason)}
                  </span>
                </p>
                <p className="text-zinc-500">
                  Forbidden claims:{" "}
                  <span className="text-zinc-200">
                    {metadataText(
                      latestContactReplyMetadata.forbiddenClaimsDetected,
                    )}
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">
                Simulate a fake contact reply to see the latest contact
                ReplyPlan. This does not create a group chat.
              </p>
            )}
          </section>

          <form action={createMockConversationAction} className="rounded-lg border border-zinc-800 bg-black p-4">
            <h3 className="text-lg font-semibold">Mock group conversation</h3>
            <select name="projectId" className={`${inputClass} mt-4`}>
              {networkProjects.map((item) => <option key={item.id} value={item.id}>{item.title || item.id}</option>)}
            </select>
            <div className="mt-3 space-y-2">
              {recommendations
                .filter((recommendation) => ["INTERESTED", "SHORTLISTED"].includes(recommendation.status))
                .map((recommendation) => (
                  <label key={recommendation.id} className="flex gap-3 rounded-md border border-zinc-800 p-2 text-sm">
                    <input name="recommendationIds" type="checkbox" value={recommendation.id} defaultChecked />
                    <span>{recommendation.person.name || "Candidate"} - {recommendation.opportunity.roleOpening.title}</span>
                  </label>
                ))}
            </div>
            <button className={`${buttonClass} mt-3`}>Create mock chat</button>
          </form>
        </aside>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <h3 className="text-lg font-semibold">Interest checks</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {interestChecks.map((check) => (
            <div key={check.id} className="rounded-md border border-zinc-800 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{check.title}</p>
                <StatusBadge status={check.status} />
              </div>
              <p className="mt-2 text-sm text-zinc-500">{check.currentInterestCount} / {check.thresholdValue || "admin"} interested</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={addInterestAction.bind(null, check.id)}><button className={buttonClass}>+1</button></form>
                <form action={convertInterestCheckAction.bind(null, check.id)}><button className={buttonClass}>Convert</button></form>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
