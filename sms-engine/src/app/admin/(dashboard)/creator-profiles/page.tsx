import { Save } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { adminContactLabel } from "@/sms-engine/adminPrivacy";
import { getDb } from "@/sms-engine/db";
import { updateCreatorProfileReviewAction } from "@/app/admin/(dashboard)/network-actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

export default async function CreatorProfilesPage() {
  const profiles = await getDb().creatorProfile.findMany({
    include: {
      person: {
        include: {
          recommendations: {
            include: {
              opportunity: { include: { roleOpening: { include: { project: true } } } },
            },
            orderBy: { score: "desc" },
            take: 6,
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Creator network
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Creator profiles</h2>
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        {profiles.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-black p-4 text-sm text-zinc-500">
            No creator profiles yet. Use the demo lab creator onboarding flow
            or seed demo data to populate this page.
          </p>
        ) : null}
        {profiles.map((profile) => {
          const reviewAction = updateCreatorProfileReviewAction.bind(null, profile.id);
          return (
            <div key={profile.id} className="rounded-lg border border-zinc-800 bg-black p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">
                    {profile.displayName || profile.person.name || "Unnamed creator"}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    {adminContactLabel({
                      phone: profile.person.phone,
                      email: profile.person.email,
                      fallback: profile.person.id,
                    })}
                  </p>
                </div>
                <StatusBadge status={profile.reviewStatus} />
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {profile.bio || "No bio yet."}
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase text-zinc-500">Roles</dt>
                  <dd className="mt-1 text-zinc-300">{profile.roles.join(", ") || "Unknown"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-zinc-500">Skills</dt>
                  <dd className="mt-1 text-zinc-300">{profile.skills.join(", ") || "Unknown"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-zinc-500">Fandoms</dt>
                  <dd className="mt-1 text-zinc-300">{profile.fandoms.join(", ") || "Unknown"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-zinc-500">Links</dt>
                  <dd className="mt-1 text-zinc-300">
                    {[...profile.portfolioUrls, ...profile.socialUrls].slice(0, 3).join(", ") || "None"}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-xs uppercase text-zinc-500">Matched opportunities</p>
                <div className="mt-2 space-y-1 text-sm text-zinc-400">
                  {profile.person.recommendations.map((recommendation) => (
                    <p key={recommendation.id}>
                      {recommendation.opportunity.roleOpening.title} for{" "}
                      {recommendation.opportunity.roleOpening.project.title || "Untitled"} - score{" "}
                      {recommendation.score}
                    </p>
                  ))}
                  {profile.person.recommendations.length === 0 ? <p>None yet.</p> : null}
                </div>
              </div>
              <form action={reviewAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <select name="reviewStatus" defaultValue={profile.reviewStatus} className={inputClass}>
                  <option value="PENDING_REVIEW">Pending review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="NEEDS_MORE_INFO">Needs more info</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <input
                  name="internalNotes"
                  defaultValue={profile.internalNotes || ""}
                  className={inputClass}
                  placeholder="Internal notes"
                />
                <button className={buttonClass}>
                  <Save aria-hidden className="h-4 w-4" />
                  Save
                </button>
              </form>
            </div>
          );
        })}
      </section>
    </div>
  );
}
