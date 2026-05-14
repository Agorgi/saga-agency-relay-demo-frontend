import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { adminContactLabel } from "@/lib/adminPrivacy";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const people = await getDb().person.findMany({
    include: {
      creatorProfile: true,
      recommendations: true,
      teamMemberships: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Production network
        </p>
        <h2 className="mt-2 text-2xl font-semibold">People</h2>
      </div>

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Consent</th>
              <th className="px-4 py-3">Profile</th>
              <th className="px-4 py-3">Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {people.map((person) => (
              <tr key={person.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-100">
                    {person.name || person.creatorProfile?.displayName || "Unnamed"}
                  </p>
                  <p className="font-mono text-xs text-zinc-500">
                    {adminContactLabel({
                      phone: person.phone,
                      email: person.email,
                      fallback: person.id,
                    })}
                  </p>
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {[person.city, person.state, person.country].filter(Boolean).join(", ") || "Unknown"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={person.source} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={person.optedOut ? "OPTED_OUT" : person.consentStatus} />
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {person.creatorProfile ? (
                    <Link href="/admin/creator-profiles" className="hover:text-white">
                      {person.creatorProfile.roles.slice(0, 3).join(", ") || "Profile"}
                    </Link>
                  ) : (
                    "None"
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {person.recommendations.length} recommendations |{" "}
                  {person.teamMemberships.length} teams
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {people.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No people in the production network yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}
