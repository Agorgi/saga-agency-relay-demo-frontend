import { Send } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { redactPhoneForDisplay } from "@/lib/adminPrivacy";
import { getDb } from "@/lib/db";
import {
  approveMockRecommendationOutreachAction,
  simulateCandidateReplyAction,
} from "@/app/admin/(dashboard)/network-actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

function breakdown(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      proximity: 0,
      roleFit: 0,
      fandomFit: 0,
      location: 0,
      reliability: 0,
    };
  }
  const record = value as Record<string, unknown>;
  return {
    proximity: Number(record.proximity || 0),
    roleFit: Number(record.roleFit || 0),
    fandomFit: Number(record.fandomFit || 0),
    location: Number(record.location || 0),
    reliability: Number(record.reliability || 0),
  };
}

export default async function RecommendationsPage() {
  const recommendations = await getDb().candidateRecommendation.findMany({
    include: {
      person: { include: { creatorProfile: true } },
      opportunity: { include: { roleOpening: { include: { project: true } } } },
    },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: 200,
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Review-only suggestions"
        title="Recommendations"
        description="Review suggested candidates before any user-facing shortlist or outreach step."
        helpText="Recommendations are not bookings, confirmations, or permission to contact anyone."
      />
      <section className="space-y-4">
        {recommendations.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-black p-4 text-sm text-zinc-500">
            No candidate recommendations yet. Run matching from an opportunity
            or create the full demo scenario.
          </p>
        ) : null}
        {recommendations.map((recommendation) => {
          const parts = breakdown(recommendation.scoreBreakdown);
          return (
          <div key={recommendation.id} className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {recommendation.person.name || recommendation.person.creatorProfile?.displayName || "Unnamed"}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      {recommendation.opportunity.roleOpening.title} for{" "}
                      {recommendation.opportunity.roleOpening.project.title || "Untitled project"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={recommendation.status} />
                    <StatusBadge status={recommendation.proximityTier} />
                    <span className="rounded-md border border-zinc-800 px-2 py-1 font-mono text-xs text-zinc-300">
                      score {recommendation.score}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 md:col-span-2">
                    <p className="text-xs uppercase text-zinc-500">Score breakdown</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-zinc-300 md:grid-cols-5">
                      <span>Proximity {parts.proximity}</span>
                      <span>Role {parts.roleFit}</span>
                      <span>Fandom {parts.fandomFit}</span>
                      <span>Location {parts.location}</span>
                      <span>Review {parts.reliability}</span>
                    </div>
                  </div>
                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-xs uppercase text-zinc-500">Reasons</p>
                    <p className="mt-2 text-sm text-zinc-300">{recommendation.matchingReasons.join(", ")}</p>
                  </div>
                  <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-xs uppercase text-zinc-500">Risks</p>
                    <p className="mt-2 text-sm text-zinc-300">{recommendation.risks.join(", ") || "None"}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={approveMockRecommendationOutreachAction}>
                    <input type="hidden" name="recommendationIds" value={recommendation.id} />
                    <button className={buttonClass}>
                      <Send aria-hidden className="h-4 w-4" />
                      Mock outreach
                    </button>
                  </form>
                </div>
                <form action={simulateCandidateReplyAction} className="mt-3 grid gap-2 md:grid-cols-[220px_minmax(0,1fr)_auto]">
                  <input type="hidden" name="personId" value={recommendation.personId} />
                  <select name="body" className={inputClass}>
                    <option value="YES">YES</option>
                    <option value="MAYBE">MAYBE</option>
                    <option value="NO">NO</option>
                    <option value="YES, you can introduce me in the group">YES, consent to group</option>
                  </select>
                  <input
                    disabled
                    value={redactPhoneForDisplay(recommendation.person.phone)}
                    className={inputClass}
                  />
                  <button className={buttonClass}>Simulate reply</button>
                </form>
              </div>
            </div>
          </div>
          );
        })}
      </section>
    </div>
  );
}
