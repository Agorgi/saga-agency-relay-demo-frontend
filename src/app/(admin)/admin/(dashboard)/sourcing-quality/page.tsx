import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getDb } from "@/sms-engine/db";
import {
  getTalentResearchQualityHealthSnapshot,
  sanitizeOrganizerFacingText,
} from "@/sms-engine/sourcing/talentResearchQuality";
import {
  runTalentQualityReviewAction,
  updateTalentQualityReviewAction,
} from "@/app/(admin)/admin/(dashboard)/sourcing-quality/actions";

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

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-black p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function SourcingQualityPage(props: {
  searchParams: Promise<{ status?: string; source?: string }>;
}) {
  const searchParams = await props.searchParams;
  const [health, candidates, reviews] = await Promise.all([
    getTalentResearchQualityHealthSnapshot(),
    process.env.DATABASE_URL
      ? getDb().talentCandidate.findMany({
          where: {
            ...(searchParams.source ? { source: searchParams.source as never } : {}),
            ...(searchParams.status ? { status: searchParams.status as never } : {}),
          },
          include: {
            searchRun: true,
            researchReviews: { orderBy: { updatedAt: "desc" }, take: 1 },
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 50,
        })
      : [],
    process.env.DATABASE_URL
      ? getDb().talentResearchReview.findMany({
          include: {
            talentCandidate: true,
            searchRun: true,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 50,
        })
      : [],
  ]);

  const candidateIdsWithReview = new Set(
    reviews
      .map((review) => review.talentCandidateId)
      .filter((id): id is string => Boolean(id)),
  );
  const awaitingReview = candidates.filter(
    (candidate) => !candidateIdsWithReview.has(candidate.id),
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Human-gated candidate evidence
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Talent Research Quality</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Score candidate evidence, check source reliability, and approve or
          block research cards before they can flow into shortlist or outreach
          workflows. There are no send controls, no web scraping controls, and
          no production app integration here.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Quality review", health.talentResearchQualityAvailable],
          ["Pending", health.pendingTalentQualityReviewCount ?? "n/a"],
          ["Needs research", health.needsMoreResearchCount ?? "n/a"],
          ["Public web pending", health.publicWebCandidatesPendingReviewCount ?? "n/a"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-zinc-800 bg-black p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
            <p className="mt-2 break-words text-xl font-semibold">{String(value)}</p>
          </div>
        ))}
      </div>

      <Section title="Filters">
        <form className="grid gap-3 md:grid-cols-3">
          <select name="status" defaultValue={searchParams.status || ""} className={inputClass}>
            <option value="">Any candidate status</option>
            <option value="SUGGESTED">Suggested</option>
            <option value="NEEDS_MORE_INFO">Needs more info</option>
            <option value="APPROVED_FOR_SHORTLIST">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="DO_NOT_CONTACT">Do not contact</option>
          </select>
          <select name="source" defaultValue={searchParams.source || ""} className={inputClass}>
            <option value="">Any source</option>
            <option value="INTERNAL_DB">Internal DB</option>
            <option value="PUBLIC_WEB_RESEARCH">Public web research</option>
            <option value="ADMIN_ADDED">Admin added</option>
          </select>
          <button className={buttonClass}>Apply filters</button>
        </form>
      </Section>

      <Section title="Candidates Awaiting Review">
        {awaitingReview.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No candidate cards are waiting for a first quality review.
          </p>
        ) : (
          <div className="space-y-3">
            {awaitingReview.map((candidate) => (
              <article key={candidate.id} className="rounded-md border border-zinc-900 bg-zinc-950 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold">{candidate.displayName}</h4>
                    <p className="mt-1 text-sm text-zinc-500">
                      {candidate.role} {candidate.city ? `- ${candidate.city}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={candidate.source} />
                    <StatusBadge status={candidate.status} />
                    <span className="rounded-md border border-zinc-800 px-2 py-1 font-mono text-xs">
                      score {candidate.score}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm text-zinc-400">
                  Sources: {asArray(candidate.publicSourceUrls).join(", ") || "internal / none"}
                </p>
                <form action={runTalentQualityReviewAction} className="mt-4">
                  <input type="hidden" name="talentCandidateId" value={candidate.id} />
                  <button className={buttonClass}>Run quality review</button>
                </form>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent Quality Reviews">
        {reviews.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No talent research quality reviews have been recorded yet.
          </p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const candidate = review.talentCandidate;
              const checklist = asObject(review.evidenceChecklist);
              const scoreBreakdown = asObject(review.scoreBreakdown);
              const riskFlags = asArray(review.riskFlags);
              return (
                <article key={review.id} className="rounded-md border border-zinc-900 bg-zinc-950 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">
                        {candidate?.displayName || "Candidate review"}
                      </h4>
                      <p className="mt-1 text-sm text-zinc-500">
                        {candidate?.role || "Role unknown"}{" "}
                        {candidate?.city ? `- ${candidate.city}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={review.reviewStatus} />
                      <StatusBadge status={review.sourceMode} />
                      <span className="rounded-md border border-zinc-800 px-2 py-1 font-mono text-xs">
                        score {review.totalScore}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-md border border-zinc-900 bg-black p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Score breakdown
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                        {Object.entries(scoreBreakdown).map(([key, value]) => (
                          <li key={key}>{key}: {String(value)}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-md border border-zinc-900 bg-black p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Evidence checklist
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                        {Object.entries(checklist).map(([key, value]) => (
                          <li key={key}>{key}: {String(value)}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-md border border-zinc-900 bg-black p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Risks and missing evidence
                      </p>
                      <p className="mt-2 text-sm text-zinc-300">
                        {riskFlags.join(", ") || "No risk flags"}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Source reliability
                      </p>
                      <p className="mt-1 text-sm text-zinc-300">
                        {review.sourceReliability}
                      </p>
                    </div>
                  </div>

                  {candidate ? (
                    <div className="mt-4 rounded-md border border-zinc-900 bg-black p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Source URLs / citations
                      </p>
                      <p className="mt-2 break-words text-sm text-zinc-300">
                        {asArray(candidate.publicSourceUrls).join(", ") || "No public URLs recorded"}
                      </p>
                    </div>
                  ) : null}

                  <form action={updateTalentQualityReviewAction} className="mt-4 grid gap-3">
                    <input type="hidden" name="reviewId" value={review.id} />
                    <label className="text-sm text-zinc-300">
                      Review status
                      <select name="reviewStatus" defaultValue={review.reviewStatus} className={inputClass}>
                        <option value="UNREVIEWED">Unreviewed</option>
                        <option value="APPROVED_FOR_SHORTLIST">Approve for shortlist</option>
                        <option value="NEEDS_MORE_RESEARCH">Needs more research</option>
                        <option value="REJECTED">Reject</option>
                        <option value="DO_NOT_CONTACT">Do not contact</option>
                        <option value="NEEDS_ADMIN">Needs admin</option>
                      </select>
                    </label>
                    <label className="text-sm text-zinc-300">
                      Organizer-safe summary
                      <textarea
                        name="organizerFacingSummary"
                        defaultValue={sanitizeOrganizerFacingText(
                          review.organizerFacingSummary || "",
                        )}
                        rows={3}
                        className={inputClass}
                      />
                    </label>
                    <label className="text-sm text-zinc-300">
                      Reviewer notes
                      <textarea
                        name="reviewerNotes"
                        defaultValue={review.reviewerNotes || ""}
                        rows={2}
                        className={inputClass}
                      />
                    </label>
                    <div>
                      <button className={buttonClass}>Save quality review</button>
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </Section>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/sourcing" className={buttonClass}>
          Open sourcing workbench
        </Link>
        <Link href="/admin/recommendations" className={buttonClass}>
          Open recommendations
        </Link>
      </div>
    </div>
  );
}
