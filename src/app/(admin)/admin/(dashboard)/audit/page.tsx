import { safeAuditLogForDisplay } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";

export const dynamic = "force-dynamic";

type AuditPageProps = {
  searchParams?: Promise<{ entityType?: string }>;
};

function metadataPreview(metadata: unknown) {
  return JSON.stringify(metadata, null, 2);
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const params = await searchParams;
  const entityType =
    typeof params?.entityType === "string" && params.entityType.trim()
      ? params.entityType.trim()
      : null;

  const db = getDb();
  const [logs, entityTypeRows] = await Promise.all([
    db.auditLog.findMany({
      where: entityType ? { entityType } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.auditLog.findMany({
      select: { entityType: true },
      orderBy: { entityType: "asc" },
      distinct: ["entityType"],
    }),
  ]);
  const safeLogs = logs.map(safeAuditLogForDisplay);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Operator trail
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Audit log</h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Recent system, admin, demo, and internal API events. Sensitive fields
          are redacted before display.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-800 bg-black p-4">
        <label className="text-sm text-zinc-300">
          <span className="block text-xs uppercase text-zinc-500">
            Entity type
          </span>
          <select
            name="entityType"
            defaultValue={entityType || ""}
            className="mt-1 min-w-56 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          >
            <option value="">All entity types</option>
            {entityTypeRows.map((row) => (
              <option key={row.entityType} value={row.entityType}>
                {row.entityType}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900">
          Filter
        </button>
        {entityType ? (
          <a
            href="/admin/audit"
            className="rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
          >
            Clear
          </a>
        ) : null}
      </form>

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {safeLogs.map((log) => (
              <tr key={log.id} className="align-top hover:bg-zinc-950">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-500">
                  {log.createdAt.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-zinc-300">{log.actorType}</td>
                <td className="px-4 py-3 font-medium text-zinc-100">
                  {log.action}
                </td>
                <td className="px-4 py-3">
                  <div className="text-zinc-300">{log.entityType}</div>
                  <div className="mt-1 max-w-48 truncate font-mono text-xs text-zinc-500">
                    {log.entityId}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <pre className="max-h-40 overflow-auto rounded-md border border-zinc-900 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-400">
                    {metadataPreview(log.metadata)}
                  </pre>
                </td>
              </tr>
            ))}
            {safeLogs.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-zinc-500" colSpan={5}>
                  No audit events found for this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
