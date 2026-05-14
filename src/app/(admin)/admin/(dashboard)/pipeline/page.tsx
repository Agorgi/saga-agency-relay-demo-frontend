import {
  markInboundProcessingJobSkippedAction,
  retryInboundProcessingJobAction,
} from "@/app/(admin)/admin/(dashboard)/actions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getMessagingPipelineAdminSnapshot } from "@/sms-engine/messagingPipeline";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "safe" | "warn";
}) {
  const toneClass =
    tone === "safe"
      ? "border-emerald-900 bg-emerald-950/30 text-emerald-100"
      : tone === "warn"
        ? "border-amber-900 bg-amber-950/30 text-amber-100"
        : "border-zinc-800 bg-black text-zinc-100";

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function asText(value: unknown) {
  if (value === null || value === undefined) return "none";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export default async function PipelinePage() {
  const snapshot = await getMessagingPipelineAdminSnapshot();
  const counts = snapshot.counts as Record<string, number>;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Messaging pipeline
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Inbound processing jobs</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Durable observability for Twilio inbound processing. The default mode
          remains synchronous; async active processing is future-only, and this
          page has no send controls.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Processing mode" value={snapshot.messageProcessingMode} />
        <StatCard
          label="Async available"
          value={snapshot.asyncProcessingAvailable ? "true" : "false"}
          tone={snapshot.asyncProcessingAvailable ? "safe" : "warn"}
        />
        <StatCard
          label="Queue depth"
          value={snapshot.queueDepth ?? "n/a"}
          tone={snapshot.queueDepth ? "warn" : "safe"}
        />
        <StatCard
          label="Failed jobs"
          value={snapshot.failedJobCount ?? "n/a"}
          tone={snapshot.failedJobCount ? "warn" : "safe"}
        />
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts).map(([status, count]) => (
            <span
              key={status}
              className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300"
            >
              {status}: {count}
            </span>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold">Recent jobs</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Sender hashes are stored, but raw phone numbers are not displayed.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-[0.14em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Mode</th>
                <th className="px-4 py-3 text-left">Attempts</th>
                <th className="px-4 py-3 text-left">Message SID</th>
                <th className="px-4 py-3 text-left">Error</th>
                <th className="px-4 py-3 text-left">Result</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {snapshot.recentJobs.map((job) => (
                <tr key={job.id} className="align-top">
                  <td className="px-4 py-3 text-zinc-400">
                    {job.createdAt.toISOString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{job.processingMode}</td>
                  <td className="px-4 py-3 text-zinc-300">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-zinc-500">
                    {job.inboundTwilioMessageSid || "none"}
                  </td>
                  <td className="max-w-[260px] px-4 py-3 text-zinc-400">
                    <p>{job.lastErrorCategory || "none"}</p>
                    {job.lastErrorMessageRedacted ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {job.lastErrorMessageRedacted}
                      </p>
                    ) : null}
                  </td>
                  <td className="max-w-[320px] px-4 py-3">
                    <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-900 bg-zinc-950 p-2 text-xs text-zinc-400">
                      {asText(job.resultSummary)}
                    </pre>
                  </td>
                  <td className="space-y-2 px-4 py-3">
                    {job.status === "FAILED" ? (
                      <form action={retryInboundProcessingJobAction.bind(null, job.id)}>
                        <button className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900">
                          Retry
                        </button>
                      </form>
                    ) : null}
                    {job.status === "PENDING" || job.status === "FAILED" ? (
                      <form
                        action={markInboundProcessingJobSkippedAction.bind(
                          null,
                          job.id,
                        )}
                      >
                        <button className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900">
                          Mark skipped
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
              {snapshot.recentJobs.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-zinc-500" colSpan={8}>
                    No inbound processing jobs yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
