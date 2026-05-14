import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getDb } from "@/sms-engine/db";
import { buildProjectUnderstanding } from "@/sms-engine/producer/projectUnderstanding";
import { generateRoleMap } from "@/sms-engine/producer/roleMap";
import {
  buildPublicWebLiveDryRunRequest,
  publicWebLiveDryRunFixture,
} from "@/sms-engine/sourcing/publicWebLiveDryRunFixture";
import { buildPublicWebQueryPlan } from "@/sms-engine/sourcing/publicWebQueryBuilder";
import { generatePublicResearchPlan } from "@/sms-engine/sourcing/publicResearchPlan";
import {
  evaluatePublicWebResearchLiveDryRunReadiness,
  getPublicWebResearchConfig,
  getPublicWebResearchHealthSnapshot,
} from "@/sms-engine/sourcing/publicWebResearchProvider";
import { generateSourcingStrategy } from "@/sms-engine/sourcing/sourcingStrategy";
import {
  cancelPublicWebResearchJobAction,
  runPublicWebResearchLiveDryRunAction,
  runPublicWebResearchShadowAction,
  updatePublicWebResearchResultStatusAction,
} from "@/app/admin/(dashboard)/sourcing/public-web/actions";

export const dynamic = "force-dynamic";

const buttonClass =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";
const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-black p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function asStrings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function summaryNumber(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "number" ? item : 0;
}

