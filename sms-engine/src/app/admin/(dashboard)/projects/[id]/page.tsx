import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardList,
  MessageSquarePlus,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { MessageThread } from "@/components/admin/MessageThread";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  redactPhoneForDisplay,
  redactSensitiveTextForDisplay,
} from "@/lib/adminPrivacy";
import { getDb } from "@/lib/db";
import { findContactMatches } from "@/lib/contactMatching";
import { PILOT_FEEDBACK_CATEGORIES } from "@/lib/pilotReadiness";
import { briefTitle, parseRequiredRoles } from "@/lib/workflow";
import { buildShortlistMessage } from "@/lib/outreach";
import {
  approveSelectedOutreachAction,
  approveOutboundDraftAction,
  archiveProjectAction,
  approveShortlistPacketAction,
  createTaskAction,
  createGroupChatAction,
  createPilotFeedbackAction,
  draftSelectedOutreachAction,
  draftOutreachAction,
  editOutboundDraftAction,
  editShortlistPacketAction,
  evaluateOutboundDraftSendReadinessAction,
  generateCandidateOutreachDraftsAction,
  generateOrganizerShortlistMessageDraftAction,
  generateProducerInternalCandidatesAction,
  generateProducerProjectUnderstandingAction,
  generateProducerRoleMapAction,
  generateProducerShortlistDraftAction,
  generateShortlistPacketAction,
  generateProducerSourcingPlanAction,
  generateRoleMapAction,
  markNeedsAdminAction,
  rejectOutboundDraftAction,
  rejectShortlistPacketAction,
  reviewCandidateRecommendationAction,
  resolveNeedsAdminAction,
  sendManualMessageAction,
  sendShortlistAction,
  updateProjectBriefAction,
} from "@/app/admin/(dashboard)/actions";
import { candidateReviewStatuses } from "@/lib/producer/approvalQueue";

export const dynamic = "force-dynamic";

const projectStatuses = [
  "NEW_INBOUND",
  "INTAKE_IN_PROGRESS",
  "BRIEF_READY_FOR_REVIEW",
  "ROLE_MAPPING_READY",
  "OUTREACH_DRAFTED",
  "OUTREACH_IN_PROGRESS",
  "SHORTLIST_READY",
  "SHORTLIST_SENT",
  "GROUPCHAT_PENDING",
  "GROUPCHAT_ACTIVE",
  "PRODUCTION_IN_PROGRESS",
  "ARCHIVED",
  "NEEDS_ADMIN",
] as const;

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const labelClass = "block text-sm font-medium text-zinc-300";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

function jsonForTextarea(value: unknown) {
  return JSON.stringify(value ?? [], null, 2);
}

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function metadataStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function metadataText(value: unknown) {
  return typeof value === "string" ? value : null;
}

function metadataArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function metadataStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readinessMetadata(value: unknown) {
  const metadata = metadataObject(value);
  const check = metadataObject(metadata.lastReadinessCheck);
  const safety = metadataObject(check.safetySnapshot);
  const recipient = metadataObject(check.recipientSummary);
  const status =
    typeof check.readinessStatus === "string" ? check.readinessStatus : null;

  if (!status) return null;

  return {
    status,
    eligible: check.eligible === true,
    blockers: metadataStringArray(check.blockers),
    warnings: metadataStringArray(check.warnings),
    requiredActions: metadataStringArray(check.requiredActions),
    providerMode: metadataText(safety.providerMode) || "unknown",
    sendsDisabled: safety.sendsDisabled === true,
    allowlistRequired: safety.allowlistRequired === true,
    allowedNumbersCount:
      typeof safety.allowedNumbersCount === "number"
        ? safety.allowedNumbersCount
        : null,
    recipient: metadataText(recipient.redactedPhone) || "missing",
    isAllowlisted: recipient.isAllowlisted === true,
    optedOut: recipient.optedOut === true,
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getDb().projectBrief.findUnique({
    where: { id },
    include: {
      user: true,
      messages: {
        orderBy: { createdAt: "asc" },
      },
      outreaches: {
        include: { contact: true },
        orderBy: { updatedAt: "desc" },
      },
      groupChats: {
        include: {
          participants: true,
          tasks: true,
        },
        orderBy: { updatedAt: "desc" },
      },
      tasks: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      },
      pilotFeedback: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      shortlistPackets: {
        orderBy: { updatedAt: "desc" },
        take: 8,
      },
      outboundDrafts: {
        orderBy: { updatedAt: "desc" },
        take: 12,
      },
      project: true,
    },
  });

  if (!project) notFound();

  const roles = parseRequiredRoles(project.requiredRoles);
  const matchesByRole = roles.length > 0 ? await findContactMatches(project) : [];
  const interestedOutreaches = project.outreaches.filter((outreach) =>
    ["INTERESTED", "APPROVED_FOR_GROUPCHAT"].includes(outreach.status),
  );
  const consentedOutreaches = project.outreaches.filter(
    (outreach) =>
      outreach.status === "APPROVED_FOR_GROUPCHAT" &&
      outreach.consentToGroupChat,
  );
  const producerProject = project.projectId
    ? await getDb().project.findUnique({
        where: { id: project.projectId },
        include: {
          roleOpenings: {
            include: {
              opportunities: {
                include: {
                  recommendations: {
                    include: {
                      person: { include: { creatorProfile: true } },
                    },
                    orderBy: { score: "desc" },
                  },
                },
              },
            },
            orderBy: { updatedAt: "desc" },
          },
        },
      })
    : null;
  const auditEntityIds = [
    project.id,
    ...(producerProject ? [producerProject.id] : []),
    ...project.messages.map((message) => message.id),
    ...project.outreaches.map((outreach) => outreach.id),
    ...project.groupChats.map((groupChat) => groupChat.id),
    ...project.tasks.map((task) => task.id),
  ];
  const auditLogs = await getDb().auditLog.findMany({
    where: {
      entityId: { in: auditEntityIds },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const producerAuditLogs = auditLogs.filter((log) =>
    log.action.startsWith("producer."),
  );
  const latestProducerUnderstanding = producerAuditLogs.find(
    (log) => log.action === "producer.project_understanding_generated",
  );
  const latestProducerRoleMap = producerAuditLogs.find(
    (log) => log.action === "producer.role_map_generated",
  );
  const latestProducerSourcingPlan = producerAuditLogs.find(
    (log) => log.action === "producer.sourcing_plan_generated",
  );
  const latestProducerShortlistDraft = producerAuditLogs.find(
    (log) => log.action === "producer.shortlist_draft_generated",
  );
  const shortlistMetadata = metadataObject(latestProducerShortlistDraft?.metadata);
  const shortlistDraft = buildShortlistMessage(
    project,
    interestedOutreaches.map((outreach) => outreach.contact),
  );
  const updateAction = updateProjectBriefAction.bind(null, project.id);
  const roleAction = generateRoleMapAction.bind(null, project.id);
  const producerUnderstandingAction =
    generateProducerProjectUnderstandingAction.bind(null, project.id);
  const producerRoleMapAction = generateProducerRoleMapAction.bind(null, project.id);
  const producerSourcingPlanAction = generateProducerSourcingPlanAction.bind(
    null,
    project.id,
  );
  const producerCandidatesAction = generateProducerInternalCandidatesAction.bind(
    null,
    project.id,
  );
  const producerShortlistDraftAction = generateProducerShortlistDraftAction.bind(
    null,
    project.id,
  );
  const shortlistPacketAction = generateShortlistPacketAction.bind(null, project.id);
  const candidateOutreachDraftsAction =
    generateCandidateOutreachDraftsAction.bind(null, project.id);
  const draftAction = draftOutreachAction.bind(null, project.id);
  const draftSelectedAction = draftSelectedOutreachAction.bind(null, project.id);
  const approveAction = approveSelectedOutreachAction.bind(null, project.id);
  const shortlistAction = sendShortlistAction.bind(null, project.id);
  const groupChatAction = createGroupChatAction.bind(null, project.id);
  const needsAdminAction = markNeedsAdminAction.bind(null, project.id);
  const resolveNeedsAdmin = resolveNeedsAdminAction.bind(null, project.id);
  const archiveProject = archiveProjectAction.bind(null, project.id);
  const manualMessageAction = sendManualMessageAction.bind(null, project.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            Project brief
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{briefTitle(project)}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge status={project.status} />
            <span className="font-mono text-xs text-zinc-500">
              {redactPhoneForDisplay(project.user.phone)}
            </span>
            <span className="font-mono text-xs text-zinc-500">
              Updated {project.updatedAt.toLocaleString()}
            </span>
          </div>
        </div>
        <form action={needsAdminAction}>
          <button className={buttonClass}>
            <AlertTriangle aria-hidden className="h-4 w-4" />
            Mark needs admin
          </button>
        </form>
      </div>

      {project.status === "NEEDS_ADMIN" ? (
        <section className="rounded-lg border border-red-800 bg-red-950/40 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-red-100">
                <AlertTriangle aria-hidden className="h-4 w-4" />
                <h3 className="font-semibold">Human review needed</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-red-100/80">
                Reason: {project.escalationReason || "manual review"}.
                Flags:{" "}
                {Array.isArray(project.escalationFlags)
                  ? project.escalationFlags.join(", ") || "none"
                  : "none"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={resolveNeedsAdmin} className="flex gap-2">
                <select name="returnStatus" className={inputClass}>
                  <option value={project.previousStatus || "INTAKE_IN_PROGRESS"}>
                    Return to{" "}
                    {(project.previousStatus || "INTAKE_IN_PROGRESS").replaceAll(
                      "_",
                      " ",
                    )}
                  </option>
                  <option value="INTAKE_IN_PROGRESS">Intake in progress</option>
                  <option value="BRIEF_READY_FOR_REVIEW">
                    Brief ready for review
                  </option>
                  <option value="OUTREACH_IN_PROGRESS">
                    Outreach in progress
                  </option>
                  <option value="GROUPCHAT_ACTIVE">Group chat active</option>
                </select>
                <button className={buttonClass}>
                  <CheckCircle2 aria-hidden className="h-4 w-4" />
                  Resolve
                </button>
              </form>
              <form action={archiveProject}>
                <button className={buttonClass}>
                  <Archive aria-hidden className="h-4 w-4" />
                  Archive
                </button>
              </form>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-6">
          <form
            action={updateAction}
            className="rounded-lg border border-zinc-800 bg-black p-4"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Structured brief</h3>
              <button className={buttonClass}>
                <Save aria-hidden className="h-4 w-4" />
                Save brief
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelClass}>
                Status
                <select
                  name="status"
                  defaultValue={project.status}
                  className={inputClass}
                >
                  {projectStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                First-time host
                <select
                  name="firstTimeHost"
                  defaultValue={
                    project.firstTimeHost === null
                      ? ""
                      : String(project.firstTimeHost)
                  }
                  className={inputClass}
                >
                  <option value="">Unknown</option>
                  <option value="true">First time</option>
                  <option value="false">Has produced before</option>
                </select>
              </label>
              <label className={labelClass}>
                City
                <input
                  name="city"
                  defaultValue={project.city || ""}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Project type
                <input
                  name="projectType"
                  defaultValue={project.projectType || ""}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Title
                <input
                  name="title"
                  defaultValue={project.title || ""}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Target date or timing
                <input
                  name="targetDate"
                  defaultValue={project.targetDate || ""}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Budget range
                <input
                  name="budgetRange"
                  defaultValue={project.budgetRange || ""}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Expected audience size
                <input
                  name="expectedAudienceSize"
                  defaultValue={project.expectedAudienceSize || ""}
                  className={inputClass}
                />
              </label>
            </div>
            <div className="mt-4 grid gap-4">
              <label className={labelClass}>
                Description
                <textarea
                  name="description"
                  defaultValue={project.description || ""}
                  rows={4}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Scope
                <textarea
                  name="scope"
                  defaultValue={project.scope || ""}
                  rows={3}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Vibe
                <textarea
                  name="vibe"
                  defaultValue={project.vibe || ""}
                  rows={3}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Help they think they need
                <textarea
                  name="helpNeeded"
                  defaultValue={project.helpNeeded || ""}
                  rows={3}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Required roles JSON
                <textarea
                  name="requiredRoles"
                  defaultValue={jsonForTextarea(project.requiredRoles)}
                  rows={8}
                  className={`${inputClass} font-mono text-xs`}
                />
              </label>
              <label className={labelClass}>
                Admin notes
                <textarea
                  name="adminNotes"
                  defaultValue={project.adminNotes || ""}
                  rows={4}
                  className={inputClass}
                />
              </label>
            </div>
          </form>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Message thread</h3>
              <span className="font-mono text-xs text-zinc-500">
                {project.messages.length} messages
              </span>
            </div>
            <MessageThread messages={project.messages} />
          </section>

          <form
            action={manualMessageAction}
            className="rounded-lg border border-zinc-800 bg-black p-4"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Manual outbound</h3>
              <button className={buttonClass}>
                <Send aria-hidden className="h-4 w-4" />
                Send manual SMS
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
              <label className={labelClass}>
                Recipient
                <select name="recipient" required className={inputClass}>
                  <option value="organizer">
                    Organizer - {redactPhoneForDisplay(project.user.phone)}
                  </option>
                  {project.outreaches.map((outreach) => (
                    <option
                      key={outreach.contactId}
                      value={`contact:${outreach.contactId}`}
                    >
                      {outreach.contact.name} -{" "}
                      {redactPhoneForDisplay(outreach.contact.phone)}
                    </option>
                  ))}
                  {project.groupChats
                    .filter(
                      (groupChat) =>
                        groupChat.status === "ACTIVE" &&
                        groupChat.twilioConversationSid,
                    )
                    .map((groupChat) => (
                      <option key={groupChat.id} value={`group:${groupChat.id}`}>
                        Active group chat - {groupChat.twilioConversationSid}
                      </option>
                    ))}
                </select>
              </label>
              <label className={labelClass}>
                Message
                <textarea
                  name="body"
                  required
                  rows={4}
                  className={inputClass}
                  placeholder="Write a human-approved reply..."
                />
              </label>
            </div>
          </form>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Pilot feedback</h3>
              <a
                href="/admin/pilot-feedback"
                className="text-xs font-medium text-zinc-400 transition hover:text-white"
              >
                View all
              </a>
            </div>
            <form action={createPilotFeedbackAction} className="grid gap-4">
              <input type="hidden" name="projectBriefId" value={project.id} />
              <div className="grid gap-4 md:grid-cols-[1fr_120px]">
                <label className={labelClass}>
                  Category
                  <select
                    name="category"
                    className={inputClass}
                    defaultValue="other"
                  >
                    {PILOT_FEEDBACK_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Rating
                  <select name="rating" className={inputClass} defaultValue="">
                    <option value="">None</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                </label>
              </div>
              <label className={labelClass}>
                Notes
                <textarea
                  name="notes"
                  required
                  rows={3}
                  className={inputClass}
                  placeholder="Capture private design-partner or operator feedback..."
                />
              </label>
              <button className={`${buttonClass} w-fit`}>
                <MessageSquarePlus aria-hidden className="h-4 w-4" />
                Add feedback
              </button>
            </form>
            {project.pilotFeedback.length > 0 ? (
              <div className="mt-4 space-y-2">
                {project.pilotFeedback.map((feedback) => (
                  <div
                    key={feedback.id}
                    className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs uppercase text-zinc-400">
                        {feedback.category}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {feedback.rating ? `${feedback.rating}/5` : "unrated"} |{" "}
                        {feedback.createdAt.toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-zinc-300">
                      {redactSensitiveTextForDisplay(feedback.notes)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList aria-hidden className="h-4 w-4 text-zinc-500" />
              <h3 className="text-lg font-semibold">Audit log</h3>
            </div>
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-md border border-zinc-800 bg-zinc-950 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs uppercase text-zinc-300">
                      {log.action}
                    </p>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {log.createdAt.toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {log.actorType} | {log.entityType}
                  </p>
                </div>
              ))}
              {auditLogs.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No audit events recorded yet.
                </p>
              ) : null}
            </div>
          </section>
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <h3 className="text-lg font-semibold">Workflow actions</h3>
            <div className="mt-4 grid gap-3">
              <form action={roleAction}>
                <button className={`${buttonClass} w-full`}>
                  <Sparkles aria-hidden className="h-4 w-4" />
                  Generate role map
                </button>
              </form>
              <form action={draftAction}>
                <button className={`${buttonClass} w-full`}>
                  <Send aria-hidden className="h-4 w-4" />
                  Draft top matched outreach
                </button>
              </form>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Producer Agent v0.1</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Draft-only intelligence. No SMS, no outreach, no web sourcing,
                  and no group chat automation.
                </p>
              </div>
              <Sparkles aria-hidden className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="grid gap-2">
              <form action={producerUnderstandingAction}>
                <button className={`${buttonClass} w-full`}>
                  Generate Project Understanding
                </button>
              </form>
              <form action={producerRoleMapAction}>
                <button className={`${buttonClass} w-full`}>
                  Generate Role Map
                </button>
              </form>
              <form action={producerSourcingPlanAction}>
                <button className={`${buttonClass} w-full`}>
                  Generate Sourcing Plan
                </button>
              </form>
              <form action={producerCandidatesAction}>
                <button className={`${buttonClass} w-full`}>
                  Generate Internal Candidate Recommendations
                </button>
              </form>
              <form action={producerShortlistDraftAction}>
                <button className={`${buttonClass} w-full`}>
                  Generate Shortlist Draft
                </button>
              </form>
              <form action={candidateOutreachDraftsAction}>
                <button className={`${buttonClass} w-full`}>
                  Generate Candidate Outreach Drafts
                </button>
              </form>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                <p className="font-mono text-xs uppercase text-zinc-500">
                  Project understanding
                </p>
                {latestProducerUnderstanding ? (
                  <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-xs leading-5 text-zinc-300">
                    {JSON.stringify(latestProducerUnderstanding.metadata, null, 2)}
                  </pre>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">
                    Not generated yet.
                  </p>
                )}
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                <p className="font-mono text-xs uppercase text-zinc-500">
                  Role map / sourcing
                </p>
                {latestProducerRoleMap || latestProducerSourcingPlan ? (
                  <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap text-xs leading-5 text-zinc-300">
                    {JSON.stringify(
                      {
                        roleMap: latestProducerRoleMap?.metadata,
                        sourcingPlan: latestProducerSourcingPlan?.metadata,
                      },
                      null,
                      2,
                    )}
                  </pre>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">
                    Not generated yet.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">AI role map</h3>
              <UsersRound aria-hidden className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="space-y-3">
              {roles.map((role) => (
                <div
                  key={role.role}
                  className="rounded-md border border-zinc-800 bg-zinc-950 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{role.role}</p>
                    <span className="font-mono text-[10px] uppercase text-zinc-500">
                      {role.priority.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {role.reason}
                  </p>
                </div>
              ))}
              {roles.length === 0 ? (
                <p className="text-sm leading-6 text-zinc-500">
                  No roles generated yet.
                </p>
              ) : null}
            </div>
          </section>

          <form
            action={draftSelectedAction}
            className="rounded-lg border border-zinc-800 bg-black p-4"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Matching contacts</h3>
              <button className={buttonClass}>
                <Send aria-hidden className="h-4 w-4" />
                Draft selected
              </button>
            </div>
            <div className="space-y-4">
              {matchesByRole.map((group) => (
                <div key={group.role.role}>
                  <p className="mb-2 text-sm font-medium text-zinc-300">
                    {group.role.role}
                  </p>
                  <div className="space-y-2">
                    {group.matches.map((match) => (
                      <label
                        key={`${group.role.role}-${match.contact.id}`}
                        className="flex items-start gap-3 rounded-md border border-zinc-800 p-3"
                      >
                        <input
                          name="contactIds"
                          type="checkbox"
                          value={match.contact.id}
                          className="mt-1"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {match.contact.name}{" "}
                            <span className="font-mono text-xs text-zinc-500">
                              score {match.score}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-zinc-500">
                            {match.contact.city || "No city"} |{" "}
                            {match.reasons.join(", ")}
                          </span>
                        </span>
                      </label>
                    ))}
                    {group.matches.length === 0 ? (
                      <p className="rounded-md border border-zinc-800 p-3 text-sm text-zinc-500">
                        No contacts matched this role yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
              {matchesByRole.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Generate a role map before matching contacts.
                </p>
              ) : null}
            </div>
          </form>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">
                Internal candidate recommendations
              </h3>
              <StatusBadge status="DRAFT_ONLY" />
            </div>
            <div className="space-y-4">
              {producerProject?.roleOpenings.map((roleOpening) => {
                const recommendations = roleOpening.opportunities.flatMap(
                  (opportunity) => opportunity.recommendations,
                );
                return (
                  <div key={roleOpening.id}>
                    <p className="mb-2 text-sm font-medium text-zinc-300">
                      {roleOpening.title}
                    </p>
                    <div className="space-y-2">
                      {recommendations.map((recommendation) => {
                        const profile = recommendation.person.creatorProfile;
                        const breakdown = metadataObject(
                          recommendation.scoreBreakdown,
                        );
                        const reviewAction =
                          reviewCandidateRecommendationAction.bind(
                            null,
                            project.id,
                            recommendation.id,
                          );
                        const isReviewQueueStatus = (
                          candidateReviewStatuses as readonly string[]
                        ).includes(recommendation.status);
                        return (
                          <div
                            key={recommendation.id}
                            className="rounded-md border border-zinc-800 p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium">
                                {profile?.displayName ||
                                recommendation.person.name ||
                                  "Internal candidate"}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge status={recommendation.status} />
                                <span className="font-mono text-xs text-zinc-500">
                                  score {recommendation.score}
                                </span>
                              </div>
                            </div>
                            <p className="mt-1 text-xs text-zinc-500">
                              {profile?.city ||
                                recommendation.person.city ||
                                "No city"}{" "}
                              | {recommendation.proximityTier} |{" "}
                              {profile?.reviewStatus || "NO_PROFILE"}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-zinc-400">
                              {recommendation.matchingReasons.join(", ")}
                            </p>
                            {recommendation.risks.length > 0 ? (
                              <p className="mt-2 text-xs leading-5 text-amber-200">
                                Risks: {recommendation.risks.join(", ")}
                              </p>
                            ) : null}
                            <p className="mt-2 text-xs leading-5 text-zinc-500">
                              Breakdown: role {String(breakdown.roleFit || 0)},
                              fandom {String(breakdown.fandomFit || 0)}, location{" "}
                              {String(breakdown.locationFit || 0)}, proximity{" "}
                              {String(breakdown.proximity || 0)}, reliability{" "}
                              {String(breakdown.reliability || 0)}
                            </p>
                            {isReviewQueueStatus ? (
                              <form
                                action={reviewAction}
                                className="mt-3 grid gap-3 rounded-md border border-zinc-900 bg-zinc-950 p-3"
                              >
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <label className={labelClass}>
                                    Review decision
                                    <select
                                      name="status"
                                      defaultValue={recommendation.status}
                                      className={inputClass}
                                    >
                                      {candidateReviewStatuses.map((status) => (
                                        <option key={status} value={status}>
                                          {status.replaceAll("_", " ")}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className={labelClass}>
                                    Shortlist reason override
                                    <input
                                      name="shortlistReasonOverride"
                                      defaultValue={
                                        recommendation.shortlistReasonOverride || ""
                                      }
                                      className={inputClass}
                                      placeholder="Optional admin-edited reason"
                                    />
                                  </label>
                                </div>
                                <label className={labelClass}>
                                  Organizer-facing summary override
                                  <textarea
                                    name="organizerFacingSummaryOverride"
                                    rows={2}
                                    defaultValue={
                                      recommendation.organizerFacingSummaryOverride ||
                                      ""
                                    }
                                    className={inputClass}
                                    placeholder="Optional safe organizer-facing fit summary"
                                  />
                                </label>
                                <label className={labelClass}>
                                  Admin review notes
                                  <textarea
                                    name="adminReviewNotes"
                                    rows={2}
                                    defaultValue={
                                      recommendation.adminReviewNotes || ""
                                    }
                                    className={inputClass}
                                    placeholder="Internal notes; never sent in shortlist packet"
                                  />
                                </label>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs leading-5 text-zinc-500">
                                    Approving for shortlist never sends SMS,
                                    creates outreach, or creates a group chat.
                                  </p>
                                  <button className={buttonClass}>
                                    <Save aria-hidden className="h-4 w-4" />
                                    Save review
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <p className="mt-3 rounded-md border border-zinc-900 bg-zinc-950 p-3 text-xs leading-5 text-zinc-500">
                                This candidate is already in the outreach or
                                team workflow. Use the existing outreach and
                                consent controls instead of the shortlist review
                                queue.
                              </p>
                            )}
                          </div>
                        );
                      })}
                      {recommendations.length === 0 ? (
                        <p className="rounded-md border border-zinc-800 p-3 text-sm text-zinc-500">
                          No internal recommendations generated for this role yet.
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {!producerProject || producerProject.roleOpenings.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Generate Producer Agent candidate recommendations to populate
                  the internal approval queue.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Shortlist draft queue</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Draft-only. Admin review is required before any organizer sees
                  a shortlist.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status="ADMIN_REVIEW_REQUIRED" />
                <form action={shortlistPacketAction}>
                  <button className={buttonClass}>Generate packet</button>
                </form>
              </div>
            </div>
            {latestProducerShortlistDraft ? (
              <div className="space-y-3">
                <p className="text-sm leading-6 text-zinc-300">
                  {metadataText(shortlistMetadata.organizerFacingSummary)}
                </p>
                <p className="text-sm leading-6 text-zinc-400">
                  {metadataText(shortlistMetadata.recommendedNextOrganizerCopy)}
                </p>
                <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                  <p className="font-mono text-xs uppercase text-zinc-500">
                    Coverage
                  </p>
                  <p className="mt-2 text-xs leading-5 text-zinc-400">
                    Covered:{" "}
                    {metadataStringList(
                      metadataObject(shortlistMetadata.coverage).rolesCovered,
                    ).join(", ") || "none"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">
                    Missing:{" "}
                    {metadataStringList(
                      metadataObject(shortlistMetadata.coverage).rolesMissing,
                    ).join(", ") || "none"}
                  </p>
                </div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs leading-5 text-zinc-300">
                  {JSON.stringify(shortlistMetadata.candidateSummaries || [], null, 2)}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                No Producer Agent shortlist draft generated yet.
              </p>
            )}
          </section>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">
                  Shortlist approval packets
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Packets can be approved for internal readiness only. Approval
                  does not send SMS, contact candidates, contact organizers, or
                  create group chats.
                </p>
              </div>
              <StatusBadge status="NO_SMS_SENT" />
            </div>
            <div className="space-y-4">
              {project.shortlistPackets.map((packet) => {
                const editPacketAction = editShortlistPacketAction.bind(
                  null,
                  project.id,
                  packet.id,
                );
                const approvePacketAction = approveShortlistPacketAction.bind(
                  null,
                  project.id,
                  packet.id,
                );
                const rejectPacketAction = rejectShortlistPacketAction.bind(
                  null,
                  project.id,
                  packet.id,
                );
                const organizerDraftAction =
                  generateOrganizerShortlistMessageDraftAction.bind(
                    null,
                    project.id,
                    packet.id,
                  );
                const rolesCovered = metadataStringList(packet.rolesCovered);
                const rolesMissing = metadataStringList(packet.rolesMissing);
                const candidateSummaries = metadataArray(
                  packet.candidateSummaries,
                );

                return (
                  <div
                    key={packet.id}
                    className="rounded-md border border-zinc-800 bg-zinc-950 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          Packet {packet.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Updated {packet.updatedAt.toLocaleString()}
                        </p>
                      </div>
                      <StatusBadge status={packet.status} />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs leading-5 text-zinc-400 sm:grid-cols-2">
                      <p>Covered: {rolesCovered.join(", ") || "none"}</p>
                      <p>Missing: {rolesMissing.join(", ") || "none"}</p>
                    </div>
                    <form action={editPacketAction} className="mt-3 space-y-3">
                      <label className={labelClass}>
                        Organizer-facing summary
                        <textarea
                          name="organizerFacingSummary"
                          rows={4}
                          defaultValue={packet.organizerFacingSummary}
                          className={inputClass}
                        />
                      </label>
                      <label className={labelClass}>
                        Admin notes
                        <textarea
                          name="adminNotes"
                          rows={2}
                          defaultValue={packet.adminNotes || ""}
                          className={inputClass}
                        />
                      </label>
                      <button className={buttonClass}>
                        <Save aria-hidden className="h-4 w-4" />
                        Save packet text
                      </button>
                    </form>
                    <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-800 bg-black p-3 text-xs leading-5 text-zinc-300">
                      {JSON.stringify(candidateSummaries, null, 2)}
                    </pre>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <form action={organizerDraftAction}>
                        <button className={buttonClass}>
                          <Send aria-hidden className="h-4 w-4" />
                          Prepare organizer draft
                        </button>
                      </form>
                      <form action={approvePacketAction}>
                        <button className={buttonClass}>
                          <CheckCircle2 aria-hidden className="h-4 w-4" />
                          Approve packet
                        </button>
                      </form>
                      <form action={rejectPacketAction}>
                        <button className={buttonClass}>
                          <AlertTriangle aria-hidden className="h-4 w-4" />
                          Reject packet
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
              {project.shortlistPackets.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No shortlist packets yet. Approve at least one candidate for
                  shortlist, then generate a packet for admin review.
                </p>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">
                  Producer outbound drafts
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Organizer shortlist and candidate outreach drafts for admin
                  review. Approving a draft does not send SMS, create outreach,
                  contact candidates, or create group chats.
                </p>
              </div>
              <StatusBadge status="DRAFT_ONLY" />
            </div>
            <div className="space-y-4">
              {project.outboundDrafts.map((draft) => {
                const editDraftAction = editOutboundDraftAction.bind(
                  null,
                  project.id,
                  draft.id,
                );
                const approveDraftAction = approveOutboundDraftAction.bind(
                  null,
                  project.id,
                  draft.id,
                );
                const rejectDraftAction = rejectOutboundDraftAction.bind(
                  null,
                  project.id,
                  draft.id,
                );
                const evaluateDraftAction =
                  evaluateOutboundDraftSendReadinessAction.bind(
                    null,
                    project.id,
                    draft.id,
                  );
                const readiness = readinessMetadata(draft.metadata);

                return (
                  <div
                    key={draft.id}
                    className="rounded-md border border-zinc-800 bg-zinc-950 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {draft.type.replaceAll("_", " ").toLowerCase()} draft
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {draft.recipientKind} | {draft.source} | updated{" "}
                          {draft.updatedAt.toLocaleString()}
                        </p>
                      </div>
                      <StatusBadge status={draft.status} />
                    </div>
                    {draft.blockReason ? (
                      <p className="mt-3 rounded-md border border-amber-400/30 bg-amber-400/10 p-2 text-xs leading-5 text-amber-100">
                        Blocked: {draft.blockReason}
                      </p>
                    ) : null}
                    <div className="mt-3 rounded-md border border-zinc-800 bg-black p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">Send readiness</p>
                          <p className="mt-1 text-xs leading-5 text-zinc-500">
                            Dry run only. This check never sends SMS or calls
                            Twilio.
                          </p>
                        </div>
                        {readiness ? (
                          <StatusBadge status={readiness.status} />
                        ) : null}
                      </div>
                      {readiness ? (
                        <div className="mt-3 grid gap-2 text-xs leading-5 text-zinc-500 md:grid-cols-2">
                          <p>Eligible: {readiness.eligible ? "yes" : "no"}</p>
                          <p>Recipient: {readiness.recipient}</p>
                          <p>Provider: {readiness.providerMode}</p>
                          <p>
                            Sends disabled:{" "}
                            {readiness.sendsDisabled ? "true" : "false"}
                          </p>
                          <p>
                            Allowlist required:{" "}
                            {readiness.allowlistRequired ? "true" : "false"}
                          </p>
                          <p>
                            Allowed count:{" "}
                            {readiness.allowedNumbersCount ?? "unknown"}
                          </p>
                          <p>
                            Allowlisted:{" "}
                            {readiness.isAllowlisted ? "true" : "false"}
                          </p>
                          <p>
                            Opted out: {readiness.optedOut ? "true" : "false"}
                          </p>
                          {readiness.blockers.length > 0 ? (
                            <div className="md:col-span-2">
                              <p className="font-medium text-zinc-300">
                                Blockers
                              </p>
                              <ul className="mt-1 list-disc space-y-1 pl-5">
                                {readiness.blockers.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {readiness.requiredActions.length > 0 ? (
                            <div className="md:col-span-2">
                              <p className="font-medium text-zinc-300">
                                Required actions
                              </p>
                              <ul className="mt-1 list-disc space-y-1 pl-5">
                                {readiness.requiredActions.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-zinc-500">
                          No readiness check has been run for this draft yet.
                        </p>
                      )}
                      <form action={evaluateDraftAction} className="mt-3">
                        <button className={buttonClass}>
                          <ShieldCheck aria-hidden className="h-4 w-4" />
                          Evaluate send readiness
                        </button>
                      </form>
                    </div>
                    <form action={editDraftAction} className="mt-3 space-y-3">
                      <label className={labelClass}>
                        Draft body
                        <textarea
                          name="editedBody"
                          rows={5}
                          defaultValue={draft.editedBody || draft.body}
                          className={inputClass}
                        />
                      </label>
                      <label className={labelClass}>
                        Admin notes
                        <textarea
                          name="adminNotes"
                          rows={2}
                          defaultValue={draft.adminNotes || ""}
                          className={inputClass}
                          placeholder="Internal notes; never sent"
                        />
                      </label>
                      <button className={buttonClass}>
                        <Save aria-hidden className="h-4 w-4" />
                        Save draft
                      </button>
                    </form>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <form action={approveDraftAction}>
                        <button className={buttonClass}>
                          <CheckCircle2 aria-hidden className="h-4 w-4" />
                          Approve draft
                        </button>
                      </form>
                      <form action={rejectDraftAction}>
                        <button className={buttonClass}>
                          <AlertTriangle aria-hidden className="h-4 w-4" />
                          Reject draft
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
              {project.outboundDrafts.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No outbound drafts prepared yet. Generate candidate outreach
                  drafts from approved shortlist candidates or prepare organizer
                  copy from an approved shortlist packet.
                </p>
              ) : null}
            </div>
          </section>

          <form
            action={approveAction}
            className="rounded-lg border border-zinc-800 bg-black p-4"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Outreach</h3>
              <button className={buttonClass}>
                <Send aria-hidden className="h-4 w-4" />
                Approve selected
              </button>
            </div>
            <div className="space-y-3">
              {project.outreaches.map((outreach) => (
                <div
                  key={outreach.id}
                  className="block rounded-md border border-zinc-800 p-3"
                >
                  <div className="flex items-start gap-3">
                    <input
                      name="outreachIds"
                      type="checkbox"
                      value={outreach.id}
                      disabled={outreach.status !== "DRAFTED"}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{outreach.contact.name}</p>
                        <StatusBadge status={outreach.status} />
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                        {outreach.draftedMessage}
                      </p>
                      {outreach.status === "DRAFTED" ? (
                        <label className={`${labelClass} mt-3`}>
                          Edit before send
                          <textarea
                            name={`draftedMessage:${outreach.id}`}
                            rows={4}
                            defaultValue={outreach.draftedMessage}
                            className={inputClass}
                          />
                        </label>
                      ) : null}
                      {outreach.lastResponse ? (
                        <p className="mt-2 text-xs text-zinc-500">
                          Last response: {outreach.lastResponse}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {project.outreaches.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No outreach drafted yet.
                </p>
              ) : null}
            </div>
          </form>

          <form
            action={shortlistAction}
            className="rounded-lg border border-zinc-800 bg-black p-4"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Shortlist</h3>
              <button className={buttonClass}>
                <CheckCircle2 aria-hidden className="h-4 w-4" />
                Send shortlist
              </button>
            </div>
            <div className="space-y-2">
              {interestedOutreaches.map((outreach) => (
                <label
                  key={outreach.id}
                  className="flex items-start gap-3 rounded-md border border-zinc-800 p-3"
                >
                  <input
                    name="contactIds"
                    type="checkbox"
                    value={outreach.contactId}
                    defaultChecked
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {outreach.contact.name}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      {outreach.contact.roles[0] || "Collaborator"} | consent{" "}
                      {outreach.consentToGroupChat ? "confirmed" : "pending"}
                    </span>
                  </span>
                </label>
              ))}
              {interestedOutreaches.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No interested contacts yet.
                </p>
              ) : null}
            </div>
            <label className={`${labelClass} mt-4`}>
              Shortlist message
              <textarea
                name="shortlistMessage"
                rows={7}
                defaultValue={
                  interestedOutreaches.length > 0 ? shortlistDraft : ""
                }
                className={inputClass}
              />
            </label>
          </form>

          <form
            action={groupChatAction}
            className="rounded-lg border border-zinc-800 bg-black p-4"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Group chat setup</h3>
              <button className={buttonClass}>
                <MessageSquarePlus aria-hidden className="h-4 w-4" />
                Create group chat
              </button>
            </div>
            <p className="mb-3 text-sm leading-6 text-zinc-500">
              Organizer is included automatically. Contacts require explicit
              consent before they can be selected.
            </p>
            <div className="space-y-2">
              {consentedOutreaches.map((outreach) => (
                <label
                  key={outreach.id}
                  className="flex items-start gap-3 rounded-md border border-zinc-800 p-3"
                >
                  <input
                    name="contactIds"
                    type="checkbox"
                    value={outreach.contactId}
                    defaultChecked
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {outreach.contact.name}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      {redactPhoneForDisplay(outreach.contact.phone)} |{" "}
                      {outreach.contact.roles[0] || "Team member"}
                    </span>
                  </span>
                </label>
              ))}
              {project.outreaches
                .filter(
                  (outreach) =>
                    outreach.status === "INTERESTED" &&
                    !outreach.consentToGroupChat,
                )
                .map((outreach) => (
                  <p
                    key={outreach.id}
                    className="rounded-md border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-100"
                  >
                    {outreach.contact.name} is interested but has not consented
                    to group SMS yet.
                  </p>
                ))}
              {consentedOutreaches.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No contacts have confirmed group chat consent yet.
                </p>
              ) : null}
            </div>
          </form>

          <form
            action={createTaskAction}
            className="rounded-lg border border-zinc-800 bg-black p-4"
          >
            <input type="hidden" name="projectBriefId" value={project.id} />
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Create task</h3>
              <button className={buttonClass}>
                <Plus aria-hidden className="h-4 w-4" />
                Add task
              </button>
            </div>
            <div className="grid gap-3">
              <label className={labelClass}>
                Group chat
                <select name="groupChatId" className={inputClass}>
                  <option value="">None</option>
                  {project.groupChats.map((groupChat) => (
                    <option key={groupChat.id} value={groupChat.id}>
                      {groupChat.twilioConversationSid || groupChat.status}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Title
                <input name="title" required className={inputClass} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  Owner
                  <input name="ownerName" className={inputClass} />
                </label>
                <label className={labelClass}>
                  Owner phone
                  <input name="ownerPhone" className={inputClass} />
                </label>
                <label className={labelClass}>
                  Due date
                  <input name="dueDate" type="date" className={inputClass} />
                </label>
                <label className={labelClass}>
                  Status
                  <select name="status" defaultValue="TODO" className={inputClass}>
                    <option value="TODO">TODO</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="DONE">DONE</option>
                    <option value="BLOCKED">BLOCKED</option>
                  </select>
                </label>
              </div>
              <label className={labelClass}>
                Description
                <textarea name="description" rows={3} className={inputClass} />
              </label>
            </div>
          </form>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <h3 className="text-lg font-semibold">Group chats and tasks</h3>
            <div className="mt-4 space-y-4">
              {project.groupChats.map((groupChat) => (
                <div
                  key={groupChat.id}
                  className="rounded-md border border-zinc-800 p-3"
                >
                  <div className="flex items-center justify-between">
                    <StatusBadge status={groupChat.status} />
                    <span className="font-mono text-[10px] text-zinc-500">
                      {groupChat.twilioConversationSid || "no SID"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-zinc-400">
                    {groupChat.participants.length} participants |{" "}
                    {groupChat.tasks.length} tasks
                  </p>
                </div>
              ))}
              {project.groupChats.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No group chat created yet.
                </p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
