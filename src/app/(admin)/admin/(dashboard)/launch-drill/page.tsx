import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  recordLaunchDrillManualEvidenceAction,
  runLaunchReadinessDrillAction,
  simulateIncidentDrillAction,
  simulateRollbackDrillAction,
} from "@/app/(admin)/admin/(dashboard)/actions";
import {
  evaluateLaunchReadinessDrill,
  formatLaunchDrillReport,
  launchDrillStageIds,
  launchDrillStageStatuses,
} from "@/sms-engine/launchDrill/launchReadinessDrill";

export const dynamic = "force-dynamic";

const buttonClass =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";
const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";

function toneForStatus(status: string) {
  if (status === "PASSED" || status === "READY") return "border-emerald-900 bg-emerald-950/30 text-emerald-100";
  if (status === "BLOCKED" || status === "FAILED") return "border-red-900 bg-red-950/30 text-red-100";
  return "border-zinc-800 bg-zinc-950 text-zinc-300";
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number | boolean | null;
  tone?: "neutral" | "safe" | "warn" | "danger";
}) {
  const toneClass =
    tone === "safe"
      ? "border-emerald-900 bg-emerald-950/30 text-emerald-100"
      : tone === "warn"
        ? "border-amber-900 bg-amber-950/30 text-amber-100"
        : tone === "danger"
          ? "border-red-900 bg-red-950/30 text-red-100"
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

function ChipList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }
  return (
    <ul className="space-y-2 text-sm text-zinc-300">
      {items.map((item) => (
        <li key={item} className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

function safeJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default async function LaunchDrillPage() {
  const drill = await evaluateLaunchReadinessDrill();
  const report = formatLaunchDrillReport(drill);
  const riskTone =
    drill.launchRiskLevel === "green"
      ? "safe"
      : drill.launchRiskLevel === "yellow"
        ? "warn"
        : "danger";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Launch readiness"
        title="Launch Checklist"
        description="Check whether the app is ready for self-test, design partners, private beta, or public beta."
        helpText="This is a dry run. It has no send button, no invite button, and no public-launch control."
      />

      <div className="flex flex-wrap gap-2">
        {[
          "DRY RUN ONLY",
          "NO SMS WILL BE SENT",
          "NO TWILIO SEND API",
          "NO DESIGN PARTNER INVITES",
          "PUBLIC LAUNCH DISABLED",
        ].map((label) => (
          <span
            key={label}
            className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100"
          >
            {label}
          </span>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Risk level" value={drill.launchRiskLevel} tone={riskTone} />
        <StatCard label="Recommended stage" value={drill.currentRecommendedStage} />
        <StatCard label="Overall ready" value={drill.overallReady} tone={drill.overallReady ? "safe" : "warn"} />
        <StatCard label="Blockers" value={drill.globalBlockers.length} tone={drill.globalBlockers.length ? "warn" : "safe"} />
        <StatCard label="Warnings" value={drill.globalWarnings.length} />
        <StatCard label="Generated" value={drill.generatedAt} />
        <StatCard
          label="Design partner ready"
          value={
            drill.stages.find((stage) => stage.id === "DESIGN_PARTNER_10")
              ?.status === "READY"
          }
        />
        <StatCard
          label="Public beta candidate"
          value={
            drill.stages.find((stage) => stage.id === "PUBLIC_BETA_CANDIDATE")
              ?.status === "READY"
          }
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-zinc-800 bg-black p-4">
          <h3 className="text-sm font-semibold">Run Drill</h3>
          <p className="mt-2 text-sm text-zinc-500">
            Records a redacted audit trail for this simulated drill. It does not
            mutate env vars, send SMS, invite users, or call Twilio send APIs.
          </p>
          <form action={runLaunchReadinessDrillAction} className="mt-4 space-y-3">
            <textarea
              name="notes"
              rows={3}
              className={inputClass}
              placeholder="Optional operator note; audit stores note presence only"
            />
            <button className={buttonClass}>Run readiness drill</button>
          </form>
        </section>

        <section className="rounded-lg border border-zinc-800 bg-black p-4">
          <h3 className="text-sm font-semibold">Simulations</h3>
          <p className="mt-2 text-sm text-zinc-500">
            These write audit events only. They do not flip `SMS_SENDS_DISABLED`,
            disable webhooks, pause records, or delete data.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={simulateRollbackDrillAction}>
              <button className={buttonClass}>Simulate rollback drill</button>
            </form>
            <form action={simulateIncidentDrillAction}>
              <button className={buttonClass}>Simulate incident drill</button>
            </form>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <h3 className="text-sm font-semibold">Manual Evidence</h3>
        <p className="mt-2 text-sm text-zinc-500">
          Mark evidence after an operator completes an external/manual step.
          This records an audit event only.
        </p>
        <form action={recordLaunchDrillManualEvidenceAction} className="mt-4 grid gap-4 md:grid-cols-4">
          <label className="block text-sm font-medium text-zinc-300">
            Stage
            <select name="stage" className={inputClass} defaultValue={drill.currentRecommendedStage}>
              {launchDrillStageIds.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-300">
            Status
            <select name="status" className={inputClass} defaultValue="PASSED">
              {launchDrillStageStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-300 md:col-span-2">
            Note
            <input
              name="notes"
              className={inputClass}
              placeholder="Optional note; audit stores note presence only"
            />
          </label>
          <div className="md:col-span-4">
            <button className={buttonClass}>Record manual evidence</button>
          </div>
        </form>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-zinc-800 bg-black p-4">
          <h3 className="text-sm font-semibold">Global Blockers</h3>
          <div className="mt-4">
            <ChipList items={drill.globalBlockers} empty="No global blockers." />
          </div>
        </section>
        <section className="rounded-lg border border-zinc-800 bg-black p-4">
          <h3 className="text-sm font-semibold">Global Warnings</h3>
          <div className="mt-4">
            <ChipList items={drill.globalWarnings} empty="No global warnings." />
          </div>
        </section>
      </div>

      <section className="space-y-4">
        {drill.stages.map((stage) => (
          <article key={stage.id} className="rounded-lg border border-zinc-800 bg-black p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {stage.id}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{stage.title}</h3>
                <p className="mt-2 max-w-3xl text-sm text-zinc-500">{stage.goal}</p>
              </div>
              <span className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${toneForStatus(stage.status)}`}>
                {stage.status}
              </span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Preconditions
                </p>
                <ChipList items={stage.requiredPreconditions} empty="None listed." />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Operator steps
                </p>
                <ChipList items={stage.operatorSteps} empty="None listed." />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Evidence
                </p>
                <ChipList items={stage.expectedEvidence} empty="None listed." />
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-red-200">
                  Blockers
                </p>
                <ChipList items={stage.blockers} empty="No stage blockers." />
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.14em] text-amber-200">
                  Warnings
                </p>
                <ChipList items={stage.warnings} empty="No stage warnings." />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {stage.relatedDocs.map((doc) => (
                <span
                  key={doc}
                  className="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400"
                >
                  {doc}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold">Drill Report Preview</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Redacted Markdown. Safe to paste into internal review channels.
          </p>
        </div>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap p-4 text-xs text-zinc-300">
          {report}
        </pre>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <h3 className="text-sm font-semibold">Evidence Summary</h3>
        <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-900 bg-zinc-950 p-4 text-xs text-zinc-300">
          {safeJson(drill.evidenceSummary)}
        </pre>
        <div className="mt-4">
          <Link className={buttonClass} href="/admin/observability">
            Open observability
          </Link>
        </div>
      </section>
    </div>
  );
}
