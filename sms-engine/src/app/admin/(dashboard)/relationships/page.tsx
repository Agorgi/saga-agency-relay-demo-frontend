import { StatusBadge } from "@/components/admin/StatusBadge";
import { adminContactLabel } from "@/lib/adminPrivacy";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RelationshipsPage() {
  const edges = await getDb().relationshipEdge.findMany({
    include: { fromPerson: true, toPerson: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Demo graph
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Relationship graph</h2>
      </div>
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3">Relationship</th>
              <th className="px-4 py-3">Strength</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {edges.map((edge) => (
              <tr key={edge.id}>
                <td className="px-4 py-3">
                  {adminContactLabel({
                    name: edge.fromPerson.name,
                    phone: edge.fromPerson.phone,
                    fallback: edge.fromPerson.id,
                  })}
                </td>
                <td className="px-4 py-3">
                  {adminContactLabel({
                    name: edge.toPerson.name,
                    phone: edge.toPerson.phone,
                    fallback: edge.toPerson.id,
                  })}
                </td>
                <td className="px-4 py-3"><StatusBadge status={edge.relationshipType} /></td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{edge.strength}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
