import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getDb } from "@/lib/db";
import { buildProjectUnderstanding } from "@/lib/producer/projectUnderstanding";
import { generateRoleMap } from "@/lib/producer/roleMap";
import { generatePublicResearchPlan } from "@/lib/sourcing/publicResearchPlan";
import { generateSourcingStrategy } from "@/lib/sourcing/sourcingStrategy";
import { getTalentDiscoveryHealthSnapshot } from "@/lib/sourcing/talentDiscoveryHealth";
import { getPublicWebResearchConfig } from "@/lib/sourcing/publicWebResearchProvider";
import {
  runInternalTalentSearchAction,
  updateTalentCandidateStatusAction,
} from "@/app/admin/(dashboard)/sourcing/actions";

export const dynamic = "force-dynamic";

const buttonClass =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";
const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";

function asArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-black p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function SourcingPage(props: {
  searchParams: Promise<{ projectBriefId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const projectBriefId = searchParams.projectBriefId || "";
  const [projects, health, publicWebConfig] = await Promise.all([
    process.env.DATABASE_URL
      ? getDb().projectBrief.findMany({
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: { id: true, title: true, city: true, status: true, updatedAt: true },
        })
      : [],
    getTalentDiscoveryHealthSnapshot(),
    getPublicWebResearchConfig(),
  ]);
  const selected = projectBriefId && process.env.DATABASE_URL
    ? await getDb().projectBrief.findUnique({
        where: { id: projectBriefId },
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 10 },
          project: true,
          talentSearchRuns: {
            include: { candidates: { orderBy: [{ score: "desc" }, { updatedAt: "desc" }] } },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      })
    : null;
  const understanding = selected
    ? buildProjectUnderstanding({
        projectBrief: selected,
        project: selected.project,
        recentMessages: selected.messages,
      })
    : null;
  const roleMap = understanding ? generateRoleMap(understanding) : null;
  const latestCandidates = selected?.talentSearchRuns[0]?.candidates || [];
  const strategy =
    understanding && roleMap
      ? generateSourcingStrategy(understanding, roleMap, {
          internalCandidateCount: latestCandidates.length,
        })
      : null;
  const publicPlan =
    understanding && roleMap && strategy
      ? generatePublicResearchPlan(understanding, roleMap, strategy)
      : null;

  return (
    <div className="space-y-6">
      <div>
        <AdminPageHeader
          eyebrow="Internal-first sourcing"
          title="Talent Search"
          description="Find possible collaborators for a project using Saga's internal talent data and reviewed research results."
          helpText="This page does not send SMS, contact candidates, create group chats, or approve anyone automatically."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className={buttonClass} href="/admin/sourcing-quality">
            Open quality review queue
          </Link>
          <Link className={buttonClass} href="/admin/sourcing/public-web">
            Open public web shadow research
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Talent discovery", health.talentDiscoveryAvailable],
          ["Web research enabled", health.publicWebResearchEnabled],
          ["Web research mode", health.publicWebResearchMode],
          ["Web research ready", health.publicWebResearchReady],
          ["Candidate queue", health.candidateReviewQueueCount ?? "n/a"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-zinc-800 bg-black p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
            <p className="mt-2 break-words text-xl font-semibold">{String(value)}</p>
          </div>
        ))}
      </div>

      <Section title="Select Project Brief">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <select name="projectBriefId" defaultValue={projectBriefId} className={inputClass}>
            <option value="">Choose a project brief</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title || project.city || project.id} - {project.status}
              </option>
            ))}
          </select>
          <button className={buttonClass}>Load</button>
        </form>
        {projects.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No database-backed project briefs are available. The test suite
            exercises sourcing with synthetic data.
          </p>
        ) : null}
      </Section>

      {selected && understanding && roleMap && strategy && publicPlan ? (
        <>
          <Section title="Project Understanding and Role Map">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-md border border-zinc-900 bg-zinc-950 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Brief</p>
                <p className="mt-2 text-sm text-zinc-300">{understanding.title || "Untitled"}</p>
                <p className="mt-1 text-xs text-zinc-500">{understanding.city || "City unknown"}</p>
              </div>
              <div className="rounded-md border border-zinc-900 bg-zinc-950 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Required roles</p>
                <p className="mt-2 text-sm text-zinc-300">
                  {roleMap.requiredRoles.map((role) => role.roleType).join(", ") || "None"}
                </p>
              </div>
              <div className="rounded-md border border-zinc-900 bg-zinc-950 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Public research</p>
                <p className="mt-2 text-sm text-zinc-300">
                  {strategy.publicResearchNeeded ? "Plan recommended" : "Not needed yet"}
                </p>
              </div>
            </div>
            <form action={runInternalTalentSearchAction} className="mt-4">
              <input type="hidden" name="projectBriefId" value={selected.id} />
              <button className={buttonClass}>Run internal talent search</button>
            </form>
          </Section>

          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Sourcing Strategy">
              <div className="space-y-3 text-sm text-zinc-300">
                <p>Internal first: {strategy.internalSearchPriorities.join(" ")}</p>
                <p>Human review required: {String(strategy.humanReviewRequired)}</p>
                <p>Risk notes: {strategy.riskNotes.join(" ")}</p>
              </div>
            </Section>

            <Section title="Public Research Plan">
              <p className="text-sm text-zinc-300">
                Mode: {publicWebConfig.publicWebResearchMode}. Provider:{" "}
                {publicWebConfig.publicWebResearchProvider}. Citations required:{" "}
                {String(publicPlan.sourceCitationRequired)}.
              </p>
              <div className="mt-3 rounded-md border border-zinc-900 bg-zinc-950 p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Suggested queries
                </p>
                <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                  {publicPlan.queryPlan.map((query) => (
                    <li key={query}>{query}</li>
                  ))}
                </ul>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Disabled/shadow/admin-only by configuration. No private-source
                scraping and no outreach.
              </p>
            </Section>
          </div>

          <Section title="Candidate Review Queue">
            {latestCandidates.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No Talent Discovery candidates yet. Run internal search to
                create review cards.
              </p>
            ) : (
              <div className="space-y-3">
                {latestCandidates.map((candidate) => (
                  <article key={candidate.id} className="rounded-md border border-zinc-900 bg-zinc-950 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold">{candidate.displayName}</h4>
                        <p className="mt-1 text-sm text-zinc-500">
                          {candidate.role} {candidate.city ? `- ${candidate.city}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status={candidate.status} />
                        <StatusBadge status={candidate.source} />
                        <span className="rounded-md border border-zinc-800 px-2 py-1 font-mono text-xs">
                          score {candidate.score}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Evidence</p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {asArray((candidate.evidence as Record<string, unknown>).matchingReasons).join(", ") || "Needs more evidence"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Risks</p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {asArray(candidate.risks).join(", ") || "None"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Missing info</p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {asArray(candidate.missingInfo).join(", ") || "None"}
                        </p>
                      </div>
                    </div>
                    <form action={updateTalentCandidateStatusAction} className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
                      <input type="hidden" name="candidateId" value={candidate.id} />
                      <input type="hidden" name="projectBriefId" value={selected.id} />
                      <select name="status" defaultValue={candidate.status} className={inputClass}>
                        <option value="SUGGESTED">Suggested</option>
                        <option value="APPROVED_FOR_SHORTLIST">Approve for shortlist</option>
                        <option value="NEEDS_MORE_INFO">Needs more info</option>
                        <option value="REJECTED">Reject</option>
                        <option value="DO_NOT_CONTACT">Do not contact</option>
                      </select>
                      <input name="adminNotes" className={inputClass} placeholder="Optional admin note" />
                      <button className={buttonClass}>Update review</button>
                    </form>
                  </article>
                ))}
              </div>
            )}
          </Section>
        </>
      ) : (
        <Section title="No Project Loaded">
          <p className="text-sm text-zinc-500">
            Select a project brief to generate sourcing strategy and review
            internal candidates. Public web research remains disabled unless
            explicitly configured later.
          </p>
          <Link className={`${buttonClass} mt-4`} href="/admin/projects">
            Open projects
          </Link>
        </Section>
      )}
    </div>
  );
}
