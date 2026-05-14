import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getDb } from "@/lib/db";
import { getCandidateGraphHealthSnapshot } from "@/lib/graph/candidateGraphHealth";
import {
  runRelationshipAwareMatchingAction,
  updateMatchResultReviewAction,
} from "@/app/admin/(dashboard)/matching/actions";

export const dynamic = "force-dynamic";

const buttonClass =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";
const inputClass =
  "w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-black p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function jsonArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function jsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function relationshipSummary(value: unknown) {
  const record = jsonRecord(value);
  return typeof record.pathSummary === "string"
    ? record.pathSummary
    : "No relationship path evidence recorded.";
}

function contactabilitySummary(value: unknown) {
  const record = jsonRecord(value);
  const path =
    typeof record.recommendedContactPathForAdminReview === "string"
      ? record.recommendedContactPathForAdminReview
      : "none";
  return {
    score: typeof record.contactabilityScore === "number" ? record.contactabilityScore : "n/a",
    risk: typeof record.contactabilityRisk === "string" ? record.contactabilityRisk : "UNKNOWN",
    path,
    note:
      typeof record.note === "string"
        ? record.note
        : "Contactability is evidence, not permission to contact.",
  };
}

export default async function MatchingPage(props: {
  searchParams: Promise<{ projectBriefId?: string; runId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const projectBriefId = searchParams.projectBriefId || "";
  const runId = searchParams.runId || "";
  const health = await getCandidateGraphHealthSnapshot();
  const [projectBriefs, recentRuns] = process.env.DATABASE_URL
    ? await Promise.all([
        getDb().projectBrief.findMany({
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: { id: true, title: true, city: true, status: true, updatedAt: true },
        }),
        getDb().candidateGraphMatchRun.findMany({
          where: projectBriefId ? { projectBriefId } : undefined,
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            results: {
              orderBy: [{ totalScore: "desc" }, { createdAt: "asc" }],
              take: 50,
            },
          },
        }),
      ])
    : [[], []];
  const selectedRun =
    recentRuns.find((run) => run.id === runId) || recentRuns[0] || null;

  return (
    <div className="space-y-6">
      <div>
        <AdminPageHeader
          eyebrow="Relationship-aware ranking"
          title="Smart Matching"
          description="Rank review-gated candidates for a project role using fit, location, relationship evidence, and review status."
          helpText="This workbench has no SMS, email, DM, outreach, group-chat, public-web search, shortlist-send, public launch, or production app controls."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className={buttonClass} href="/admin/candidate-graph">
            Open candidate graph
          </Link>
          <Link className={buttonClass} href="/admin/sourcing-quality">
            Open quality review
          </Link>
          <Link className={buttonClass} href="/admin/matching-evaluation">
            Open matching evaluation
          </Link>
          <Link
            className={buttonClass}
            href="/admin/data-ops?doc=docs%2Frelationship-aware-matching-v0.6b.md"
          >
            Open matching docs
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-7">
        {[
          ["Matching", health.relationshipAwareMatchingAvailable],
          ["Recent runs", health.recentMatchRunCount ?? "n/a"],
          ["Pending review", health.pendingMatchReviewCount ?? "n/a"],
          ["Internal coverage", health.internalCandidateCoverage ?? "n/a"],
          ["Public web coverage", health.publicWebCandidateCoverage ?? "n/a"],
          ["Average score", health.averageCandidateScore ?? "n/a"],
          ["High-risk matches", health.highRiskMatchCount ?? "n/a"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-zinc-800 bg-black p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              {label}
            </p>
            <p className="mt-2 break-words text-xl font-semibold">{String(value)}</p>
          </div>
        ))}
      </div>

      <Section title="Run Project-Specific Matching">
        <form action={runRelationshipAwareMatchingAction} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_8rem_auto]">
          <select name="projectBriefId" defaultValue={projectBriefId} className={inputClass}>
            <option value="">Choose a project brief</option>
            {projectBriefs.map((brief) => (
              <option key={brief.id} value={brief.id}>
                {brief.title || brief.city || brief.id} - {brief.status}
              </option>
            ))}
          </select>
          <input
            name="poolCap"
            type="number"
            min={1}
            max={250}
            defaultValue={250}
            className={inputClass}
            aria-label="Candidate pool cap"
          />
          <button className={buttonClass}>Run matching</button>
        </form>
        {projectBriefs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No database-backed project briefs are available. The regression
            tests exercise matching with synthetic, no-production fixtures.
          </p>
        ) : null}
      </Section>

      <div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <Section title="Recent Match Runs">
          {recentRuns.length === 0 ? (
            <p className="text-sm text-zinc-500">No match runs yet.</p>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/admin/matching?${new URLSearchParams({
                    ...(run.projectBriefId ? { projectBriefId: run.projectBriefId } : {}),
                    runId: run.id,
                  }).toString()}`}
                  className="block rounded-md border border-zinc-900 bg-zinc-950 p-3 transition hover:border-zinc-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={run.status} />
                    <span className="text-xs text-zinc-500">
                      {run.resultCount} results
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-xs text-zinc-500">{run.id}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {run.createdAt.toISOString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title="Ranked Candidates">
          {!selectedRun ? (
            <p className="text-sm text-zinc-500">
              Select a project and run matching to see ranked candidates.
            </p>
          ) : selectedRun.results.length === 0 ? (
            <p className="text-sm text-zinc-500">
              This run produced no reviewable candidates.
            </p>
          ) : (
            <div className="space-y-4">
              {selectedRun.results.map((result, index) => {
                const scoreBreakdown = jsonRecord(result.scoreBreakdown);
                const contactability = contactabilitySummary(result.contactabilitySummary);
                const reasons = jsonArray(result.matchReasons);
                const risks = jsonArray(result.riskFlags);
                const missing = jsonArray(result.missingEvidence);
                return (
                  <article
                    key={result.id}
                    className="rounded-md border border-zinc-900 bg-zinc-950 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-zinc-500">
                          Rank {index + 1} - {result.role}
                        </p>
                        <h4 className="mt-1 text-lg font-semibold">
                          {result.organizerSafeSummary || "Reviewable candidate"}
                        </h4>
                        <p className="mt-2 text-sm text-zinc-400">
                          {relationshipSummary(result.relationshipPath)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status={result.reviewStatus} />
                        <StatusBadge status={result.sourceMode} />
                        <StatusBadge status={result.proximityTier} />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-md border border-zinc-800 bg-black p-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Score</p>
                        <p className="mt-2 text-2xl font-semibold">{result.totalScore}</p>
                      </div>
                      <div className="rounded-md border border-zinc-800 bg-black p-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Contactability</p>
                        <p className="mt-2 text-sm text-zinc-300">
                          Score {String(contactability.score)} - risk {contactability.risk}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Admin path: {contactability.path}
                        </p>
                      </div>
                      <div className="rounded-md border border-zinc-800 bg-black p-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Safety</p>
                        <p className="mt-2 text-sm text-zinc-300">
                          No outreach, no SMS, no group chat.
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {contactability.note}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-md border border-zinc-900 bg-black p-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Score breakdown
                        </p>
                        <dl className="mt-2 grid gap-1 text-sm text-zinc-300 sm:grid-cols-2">
                          {Object.entries(scoreBreakdown).map(([key, value]) => (
                            <div key={key} className="flex justify-between gap-3">
                              <dt>{key}</dt>
                              <dd>{String(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                      <div className="rounded-md border border-zinc-900 bg-black p-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                          Risks and missing evidence
                        </p>
                        <p className="mt-2 text-sm text-zinc-300">
                          Risks: {risks.join(", ") || "none"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-300">
                          Missing: {missing.join(", ") || "none"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-md border border-zinc-900 bg-black p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Match reasons
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">
                        {reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>

                    <form
                      action={updateMatchResultReviewAction}
                      className="mt-4 grid gap-3 lg:grid-cols-[12rem_minmax(0,1fr)_auto]"
                    >
                      <input type="hidden" name="resultId" value={result.id} />
                      <input type="hidden" name="runId" value={selectedRun.id} />
                      <input
                        type="hidden"
                        name="projectBriefId"
                        value={selectedRun.projectBriefId || projectBriefId}
                      />
                      <select
                        name="reviewStatus"
                        defaultValue={result.reviewStatus}
                        className={inputClass}
                        aria-label="Review status"
                      >
                        <option value="SUGGESTED">Suggested</option>
                        <option value="NEEDS_REVIEW">Needs review</option>
                        <option value="APPROVED_FOR_SHORTLIST">Approve for shortlist workflow</option>
                        <option value="REJECTED">Reject</option>
                        <option value="DO_NOT_CONTACT">Do not contact</option>
                      </select>
                      <input
                        name="adminNotes"
                        defaultValue={result.adminNotes || ""}
                        className={inputClass}
                        placeholder="Admin-only note"
                      />
                      <button className={buttonClass}>Update review</button>
                    </form>
                  </article>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
