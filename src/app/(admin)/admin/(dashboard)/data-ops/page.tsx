import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  dataOpsCompleteParticipantAction,
  dataOpsOptOutParticipantAction,
  dataOpsPauseParticipantAction,
  dataOpsRecordChecklistAction,
  dataOpsRecordPilotSummaryExportAction,
  dataOpsRedactParticipantAction,
  dataOpsRedactFeedbackNotesAction,
  dataOpsRedactProjectMessagesAction,
} from "@/app/(admin)/admin/(dashboard)/actions";
import {
  getPilotDataOpsAdminSnapshot,
  getTranscriptExportForProject,
} from "@/sms-engine/dataOps/pilotExport";
import { redactSensitiveJson } from "@/sms-engine/dataOps/dataClassification";

export const dynamic = "force-dynamic";

type DataOpsPageProps = {
  searchParams?: Promise<{
    export?: string;
    projectBriefId?: string;
  }>;
};

const buttonClass =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";
const dangerButtonClass =
  "inline-flex items-center justify-center rounded-md border border-red-900 px-3 py-2 text-xs font-medium text-red-100 transition hover:border-red-700 hover:bg-red-950/40";
const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number | boolean | null;
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
      <p className="mt-2 text-2xl font-semibold">
        {value === null ? "n/a" : String(value)}
      </p>
    </div>
  );
}

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

function safeJson(value: unknown) {
  return JSON.stringify(redactSensitiveJson(value), null, 2);
}

function ExportPreview({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-black">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Redacted admin-only preview. Raw phone numbers, emails, secrets, and
          production Saga data are excluded.
        </p>
      </div>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap p-4 text-xs text-zinc-300">
        {typeof value === "string" ? value : safeJson(value)}
      </pre>
    </section>
  );
}

