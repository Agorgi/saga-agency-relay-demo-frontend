import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getDb } from "@/lib/db";
import { evaluateContactabilityEvidence } from "@/lib/sourcing/contactabilityEvidence";
import {
  canPromotePublicWebResult,
  evaluatePublicWebResearchResultForReview,
} from "@/lib/sourcing/publicWebResearchCleanup";
import {
  archivePublicWebResearchRunAction,
  cleanupTestTaggedPublicWebResultsAction,
  reviewContactabilityEvidenceAction,
  reviewPublicWebResearchResultAction,
} from "@/app/admin/(dashboard)/sourcing/public-web-review/actions";

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

export default async function PublicWebReviewPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const searchParams = await props.searchParams;
  const status = searchParams.status || "";
  const [runs, jobs, results, statusCounts] = process.env.DATABASE_URL
    ? await Promise.all([
        getDb().publicWebResearchRun.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { _count: { select: { results: true, jobs: true } } },
        }),
        getDb().publicWebResearchJob.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        getDb().publicWebResearchResult.findMany({
          where: status ? { status: status as never } : undefined,
          orderBy: { updatedAt: "desc" },
          take: 25,
          include: {
            researchRun: true,
            talentCandidates: true,
            contactabilityEvidence: { orderBy: { createdAt: "desc" } },
          },
        }),
        getDb().publicWebResearchResult.groupBy({
          by: ["status"],
          _count: { status: true },
        }),
      ])
    : [[], [], [], []];
  const reviews = await Promise.all(
    results.map(async (result) => ({
      result,
      review: await evaluatePublicWebResearchResultForReview({ result }),
      promotion: canPromotePublicWebResult({
        status: result.status,
        sourceQualityBand: result.sourceQualityBand,
        duplicateStatus: result.duplicateStatus,
        safetyBlockers: asStrings(result.riskFlags),
        qualityReviewPassed: false,
        contactabilityReviewed: result.contactabilityEvidence.some(
          (item) => item.reviewStatus === "VERIFIED",
        ),
        adminAction: false,
      }),
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <AdminPageHeader
          eyebrow="Review-only public research"
          title="Research Cleanup"
          description="Review citations, source quality, duplicate risk, contactability, and cleanup status before any public-web candidate can move forward."
          helpText="Candidates here are not approved yet. This page has no send, outreach, group-chat, or public-launch controls."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className={buttonClass} href="/admin/sourcing/public-web">
            Open research queue
          </Link>
          <Link className={buttonClass} href="/admin/sourcing-quality">
            Open quality review
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Runs", runs.length],
          ["Jobs", jobs.length],
          ["Results shown", results.length],
          ["Pending review", statusCounts.find((item) => item.status === "NEEDS_REVIEW")?._count.status ?? 0],
          ["In quality review", statusCounts.find((item) => item.status === "IN_QUALITY_REVIEW")?._count.status ?? 0],
          ["Discarded", statusCounts.find((item) => item.status === "DISCARDED")?._count.status ?? 0],
          ["Duplicates", statusCounts.find((item) => item.status === "DUPLICATE")?._count.status ?? 0],
          ["Do not contact", statusCounts.find((item) => item.status === "DO_NOT_CONTACT")?._count.status ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-zinc-800 bg-black p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
            <p className="mt-2 text-xl font-semibold">{String(value)}</p>
          </div>
        ))}
      </div>

      <Section title="Filters and Cleanup">
        <div className="grid gap-4 lg:grid-cols-2">
          <form className="grid gap-3 md:grid-cols-[minmax(0,260px)_auto]">
            <select name="status" defaultValue={status} className={inputClass}>
              <option value="">All statuses</option>
              {[
                "SHADOW_RESULT",
                "NEEDS_REVIEW",
                "IN_QUALITY_REVIEW",
                "APPROVED_FOR_INTERNAL_REVIEW",
                "REJECTED",
                "DISCARDED",
                "ARCHIVED",
                "DUPLICATE",
                "DO_NOT_CONTACT",
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button className={buttonClass}>Apply</button>
          </form>
          <form action={cleanupTestTaggedPublicWebResultsAction} className="grid gap-3 md:grid-cols-[minmax(0,220px)_auto]">
            <input name="tag" defaultValue="live_dry_run" className={inputClass} />
            <button className={buttonClass}>Archive test-tagged results</button>
          </form>
        </div>
      </Section>

      <Section title="Recent Runs and Jobs">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            {runs.length === 0 ? (
              <p className="text-sm text-zinc-500">No public-web runs found.</p>
            ) : (
              runs.map((run) => (
                <article key={run.id} className="rounded-md border border-zinc-900 bg-zinc-950 p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-zinc-500">{run.createdAt.toISOString()}</p>
                      <p className="mt-1 text-sm text-zinc-300">
                        {run.provider} - {run._count.results} results - {run._count.jobs} jobs
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <StatusBadge status={run.status} />
                      <StatusBadge status={run.mode} />
                    </div>
                  </div>
                  {run.status !== "ARCHIVED" ? (
                    <form action={archivePublicWebResearchRunAction} className="mt-3">
                      <input type="hidden" name="runId" value={run.id} />
                      <button className={buttonClass}>Archive run</button>
                    </form>
                  ) : null}
                </article>
              ))
            )}
          </div>
          <div className="space-y-3">
            {jobs.length === 0 ? (
              <p className="text-sm text-zinc-500">No async jobs found.</p>
            ) : (
              jobs.map((job) => (
                <article key={job.id} className="rounded-md border border-zinc-900 bg-zinc-950 p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-zinc-500">{job.createdAt.toISOString()}</p>
                      <p className="mt-1 text-sm text-zinc-300">
                        {job.role || "role unknown"} - attempts {job.attempts}/{job.maxAttempts}
                      </p>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </Section>

      <Section title="Result Review Queue">
        {reviews.length === 0 ? (
          <p className="text-sm text-zinc-500">No public-web results found.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map(({ result, review, promotion }) => (
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
                    <StatusBadge status={review.sourceQuality.band} />
                    <StatusBadge status={review.duplicate.duplicateStatus} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Citations</p>
                    <ul className="mt-1 space-y-1 text-sm text-zinc-300">
                      {asStrings(result.sourceUrls).slice(0, 5).map((url) => (
                        <li key={url} className="break-all">
                          <a href={url} rel="noreferrer" className="underline decoration-zinc-700">
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Evidence review</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      Score {review.sourceQuality.totalScore}.{" "}
                      {review.sourceQuality.recommendedAction}. Missing:{" "}
                      {asStrings(result.missingEvidence).join(", ") || "none"}.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Promotion guard</p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {promotion.allowed ? "Allowed for next review step" : promotion.blockers.join(", ")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-zinc-900 bg-black p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Contactability</p>
                  {result.contactabilityEvidence.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">
                      No stored contactability evidence yet. Existing source URLs
                      are treated as possible public profiles, not outreach permission.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {result.contactabilityEvidence.map((item) => {
                        const contactReview = evaluateContactabilityEvidence({
                          channel: item.channel,
                          value: item.valueRedacted,
                          sourceUrl: item.sourceUrl,
                          sourceTitle: item.sourceTitle,
                          evidenceTextSummary: item.evidenceTextSummary,
                          isPubliclyVisible: item.isPubliclyVisible,
                          isBusinessFacing: item.isBusinessFacing,
                          isPersonalContact: item.isPersonalContact,
                        });
                        return (
                          <form
                            key={item.id}
                            action={reviewContactabilityEvidenceAction}
                            className="grid gap-2 rounded border border-zinc-900 p-2 md:grid-cols-[minmax(0,1fr)_180px_auto]"
                          >
                            <input type="hidden" name="evidenceId" value={item.id} />
                            <div>
                              <p className="text-sm text-zinc-300">
                                {item.channel} - {item.valueRedacted || "profile/source"}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {contactReview.band}; risk {contactReview.outreachRisk}; review {item.reviewStatus}
                              </p>
                            </div>
                            <select name="status" defaultValue={item.reviewStatus} className={inputClass}>
                              <option value="UNREVIEWED">Unreviewed</option>
                              <option value="VERIFIED">Verified for admin review</option>
                              <option value="UNSAFE">Unsafe</option>
                              <option value="NEEDS_MORE_RESEARCH">Needs more research</option>
                              <option value="DO_NOT_CONTACT">Do not contact</option>
                            </select>
                            <button className={buttonClass}>Update contact path</button>
                          </form>
                        );
                      })}
                    </div>
                  )}
                </div>

                <form action={reviewPublicWebResearchResultAction} className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
                  <input type="hidden" name="resultId" value={result.id} />
                  <select name="reviewAction" defaultValue="NEEDS_MORE_RESEARCH" className={inputClass}>
                    <option value="SEND_TO_QUALITY_REVIEW">Send to quality review</option>
                    <option value="NEEDS_MORE_RESEARCH">Needs more research</option>
                    <option value="NEEDS_MORE_CONTACT_RESEARCH">Needs more contact research</option>
                    <option value="DISCARD">Discard</option>
                    <option value="REJECT">Reject</option>
                    <option value="LINK_TO_INTERNAL_PROFILE">Link to internal profile</option>
                    <option value="MARK_DUPLICATE">Mark duplicate</option>
                    <option value="MARK_DO_NOT_CONTACT">Mark do not contact</option>
                    <option value="ARCHIVE">Archive</option>
                  </select>
                  <input name="reviewerNotes" className={inputClass} placeholder="Admin-only review note" />
                  <button className={buttonClass}>Apply review</button>
                </form>
              </article>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