export default async function PublicWebResearchPage(props: {
  searchParams: Promise<{ projectBriefId?: string; targetRole?: string }>;
}) {
  const searchParams = await props.searchParams;
  const projectBriefId = searchParams.projectBriefId || "";
  const targetRole = searchParams.targetRole || "";
  const [projects, config, health, recentLiveDryRuns, recentJobs] = await Promise.all([
    process.env.DATABASE_URL
      ? getDb().projectBrief.findMany({
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: { id: true, title: true, city: true, status: true, updatedAt: true },
        })
      : [],
    getPublicWebResearchConfig(),
    getPublicWebResearchHealthSnapshot(),
    process.env.DATABASE_URL
      ? getDb().publicWebResearchRun.findMany({
          where: { mode: "LIVE_DRY_RUN" },
          include: { results: { orderBy: { createdAt: "desc" }, take: 10 } },
          orderBy: { createdAt: "desc" },
          take: 3,
        })
      : [],
    process.env.DATABASE_URL
      ? getDb().publicWebResearchJob.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { researchRun: true },
        })
      : [],
  ]);
  const selected =
    projectBriefId && process.env.DATABASE_URL
      ? await getDb().projectBrief.findUnique({
          where: { id: projectBriefId },
          include: {
            messages: { orderBy: { createdAt: "desc" }, take: 10 },
            project: true,
            talentSearchRuns: {
              include: { candidates: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
            publicWebResearchRuns: {
              include: { results: { orderBy: { createdAt: "desc" }, take: 20 } },
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
  const roles = roleMap ? [...roleMap.requiredRoles, ...roleMap.optionalRoles] : [];
  const selectedRole = targetRole || roles[0]?.roleType || "";
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
  const queryPlan =
    understanding && roleMap && strategy && publicPlan && selectedRole
      ? buildPublicWebQueryPlan({
          understanding,
          roleMap,
          sourcingStrategy: strategy,
          publicResearchPlan: publicPlan,
          targetRole: selectedRole,
          allowedDomains: config.publicWebResearchAllowedDomains,
          blockedDomains: config.publicWebResearchBlockedDomains,
        })
      : null;
  const canRunShadow =
    config.publicWebResearchEnabled &&
    config.publicWebResearchMode === "shadow" &&
    selected &&
    selectedRole;
  const liveDryRunRequest = buildPublicWebLiveDryRunRequest();
  const liveDryRunReadiness = evaluatePublicWebResearchLiveDryRunReadiness({
    request: liveDryRunRequest,
    adminTriggered: true,
    demoSafe: true,
    requireActionGate: true,
  });
  const canRunLiveDryRun = liveDryRunReadiness.allowed;
  const resultRuns = selected
    ? [...recentLiveDryRuns, ...selected.publicWebResearchRuns]
    : recentLiveDryRuns;

  return (
    <div className="space-y-6">
      <div>
        <AdminPageHeader
          eyebrow="Admin-only public research"
          title="Public Web Research"
          description="Review public talent research plans and dry-run results. Candidates here are not approved, contacted, or shown to users until reviewed."
          helpText="Public web research is disabled unless explicit operator gates are set. This page has no outreach or send controls."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className={buttonClass} href="/admin/sourcing">
            Open sourcing workbench
          </Link>
          <Link className={buttonClass} href="/admin/sourcing-quality">
            Open quality review
          </Link>
          <Link className={buttonClass} href="/admin/sourcing/public-web-review">
            Review and cleanup
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Shadow available", health.publicWebResearchShadowAvailable],
          ["Live dry run", health.publicWebResearchLiveDryRunAvailable],
          ["Async jobs", health.publicWebResearchAsyncAvailable],
          ["Enabled", health.publicWebResearchEnabled],
          ["Mode", health.publicWebResearchMode],
          ["Pending review", health.publicWebResultsPendingReviewCount ?? "n/a"],
          ["Provider", health.publicWebResearchProvider],
          ["Live allowed", health.publicWebResearchLiveDryRunAllowed],
          ["Citations", health.publicWebResearchRequireCitations],
          ["Ready", health.publicWebResearchReady],
          ["Blockers", health.publicWebResearchBlockerCount],
          ["Live runs 24h", health.recentPublicWebLiveDryRunCount ?? "n/a"],
          ["Pending jobs", health.publicWebResearchPendingJobCount ?? "n/a"],
          ["Failed jobs", health.publicWebResearchFailedJobCount ?? "n/a"],
          ["Last citations", health.publicWebResearchLastCitationCount ?? "n/a"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-zinc-800 bg-black p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
            <p className="mt-2 break-words text-xl font-semibold">{String(value)}</p>
          </div>
        ))}
      </div>

      <Section title="Select Project and Role">
        <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,260px)_auto]">
          <select name="projectBriefId" defaultValue={projectBriefId} className={inputClass}>
            <option value="">Choose a project brief</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title || project.city || project.id} - {project.status}
              </option>
            ))}
          </select>
          <select name="targetRole" defaultValue={selectedRole} className={inputClass}>
            <option value="">Choose role</option>
            {roles.map((role) => (
              <option key={role.roleType} value={role.roleType}>
                {role.roleType}
              </option>
            ))}
          </select>
          <button className={buttonClass}>Load plan</button>
        </form>
        {!config.publicWebResearchEnabled ? (
          <p className="mt-3 text-sm text-amber-200">
            Public web research is disabled. This page will show plans and
            controls, but it will not call OpenAI web search unless the operator
            explicitly enables live dry-run mode and all gates pass.
          </p>
        ) : null}
      </Section>

      <Section title="Live Dry Run">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                Safe demo query
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                {publicWebLiveDryRunFixture.projectTitle} -{" "}
                {publicWebLiveDryRunFixture.roleTarget}
              </p>
              <p className="mt-1 font-mono text-xs text-zinc-500">
                {publicWebLiveDryRunFixture.query}
              </p>
            </div>
            <p className="text-sm leading-6 text-zinc-500">
              This action is dry-run only. It queues a job and returns
              immediately, so OpenAI web search runs later from the CLI/worker
              path instead of inside the Railway HTTP request. Results remain
              citation-backed review-only cards and never send SMS, outreach,
              shortlists, or group-chat actions.
            </p>
            <form action={runPublicWebResearchLiveDryRunAction}>
              <button className={buttonClass} disabled={!canRunLiveDryRun}>
                Queue live dry run
              </button>
            </form>
            <p className="text-xs text-zinc-500">
              Process queued jobs with{" "}
              <code className="rounded bg-zinc-900 px-1 py-0.5">
                npm run jobs:process-public-web-research-once
              </code>
              . The admin request path never calls the live provider.
            </p>
          </div>
          <div className="rounded-md border border-zinc-900 bg-zinc-950 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Gate status
            </p>
            {liveDryRunReadiness.blockers.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-amber-200">
                {liveDryRunReadiness.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-emerald-200">
                All live dry-run gates are satisfied.
              </p>
            )}
            {liveDryRunReadiness.warnings.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-zinc-500">
                {liveDryRunReadiness.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </Section>

      <Section title="Async Research Jobs">
        {recentJobs.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No public-web research jobs yet. Queue a live dry run to create a
            pending job, then process it from Railway SSH or a future worker.
          </p>
        ) : (
          <div className="space-y-3">
            {recentJobs.map((job) => (
              <article
                key={job.id}
                className="rounded-md border border-zinc-900 bg-zinc-950 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-zinc-500">
                      {job.createdAt.toISOString()}
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {job.role || "demo role"} - attempt {job.attempts}/
                      {job.maxAttempts}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      run {job.researchRunId || "n/a"} - completed{" "}
                      {job.completedAt ? job.completedAt.toISOString() : "not yet"}
                    </p>
                    {job.errorCategory ? (
                      <p className="mt-1 text-xs text-amber-200">
                        {job.errorCategory}: {job.lastErrorMessageRedacted || "redacted"}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={job.status} />
                    <StatusBadge status={job.mode} />
                    <span className="rounded-md border border-zinc-800 px-2 py-1 font-mono text-xs">
                      {summaryNumber(job.resultSummary, "resultCount")} results
                    </span>
                    <span className="rounded-md border border-zinc-800 px-2 py-1 font-mono text-xs">
                      {summaryNumber(job.resultSummary, "citationCount")} citations
                    </span>
                  </div>
                </div>
                {job.status === "PENDING" || job.status === "FAILED" ? (
                  <form action={cancelPublicWebResearchJobAction} className="mt-3">
                    <input type="hidden" name="jobId" value={job.id} />
                    <button className={buttonClass}>Cancel pending job</button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </Section>

      {selected && queryPlan ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Research Plan">
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Proposed queries
                </p>
                <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                  {queryPlan.searchQueries.map((query) => (
                    <li key={query}>{query}</li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                    Evidence checklist
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {queryPlan.evidenceChecklist.join(", ")}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                    Safety rules
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    Citations required. Private/login-gated sources disallowed.
                    Human review required.
                  </p>
                </div>
              </div>
              <form action={runPublicWebResearchShadowAction}>
                <input type="hidden" name="projectBriefId" value={selected.id} />
                <input type="hidden" name="targetRole" value={selectedRole} />
                <button className={buttonClass} disabled={!canRunShadow}>
                  Record shadow request
                </button>
              </form>
              {!canRunShadow ? (
                <p className="text-xs text-zinc-500">
                  Shadow request recording is blocked unless
                  PUBLIC_WEB_RESEARCH_ENABLED=true, mode=shadow, and a
                  project/role are selected. It does not inject the live web
                  provider.
                </p>
              ) : null}
            </div>
          </Section>

          <Section title="Recent Research Runs">
            {[...recentLiveDryRuns, ...selected.publicWebResearchRuns].length === 0 ? (
              <p className="text-sm text-zinc-500">No public-web research runs yet.</p>
            ) : (
              <div className="space-y-3">
                {[...recentLiveDryRuns, ...selected.publicWebResearchRuns].map((run) => (
                  <article key={run.id} className="rounded-md border border-zinc-900 bg-zinc-950 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs text-zinc-500">
                          {run.createdAt.toISOString()}
                        </p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {run.provider} - {run.resultCount} results - {run.citationCount} citations
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <StatusBadge status={run.status} />
                        <StatusBadge status={run.mode} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Section>
        </div>
      ) : (
        <Section title="No Research Plan Loaded">
          <p className="text-sm text-zinc-500">
            Select a project and role to view proposed public-web queries.
            Running live search is disabled unless live dry-run mode is
            explicitly enabled and all gates pass.
          </p>
        </Section>
      )}

      <Section title="Research Results">
          {resultRuns.flatMap((run) => run.results).length === 0 ? (
            <p className="text-sm text-zinc-500">
              No research results. Public-web candidates will appear here only as
              research-only cards requiring quality review.
            </p>
          ) : (
            <div className="space-y-3">
              {resultRuns.flatMap((run) =>
                run.results.map((result) => (
                  <article key={result.id} className="rounded-md border border-zinc-900 bg-zinc-950 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold">{result.displayName}</h4>
                        <p className="mt-1 text-sm text-zinc-500">
                          {result.role} {result.city ? `- ${result.city}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status={result.status} />
                        <StatusBadge status={result.sourceReliability} />
                        <span className="rounded-md border border-zinc-800 px-2 py-1 font-mono text-xs">
                          confidence {result.confidence}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Citations
                        </p>
                        <ul className="mt-1 space-y-1 text-sm text-zinc-300">
                          {asStrings(result.sourceUrls).slice(0, 4).map((url) => (
                            <li key={url} className="break-all">
                              <a className="underline decoration-zinc-700" href={url} rel="noreferrer">
                                {url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Risks
                        </p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {asStrings(result.riskFlags).join(", ") || "None"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Missing evidence
                        </p>
                        <p className="mt-1 text-sm text-zinc-300">
                          {asStrings(result.missingEvidence).join(", ") || "None"}
                        </p>
                      </div>
                    </div>
                    <form
                      action={updatePublicWebResearchResultStatusAction}
                      className="mt-4 grid gap-3 md:grid-cols-[220px_auto]"
                    >
                      <input type="hidden" name="resultId" value={result.id} />
                      <input type="hidden" name="projectBriefId" value={selected?.id || ""} />
                      <select name="status" defaultValue={result.status} className={inputClass}>
                        <option value="SHADOW_RESULT">Shadow result</option>
                        <option value="NEEDS_REVIEW">Needs review</option>
                        <option value="IN_QUALITY_REVIEW">In quality review</option>
                        <option value="APPROVED_FOR_REVIEW">Approve for quality review</option>
                        <option value="APPROVED_FOR_INTERNAL_REVIEW">Approved internal review</option>
                        <option value="REJECTED">Reject</option>
                        <option value="DISCARDED">Discard</option>
                        <option value="ARCHIVED">Archive</option>
                        <option value="DUPLICATE">Duplicate</option>
                        <option value="DO_NOT_CONTACT">Do not contact</option>
                      </select>
                      <button className={buttonClass}>Update result</button>
                    </form>
                  </article>
                )),
              )}
            </div>
          )}
        </Section>
    </div>
  );
}