export default async function DataOpsPage({ searchParams }: DataOpsPageProps) {
  const params = await searchParams;
  const snapshot = await getPilotDataOpsAdminSnapshot();
  const exportMode = params?.export || "summary";
  const transcriptExport =
    exportMode === "transcript" && params?.projectBriefId && snapshot.counts.databaseAvailable
      ? await getTranscriptExportForProject(params.projectBriefId)
      : null;
  const preview =
    exportMode === "participants_csv"
      ? snapshot.participantCsv
      : exportMode === "feedback_csv"
        ? snapshot.feedbackCsv
        : transcriptExport || snapshot.safeSummaryExport;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Pilot data tools"
        title="Data Tools"
        description="Export, redact, and review pilot data safely."
        helpText="Export previews are redacted. This page has no SMS send controls and no production Saga app connection."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Participants" value={snapshot.counts.participants} />
        <StatCard label="Active" value={snapshot.counts.activeParticipants} />
        <StatCard label="Waitlisted" value={snapshot.counts.waitlistedParticipants} />
        <StatCard label="Opted out" value={snapshot.counts.optedOutParticipants} />
        <StatCard label="Project briefs" value={snapshot.counts.projectBriefs} />
        <StatCard label="Messages" value={snapshot.counts.messages} />
        <StatCard label="Audit events" value={snapshot.counts.auditEvents} />
        <StatCard label="Feedback notes" value={snapshot.counts.feedbackNotes} />
        <StatCard label="LLM review items" value={snapshot.counts.llmReviewItems} />
        <StatCard label="Outbound drafts" value={snapshot.counts.outboundDrafts} />
        <StatCard label="Processing jobs" value={snapshot.counts.processingJobs} />
        <StatCard
          label="Backup checklist"
          value={snapshot.health.backupChecklistStatus}
          tone={snapshot.health.backupRunbookAvailable ? "safe" : "warn"}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Operator Checklists">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Data inventory", snapshot.health.dataInventoryAvailable],
              ["Retention policy", snapshot.health.retentionPolicyAvailable],
              ["Backup runbook", snapshot.health.backupRunbookAvailable],
              ["Migration checklist", snapshot.health.migrationChecklistAvailable],
              ["Incident runbook", snapshot.health.incidentRunbookAvailable],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-md border border-zinc-900 bg-zinc-950 p-3"
              >
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  {label}
                </p>
                <p className="mt-1 text-zinc-200">{String(value)}</p>
              </div>
            ))}
          </div>
          <form action={dataOpsRecordChecklistAction} className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-zinc-300">
              Record manual checklist
              <select name="kind" className={inputClass} defaultValue="backup">
                <option value="backup">Backup check</option>
                <option value="restore">Restore check</option>
                <option value="retention">Retention review</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-zinc-300">
              Notes are stored as a presence flag only
              <textarea
                name="notes"
                rows={2}
                className={inputClass}
                placeholder="Manual operator note, not exported here"
              />
            </label>
            <button className={buttonClass}>Record checklist event</button>
          </form>
        </Section>

        <Section title="Safe Exports">
          <div className="flex flex-wrap gap-2">
            <Link className={buttonClass} href="/admin/data-ops?export=summary">
              Summary JSON
            </Link>
            <Link className={buttonClass} href="/admin/data-ops?export=participants_csv">
              Participants CSV
            </Link>
            <Link className={buttonClass} href="/admin/data-ops?export=feedback_csv">
              Feedback CSV
            </Link>
            <form action={dataOpsRecordPilotSummaryExportAction}>
              <button className={buttonClass}>Record summary export audit</button>
            </form>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            Export previews are redacted by default. Participant notes, raw
            phone numbers, raw emails, prompts, secrets, and production Saga app
            data are excluded.
          </p>
        </Section>
      </div>

      <ExportPreview title={`Export preview: ${exportMode}`} value={preview} />

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold">Participants</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Phone numbers are redacted. Redaction soft-deletes participant
            identity fields and preserves audit history.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-[0.14em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Participant</th>
                <th className="px-4 py-3 text-left">Cohort</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {snapshot.participants.map((participant) => (
                <tr key={participant.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="text-zinc-200">{participant.name || participant.id}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {participant.redactedPhone || "[no phone]"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{participant.cohort}</td>
                  <td className="px-4 py-3 text-zinc-400">{participant.role}</td>
                  <td className="px-4 py-3 text-zinc-400">{participant.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <form action={dataOpsPauseParticipantAction.bind(null, participant.id)}>
                        <button className={buttonClass}>Pause</button>
                      </form>
                      <form action={dataOpsCompleteParticipantAction.bind(null, participant.id)}>
                        <button className={buttonClass}>Complete</button>
                      </form>
                      <form action={dataOpsOptOutParticipantAction.bind(null, participant.id)}>
                        <button className={buttonClass}>Opt out</button>
                      </form>
                      <form action={dataOpsRedactParticipantAction.bind(null, participant.id)}>
                        <button className={dangerButtonClass}>Redact</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {snapshot.participants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-zinc-500">
                    No pilot participants yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold">Redacted transcripts</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Open a transcript preview or redact all message bodies for a project
            brief when a participant deletion/redaction workflow requires it.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-[0.14em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Project brief</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Updated</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {snapshot.projectBriefs.map((brief) => (
                <tr key={brief.id}>
                  <td className="px-4 py-3 text-zinc-200">{brief.title || brief.id}</td>
                  <td className="px-4 py-3 text-zinc-400">{brief.status}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {brief.updatedAt.toISOString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className={buttonClass}
                        href={`/admin/data-ops?export=transcript&projectBriefId=${brief.id}`}
                      >
                        Preview transcript
                      </Link>
                      <form action={dataOpsRedactProjectMessagesAction.bind(null, brief.id)}>
                        <button className={dangerButtonClass}>Redact messages</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {snapshot.projectBriefs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">
                    No project briefs yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold">Feedback notes</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Notes are shown through the same safe redaction helper used by
            exports. Redacting a note preserves the feedback record and audit
            trail.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-[0.14em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Feedback</th>
                <th className="px-4 py-3 text-left">Links</th>
                <th className="px-4 py-3 text-left">Preview</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {snapshot.feedbackItems.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="text-zinc-200">{item.category}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      rating {item.rating ?? "n/a"} · {item.createdAt.toISOString()}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    <p>brief: {item.projectBriefId || "none"}</p>
                    <p>participant: {item.pilotParticipantId || "none"}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {String(item.notesPreview ?? "")}
                  </td>
                  <td className="px-4 py-3">
                    <form action={dataOpsRedactFeedbackNotesAction.bind(null, item.id)}>
                      <button className={dangerButtonClass}>Redact note</button>
                    </form>
                  </td>
                </tr>
              ))}
              {snapshot.feedbackItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">
                    No pilot feedback notes yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold">Recent export and redaction events</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-[0.14em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Entity</th>
                <th className="px-4 py-3 text-left">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {snapshot.recentExportsAndRedactions.map((event) => (
                <tr key={event.id} className="align-top">
                  <td className="px-4 py-3 text-zinc-400">
                    {event.createdAt.toISOString()}
                  </td>
                  <td className="px-4 py-3 text-zinc-200">{event.action}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {event.entityType}/{event.entityId}
                  </td>
                  <td className="px-4 py-3">
                    <pre className="max-h-32 max-w-xl overflow-auto whitespace-pre-wrap rounded-md border border-zinc-900 bg-zinc-950 p-2 text-xs text-zinc-400">
                      {safeJson(event.metadata)}
                    </pre>
                  </td>
                </tr>
              ))}
              {snapshot.recentExportsAndRedactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">
                    No data-ops audit events yet.
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
