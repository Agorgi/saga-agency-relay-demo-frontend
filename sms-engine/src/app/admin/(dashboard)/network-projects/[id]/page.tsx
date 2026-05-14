import { notFound } from "next/navigation";
import { CheckCircle2, Plus, Save, Send, Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { redactPhoneForDisplay } from "@/sms-engine/adminPrivacy";
import { getDb } from "@/sms-engine/db";
import {
  approveMockRecommendationOutreachAction,
  createMockConversationAction,
  createOpportunityAction,
  generateNetworkRoleOpeningsAction,
  runRecommendationsAction,
  updateNetworkProjectAction,
  updateRoleOpeningAction,
} from "@/app/admin/(dashboard)/network-actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const labelClass = "block text-sm font-medium text-zinc-300";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

export default async function NetworkProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getDb().project.findUnique({
    where: { id },
    include: {
      organizerPerson: true,
      roleOpenings: {
        include: {
          opportunities: {
            include: {
              recommendations: {
                include: { person: { include: { creatorProfile: true } } },
                orderBy: { score: "desc" },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      team: { include: { members: { include: { person: true, roleOpening: true } } } },
      conversations: { orderBy: { updatedAt: "desc" } },
    },
  });
  if (!project) notFound();

  const auditLogs = await getDb().auditLog.findMany({
    where: {
      OR: [
        { entityId: project.id },
        { entityId: { in: project.conversations.map((conversation) => conversation.id) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const updateProject = updateNetworkProjectAction.bind(null, project.id);
  const generateRoles = generateNetworkRoleOpeningsAction.bind(null, project.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            Network project
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{project.title || "Untitled project"}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge status={project.status} />
            <StatusBadge status={project.source} />
            {project.existingSagaEventId ? <StatusBadge status="SAGA_EVENT" /> : null}
          </div>
        </div>
        <form action={generateRoles}>
          <button className={buttonClass}>
            <Sparkles aria-hidden className="h-4 w-4" />
            Generate role openings
          </button>
        </form>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <form action={updateProject} className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Project brief</h3>
              <button className={buttonClass}>
                <Save aria-hidden className="h-4 w-4" />
                Save
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelClass}>
                Status
                <select name="status" defaultValue={project.status} className={inputClass}>
                  {["INTAKE", "BRIEF_READY", "ROLE_MAPPING", "RECRUITING", "SHORTLIST_READY", "TEAM_FORMING", "IN_PRODUCTION", "ARCHIVED", "NEEDS_ADMIN"].map((status) => (
                    <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>Title<input name="title" defaultValue={project.title || ""} className={inputClass} /></label>
              <label className={labelClass}>City<input name="city" defaultValue={project.city || ""} className={inputClass} /></label>
              <label className={labelClass}>Target date<input name="targetDate" defaultValue={project.targetDate || ""} className={inputClass} /></label>
              <label className={labelClass}>Budget<input name="budgetRange" defaultValue={project.budgetRange || ""} className={inputClass} /></label>
              <label className={labelClass}>Audience<input name="audience" defaultValue={project.audience || ""} className={inputClass} /></label>
              <label className={`${labelClass} md:col-span-2`}>Fandoms<input name="fandoms" defaultValue={project.fandoms.join(", ")} className={inputClass} /></label>
              <label className={`${labelClass} md:col-span-2`}>Description<textarea name="description" rows={4} defaultValue={project.description || ""} className={inputClass} /></label>
            </div>
          </form>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <h3 className="text-lg font-semibold">Role openings and recommendations</h3>
            <div className="mt-4 space-y-4">
              {project.roleOpenings.map((role) => {
                const updateRole = updateRoleOpeningAction.bind(null, role.id);
                const createOpportunity = createOpportunityAction.bind(null, role.id);
                return (
                  <div key={role.id} className="rounded-md border border-zinc-800 p-3">
                    <form action={updateRole} className="grid gap-3 md:grid-cols-2">
                      <label className={labelClass}>Role type<input name="roleType" defaultValue={role.roleType} className={inputClass} /></label>
                      <label className={labelClass}>Title<input name="title" defaultValue={role.title} className={inputClass} /></label>
                      <label className={labelClass}>Status<select name="status" defaultValue={role.status} className={inputClass}>{["DRAFT", "OPEN", "RECOMMENDING", "OUTREACHING", "FILLED", "ARCHIVED"].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                      <label className={labelClass}>Compensation<select name="compensationType" defaultValue={role.compensationType} className={inputClass}>{["UNKNOWN", "PAID", "VOLUNTEER", "COLLAB", "TRADE"].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                      <label className={labelClass}>Required skills<input name="requiredSkills" defaultValue={role.requiredSkills.join(", ")} className={inputClass} /></label>
                      <label className={labelClass}>Preferred fandoms<input name="preferredFandoms" defaultValue={role.preferredFandoms.join(", ")} className={inputClass} /></label>
                      <label className={labelClass}>Location<input name="locationRequirement" defaultValue={role.locationRequirement || ""} className={inputClass} /></label>
                      <label className={labelClass}>Budget<input name="budgetRange" defaultValue={role.budgetRange || ""} className={inputClass} /></label>
                      <label className={labelClass}>Quantity<input name="quantityNeeded" type="number" min="1" defaultValue={role.quantityNeeded} className={inputClass} /></label>
                      <label className={labelClass}>Remote<select name="remoteAllowed" defaultValue={String(role.remoteAllowed)} className={inputClass}><option value="false">No</option><option value="true">Yes</option></select></label>
                      <label className={`${labelClass} md:col-span-2`}>Description<textarea name="description" rows={3} defaultValue={role.description || ""} className={inputClass} /></label>
                      <div className="md:col-span-2 flex flex-wrap gap-2">
                        <button className={buttonClass}><Save aria-hidden className="h-4 w-4" />Save role</button>
                        <button formAction={createOpportunity} className={buttonClass}><Plus aria-hidden className="h-4 w-4" />Create opportunity</button>
                      </div>
                    </form>
                    {role.opportunities.map((opportunity) => {
                      const runRecommendations = runRecommendationsAction.bind(null, opportunity.id);
                      return (
                        <div key={opportunity.id} className="mt-3 rounded-md border border-zinc-800 bg-zinc-950 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex gap-2"><StatusBadge status={opportunity.status} /><StatusBadge status={opportunity.visibility} /></div>
                            <form action={runRecommendations}><button className={buttonClass}><Sparkles aria-hidden className="h-4 w-4" />Run matching</button></form>
                          </div>
                          <form action={approveMockRecommendationOutreachAction} className="mt-3 space-y-2">
                            {opportunity.recommendations.map((recommendation) => (
                              <label key={recommendation.id} className="flex items-start gap-3 rounded border border-zinc-800 p-2">
                                <input name="recommendationIds" type="checkbox" value={recommendation.id} className="mt-1" />
                                <span className="text-sm">
                                  <span className="font-medium">{recommendation.person.name || recommendation.person.creatorProfile?.displayName || "Unnamed"}</span>{" "}
                                  <span className="text-zinc-500">score {recommendation.score} | {recommendation.proximityTier} | {recommendation.status}</span>
                                  <span className="mt-1 block text-xs text-zinc-500">{recommendation.matchingReasons.join(", ")}</span>
                                </span>
                              </label>
                            ))}
                            {opportunity.recommendations.length > 0 ? (
                              <button className={buttonClass}><Send aria-hidden className="h-4 w-4" />Mock outreach selected</button>
                            ) : null}
                          </form>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <h3 className="text-lg font-semibold">Organizer</h3>
            <p className="mt-3 text-sm text-zinc-400">
              {project.organizerPerson?.name || "Unknown organizer"}
              <br />
              {project.organizerPerson?.phone
                ? redactPhoneForDisplay(project.organizerPerson.phone)
                : project.organizerPerson?.email || "No contact"}
            </p>
          </section>

          <form action={createMockConversationAction} className="rounded-lg border border-zinc-800 bg-black p-4">
            <input type="hidden" name="projectId" value={project.id} />
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Mock team chat</h3>
              <button className={buttonClass}><CheckCircle2 aria-hidden className="h-4 w-4" />Create</button>
            </div>
            <div className="space-y-2">
              {project.roleOpenings.flatMap((role) =>
                role.opportunities.flatMap((opportunity) =>
                  opportunity.recommendations
                    .filter((recommendation) => ["INTERESTED", "SHORTLISTED"].includes(recommendation.status))
                    .map((recommendation) => (
                      <label key={recommendation.id} className="flex gap-3 rounded-md border border-zinc-800 p-2 text-sm">
                        <input name="recommendationIds" type="checkbox" value={recommendation.id} defaultChecked />
                        <span>{recommendation.person.name || "Candidate"} - {role.title}</span>
                      </label>
                    )),
                ),
              )}
            </div>
          </form>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <h3 className="text-lg font-semibold">Team and conversation</h3>
            <div className="mt-3 space-y-3 text-sm text-zinc-400">
              <p>Team: {project.team?.status || "not created"}</p>
              <p>Members: {project.team?.members.length || 0}</p>
              <p>Conversations: {project.conversations.length}</p>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-black p-4">
            <h3 className="text-lg font-semibold">Audit log</h3>
            <div className="mt-3 space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-md border border-zinc-800 p-2">
                  <p className="font-mono text-xs uppercase text-zinc-300">{log.action}</p>
                  <p className="mt-1 font-mono text-[10px] text-zinc-500">{log.createdAt.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
