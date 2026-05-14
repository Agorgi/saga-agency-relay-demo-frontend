import Link from "next/link";
import {
  recordAllBetaCohortSimulationsAction,
  recordOneBetaCohortSimulationAction,
} from "@/app/admin/(dashboard)/beta-simulations/actions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  betaCohortSimulationTypes,
  type BetaCohortSimulationResult,
  type BetaCohortSimulationType,
} from "@/sms-engine/cohortSimulation/cohortTypes";
import {
  getBetaCohortSimulationAdminSnapshot,
  runAllBetaCohortSimulations,
  runBetaCohortSimulation,
} from "@/sms-engine/cohortSimulation/runCohortSimulation";

export const dynamic = "force-dynamic";

const buttonClass =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validCohortType(value?: string | null): BetaCohortSimulationType | null {
  if (!value) return null;
  return betaCohortSimulationTypes.includes(value as BetaCohortSimulationType)
    ? (value as BetaCohortSimulationType)
    : null;
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
      <p className="mt-2 break-words text-2xl font-semibold">
        {value === null ? "n/a" : String(value)}
      </p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {title}
      </p>
      <ul className="mt-2 space-y-1 text-sm text-zinc-400">
        {items.length > 0 ? (
          items.slice(0, 8).map((item) => <li key={item}>{item}</li>)
        ) : (
          <li>None.</li>
        )}
      </ul>
    </div>
  );
}

function ResultCard({ result }: { result: BetaCohortSimulationResult }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-black p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={result.cohortType} />
            <StatusBadge status={result.status} />
            <StatusBadge status={`RISK_${result.riskLevel.toUpperCase()}`} />
            <StatusBadge status="SIMULATION_ONLY" />
            <StatusBadge status="NO_SMS" />
          </div>
          <h3 className="mt-3 text-lg font-semibold">
            {result.cohortType.replaceAll("_", " ")}
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Generated {new Date(result.generatedAt).toLocaleString()} with fake
            cohort data only. Launch may remain blocked even when the simulation
            passes.
          </p>
        </div>
        <form action={recordOneBetaCohortSimulationAction}>
          <input type="hidden" name="cohortType" value={result.cohortType} />
          <button className={buttonClass}>Record run</button>
        </form>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Users" value={result.simulatedUserCount} />
        <StatCard label="Allowed" value={result.allowedCount} tone="safe" />
        <StatCard label="Waitlisted" value={result.waitlistedCount} tone="warn" />
        <StatCard label="Blocked" value={result.blockedCount} />
        <StatCard label="Escalated" value={result.escalatedCount} tone="warn" />
        <StatCard
          label="Avg score"
          value={`${result.averageScore}/14`}
          tone={result.averageScore >= 10 ? "safe" : "danger"}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <ListBlock title="Blockers" items={result.blockers} />
        <ListBlock title="Warnings" items={result.warnings} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Transcript summary
          </p>
          <dl className="mt-2 space-y-1 text-sm text-zinc-400">
            <div>Pass rate: {Math.round(result.transcriptPassRate * 100)}%</div>
            <div>Fallback rate: {Math.round(result.llmFallbackRate * 100)}%</div>
            <div>Forbidden claims: {result.forbiddenClaimsCount}</div>
            <div>Blocked sends simulated: {result.blockedSendCount}</div>
          </dl>
        </div>
      </div>

      <details className="mt-4 rounded-md border border-zinc-900 bg-zinc-950 p-3">
        <summary className="cursor-pointer text-sm font-medium text-zinc-200">
          Member result preview
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 pr-4">Member</th>
                <th className="py-2 pr-4">Persona</th>
                <th className="py-2 pr-4">Access</th>
                <th className="py-2 pr-4">Conversation</th>
                <th className="py-2 pr-4">Risk</th>
                <th className="py-2 pr-4">Score</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {result.memberResults.slice(0, 24).map((member) => (
                <tr key={member.memberId} className="border-t border-zinc-900">
                  <td className="py-2 pr-4">{member.memberId}</td>
                  <td className="py-2 pr-4">{member.personaType}</td>
                  <td className="py-2 pr-4">{member.accessStatus}</td>
                  <td className="py-2 pr-4">{member.conversationStatus}</td>
                  <td className="py-2 pr-4">{member.riskLevel}</td>
                  <td className="py-2 pr-4">{member.score}/14</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export default async function BetaSimulationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cohortParam = validCohortType(paramValue(params.cohort));
  const runParam = paramValue(params.run);
  const shouldRunAll = runParam === "all";
  const shouldRunOne = Boolean(cohortParam);
  const [snapshot, results] = await Promise.all([
    getBetaCohortSimulationAdminSnapshot(),
    shouldRunAll
      ? runAllBetaCohortSimulations()
      : shouldRunOne && cohortParam
        ? runBetaCohortSimulation(cohortParam).then((result) => [result])
        : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            Beta cohort simulation
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Cohort simulations</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            Simulates 10 design partners, 25 private-beta users, 100 capped
            public-beta users, over-capacity behavior, rollback, and incidents
            with fake data only. It cannot send SMS, invite users, publish the
            number, or touch production Saga data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/beta-simulations?run=all" className={buttonClass}>
            Run all now
          </Link>
          <form action={recordAllBetaCohortSimulationsAction}>
            <button className={buttonClass}>Record all runs</button>
          </form>
          <Link href="/admin/command-center" className={buttonClass}>
            Command center
          </Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Simulation risk"
          value={snapshot.simulationRiskLevel}
          tone={
            snapshot.simulationRiskLevel === "red"
              ? "danger"
              : snapshot.simulationRiskLevel === "yellow"
                ? "warn"
                : "safe"
          }
        />
        <StatCard
          label="Blocker count"
          value={snapshot.simulationBlockerCount}
          tone={snapshot.simulationBlockerCount ? "danger" : "safe"}
        />
        <StatCard
          label="Design partner simulation"
          value={snapshot.designPartnerSimulationReady}
          tone={snapshot.designPartnerSimulationReady ? "safe" : "warn"}
        />
        <StatCard
          label="Public beta simulation"
          value={snapshot.publicBetaSimulationReady}
          tone={snapshot.publicBetaSimulationReady ? "safe" : "warn"}
        />
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="DRY_RUN_ONLY" />
          <StatusBadge status="NO_SMS" />
          <StatusBadge status="NO_TWILIO_SEND_API" />
          <StatusBadge status="NO_REAL_USERS" />
          <StatusBadge status="PUBLIC_BETA_DISABLED" />
          <StatusBadge status="ACTIVE_LIVE_DISABLED" />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ListBlock title="Snapshot blockers" items={snapshot.blockers} />
          <ListBlock title="Snapshot warnings" items={snapshot.warnings} />
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <h3 className="text-sm font-semibold">Available simulations</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {betaCohortSimulationTypes.map((cohortType) => (
            <Link
              key={cohortType}
              href={`/admin/beta-simulations?cohort=${cohortType}`}
              className={buttonClass}
            >
              Run {cohortType.replaceAll("_", " ")}
            </Link>
          ))}
        </div>
      </section>

      {results.length > 0 ? (
        <div className="space-y-4">
          {results.map((result) => (
            <ResultCard key={result.cohortType} result={result} />
          ))}
        </div>
      ) : (
        <section className="rounded-lg border border-zinc-800 bg-black p-4">
          <p className="text-sm text-zinc-500">
            Choose a simulation to run, or use the current snapshot above for
            latest persisted/fresh status. No data leaves the standalone app.
          </p>
        </section>
      )}
    </div>
  );
}

