import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getDb } from "@/sms-engine/db";
import { getCandidateGraphHealthSnapshot } from "@/sms-engine/graph/candidateGraphHealth";
import { computeProximityTier, explainProximity } from "@/sms-engine/graph/relationshipProximity";

export const dynamic = "force-dynamic";

const buttonClass =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-black p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function asStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export default async function CandidateGraphPage(props: {
  searchParams: Promise<{ requesterId?: string; candidateId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const health = await getCandidateGraphHealthSnapshot();
  const [profiles, edges] = process.env.DATABASE_URL
    ? await Promise.all([
        getDb().candidateSearchProfile.findMany({
          orderBy: { lastIndexedAt: "desc" },
          take: 30,
        }),
        getDb().candidateGraphEdge.findMany({
          orderBy: { updatedAt: "desc" },
          take: 50,
        }),
      ])
    : [[], []];
  const requestedProximity =
    searchParams.requesterId && searchParams.candidateId
      ? computeProximityTier(searchParams.requesterId, searchParams.candidateId, {
          edges: edges.map((edge) => ({
            fromEntityType: edge.fromEntityType,
            fromEntityId: edge.fromEntityId,
            toEntityType: edge.toEntityType,
            toEntityId: edge.toEntityId,
            edgeType: edge.edgeType,
            strength: edge.strength,
            confidence: edge.confidence,
            isInferred: edge.isInferred,
            sourceType: edge.sourceType,
          })),
        })
      : null;

  return (
    <div className="space-y-6">
      <div>
        <AdminPageHeader
          eyebrow="Review-gated matching graph"
          title="Talent Map"
          description="Inspect candidate search profiles, graph evidence, proximity tiers, duplicate links, and contactability status."
          helpText="This view has no SMS, outreach, group-chat, shortlist send, public launch, or production app controls."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className={buttonClass} href="/admin/sourcing">
            Open sourcing
          </Link>
          <Link className={buttonClass} href="/admin/matching">
            Open matching
          </Link>
          <Link className={buttonClass} href="/admin/sourcing/public-web-review">
            Open web review
          </Link>
          <Link
            className={buttonClass}
            href="/admin/data-ops?doc=docs%2Fcandidate-graph-v0.6a.md"
          >
            Open graph docs
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Available", health.candidateGraphAvailable],
          ["Matching", health.relationshipAwareMatchingAvailable],
          ["Search profiles", health.candidateSearchProfileCount ?? "n/a"],
          ["Graph edges", health.graphEdgeCount ?? "n/a"],
          ["Unverified", health.unverifiedResearchCandidateCount ?? "n/a"],
          ["Do not contact", health.doNotContactCandidateCount ?? "n/a"],
          ["Public web only", health.publicWebOnlyCandidateCount ?? "n/a"],
          ["Recent match runs", health.recentMatchRunCount ?? "n/a"],
          ["Pending match review", health.pendingMatchReviewCount ?? "n/a"],
          ["Average match score", health.averageCandidateScore ?? "n/a"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-zinc-800 bg-black p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              {label}
            </p>
            <p className="mt-2 text-xl font-semibold">{String(value)}</p>
          </div>
        ))}
      </div>

      <Section title="Proximity Debug">
        <form className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <input
            name="requesterId"
            defaultValue={searchParams.requesterId || ""}
            placeholder="Requester person id"
            className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
          <input
            name="candidateId"
            defaultValue={searchParams.candidateId || ""}
            placeholder="Candidate person id"
            className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          />
          <button className={buttonClass}>Compute tier</button>
        </form>
        <p className="mt-3 text-sm text-zinc-400">
          {requestedProximity
            ? `${requestedProximity}: ${explainProximity(requestedProximity)}`
            : "Enter two internal person ids to compute proximity across the loaded edge subset."}
        </p>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Candidate Search Profiles">
          {profiles.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No candidate search profiles indexed yet.
            </p>
          ) : (
            <div className="space-y-3">
              {profiles.map((profile) => (
                <article
                  key={profile.id}
                  className="rounded-md border border-zinc-900 bg-zinc-950 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{profile.displayName}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {profile.city || "city unknown"}{" "}
                        {profile.metro ? `- ${profile.metro}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={profile.reviewStatus} />
                      <StatusBadge status={profile.sourceMode} />
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-zinc-300 md:grid-cols-2">
                    <p>Roles: {asStringList(profile.roleTags).join(", ") || "none"}</p>
                    <p>Fandoms: {asStringList(profile.fandomTags).join(", ") || "none"}</p>
                    <p>Evidence score: {profile.evidenceQualityScore}</p>
                    <p>Contactability score: {profile.contactabilityScore}</p>
                    <p>Do not contact: {String(profile.doNotContact)}</p>
                    <p>Opted out: {String(profile.optedOut)}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Section>

        <Section title="Graph Edges">
          {edges.length === 0 ? (
            <p className="text-sm text-zinc-500">No graph edges found.</p>
          ) : (
            <div className="space-y-3">
              {edges.map((edge) => (
                <article
                  key={edge.id}
                  className="rounded-md border border-zinc-900 bg-zinc-950 p-3"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-zinc-500">
                        {edge.fromEntityType}:{edge.fromEntityId} to{" "}
                        {edge.toEntityType}:{edge.toEntityId}
                      </p>
                      <p className="mt-1 text-sm text-zinc-300">
                        {edge.evidenceSummary || "No evidence summary recorded."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={edge.edgeType} />
                      {edge.isInferred ? <StatusBadge status="INFERRED" /> : null}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-zinc-400 md:grid-cols-3">
                    <p>Strength: {edge.strength}</p>
                    <p>Confidence: {edge.confidence}</p>
                    <p>Source: {edge.sourceType}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
