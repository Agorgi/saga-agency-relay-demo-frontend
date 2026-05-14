import Link from "next/link";
import { Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getDb } from "@/lib/db";
import { runRecommendationsAction } from "@/app/admin/(dashboard)/network-actions";

export const dynamic = "force-dynamic";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

export default async function OpportunitiesPage() {
  const opportunities = await getDb().opportunity.findMany({
    include: {
      roleOpening: { include: { project: true } },
      recommendations: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Artist opportunities
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Opportunities</h2>
      </div>
      <section className="grid gap-4 xl:grid-cols-2">
        {opportunities.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-black p-4 text-sm text-zinc-500">
            No opportunities yet. Convert role openings into opportunities from
            the roles page or create the full demo scenario.
          </p>
        ) : null}
        {opportunities.map((opportunity) => {
          const runAction = runRecommendationsAction.bind(null, opportunity.id);
          return (
            <div key={opportunity.id} className="rounded-lg border border-zinc-800 bg-black p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{opportunity.roleOpening.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    <Link href={`/admin/network-projects/${opportunity.roleOpening.projectId}`} className="hover:text-white">
                      {opportunity.roleOpening.project.title || "Untitled project"}
                    </Link>
                  </p>
                </div>
                <form action={runAction}>
                  <button className={buttonClass}>
                    <Sparkles aria-hidden className="h-4 w-4" />
                    Match
                  </button>
                </form>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge status={opportunity.status} />
                <StatusBadge status={opportunity.visibility} />
                <StatusBadge status={opportunity.applicationMode} />
              </div>
              <p className="mt-4 text-sm text-zinc-400">
                {opportunity.recommendations.length} candidate recommendations
              </p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
