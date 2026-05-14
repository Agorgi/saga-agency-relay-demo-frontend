import Link from "next/link";
import {
  admitPublicBetaWaitlistEntryAction,
  evaluateCappedPublicBetaReadinessAction,
  evaluatePublicBetaAdmissionAction,
  recordPublicBetaWaitlistConsentAction,
  updatePublicBetaWaitlistStatusAction,
} from "@/app/admin/(dashboard)/actions";
import { evaluateCappedPublicBetaReadiness } from "@/lib/publicBeta/publicBetaAdmission";
import {
  getPublicBetaAdminSnapshot,
  publicBetaUseCaseOptions,
  publicBetaWaitlistStatusOptions,
} from "@/lib/publicBeta/publicBetaWaitlist";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const buttonClass =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

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

function ChipList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  return (
    <ul className="space-y-2 text-sm text-zinc-300">
      {items.map((item) => (
        <li key={item} className="rounded-md border border-zinc-900 bg-zinc-950 p-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

function safeJson(value: unknown) {
  return JSON.stringify(value || {}, null, 2);
}

export default async function PublicBetaPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    desiredUseCase?: string;
    city?: string;
  }>;
}) {
  const params = await searchParams;
  const [snapshot, readiness] = await Promise.all([
    getPublicBetaAdminSnapshot(params),
    evaluateCappedPublicBetaReadiness(),
  ]);
  const config = snapshot.config;
  const health = snapshot.health;
  const capUsage =
    health.publicBetaAdmittedCount === null
      ? null
      : `${health.publicBetaAdmittedCount}/${config.publicBetaMaxActiveParticipants}`;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Capped public beta
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Public Beta Infrastructure</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Manage future capped public-beta waitlist, consent, capacity, and
          admission review. This page cannot send SMS, publish the number, flip
          env vars, or enable public launch.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          "PUBLIC BETA DISABLED BY DEFAULT",
          "NO SMS SEND CONTROLS",
          "PUBLIC NUMBER HIDDEN UNLESS EXPLICITLY ENABLED",
          "STANDALONE APP ONLY",
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
        <StatCard
          label="Public beta enabled"
          value={config.publicBetaEnabled}
          tone={config.publicBetaEnabled ? "warn" : "safe"}
        />
        <StatCard
          label="Landing enabled"
          value={config.publicBetaLandingEnabled}
          tone={config.publicBetaLandingEnabled ? "warn" : "safe"}
        />
        <StatCard
          label="Waitlist enabled"
          value={config.publicBetaWaitlistEnabled}
          tone={config.publicBetaWaitlistEnabled ? "warn" : "safe"}
        />
        <StatCard
          label="Public number visible"
          value={config.publicBetaPublicNumberVisible}
          tone={config.publicBetaPublicNumberVisible ? "danger" : "safe"}
        />
        <StatCard label="Waitlist entries" value={health.publicBetaWaitlistCount} />
        <StatCard label="Admitted/cap" value={capUsage} />
        <StatCard label="Daily new-user cap" value={config.publicBetaNewUserDailyCap} />
        <StatCard
          label="Public beta ready"
          value={readiness.publicBetaReady}
          tone={readiness.publicBetaReady ? "safe" : "warn"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-black p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Readiness blockers</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Current state is expected to be blocked until A2P, sends, caps,
                support/policy, drill, and observability gates are intentionally reviewed.
              </p>
            </div>
            <form action={evaluateCappedPublicBetaReadinessAction}>
              <button className={buttonClass}>Record readiness check</button>
            </form>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.14em] text-red-200">
                Blockers
              </p>
              <ChipList items={readiness.blockers} empty="No blockers." />
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                Warnings
              </p>
              <ChipList items={readiness.warnings} empty="No warnings." />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-black p-4">
          <h3 className="text-sm font-semibold">Support and policy gates</h3>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Support email configured", config.supportEmailConfigured],
              ["Privacy URL configured", config.privacyUrlConfigured],
              ["Terms URL configured", config.termsUrlConfigured],
              ["Require invite code", config.publicBetaRequireInviteCode],
              ["Require consent", config.publicBetaRequireConsent],
              ["SMS compliance approved", config.smsComplianceApproved],
              ["SMS sends disabled", config.smsSendsDisabled],
              ["Public launch enabled", config.publicLaunchEnabled],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md border border-zinc-900 bg-zinc-950 p-3">
                <dt className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  {label}
                </dt>
                <dd className="mt-1 text-zinc-200">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">Waitlist filters</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Email and phone values stay redacted. Filtering does not send messages.
            </p>
          </div>
          <Link className={buttonClass} href="/admin/access">
            Manage invite codes
          </Link>
        </div>
        <form className="mt-4 grid gap-4 md:grid-cols-4">
          <label className="text-sm font-medium text-zinc-300">
            Status
            <select name="status" className={inputClass} defaultValue={params.status || ""}>
              <option value="">Any</option>
              {publicBetaWaitlistStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-300">
            Use case
            <select
              name="desiredUseCase"
              className={inputClass}
              defaultValue={params.desiredUseCase || ""}
            >
              <option value="">Any</option>
              {publicBetaUseCaseOptions.map((useCase) => (
                <option key={useCase} value={useCase}>
                  {useCase.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-300">
            City
            <input name="city" className={inputClass} defaultValue={params.city || ""} />
          </label>
          <div className="flex items-end">
            <button className={buttonClass}>Apply filters</button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold">Waitlist entries</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Admission evaluation is dry-run safe. Admit action remains blocked
            until the public-beta admission service says the entry is admissible.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-[0.14em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Entry</th>
                <th className="px-4 py-3 text-left">Use case</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Consent</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {snapshot.entries.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="text-zinc-200">{entry.name || entry.id}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {entry.email || "[no email]"} · {entry.redactedPhone || "[no phone]"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {entry.city || "no city"} · {entry.source || "unknown source"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{entry.desiredUseCase}</td>
                  <td className="px-4 py-3 text-zinc-400">{entry.status}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {String(entry.consentCaptured)}
                    {entry.consentCapturedAt ? (
                      <span className="block text-xs text-zinc-500">
                        {entry.consentCapturedAt.toISOString()}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {entry.createdAt.toISOString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-3">
                      <form
                        action={updatePublicBetaWaitlistStatusAction.bind(null, entry.id)}
                        className="space-y-2"
                      >
                        <select name="status" className={inputClass} defaultValue={entry.status}>
                          {publicBetaWaitlistStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                        <textarea
                          name="notes"
                          rows={2}
                          className={inputClass}
                          placeholder="Optional admin note"
                        />
                        <button className={buttonClass}>Update</button>
                      </form>
                      <div className="flex flex-wrap gap-2">
                        <form action={evaluatePublicBetaAdmissionAction.bind(null, entry.id)}>
                          <button className={buttonClass}>Evaluate admission</button>
                        </form>
                        {!entry.consentCaptured ? (
                          <form action={recordPublicBetaWaitlistConsentAction.bind(null, entry.id)}>
                            <button className={buttonClass}>Record consent</button>
                          </form>
                        ) : null}
                        <form action={admitPublicBetaWaitlistEntryAction.bind(null, entry.id)}>
                          <button className={buttonClass}>Admit if eligible</button>
                        </form>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {snapshot.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-sm text-zinc-500">
                    No public beta waitlist entries match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold">Recent public beta audit events</h3>
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
              {snapshot.recentEvents.map((event) => (
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
              {snapshot.recentEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">
                    No public beta audit events yet.
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
