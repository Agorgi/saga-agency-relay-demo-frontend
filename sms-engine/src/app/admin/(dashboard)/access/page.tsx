import {
  createBetaInviteCodeAction,
  pauseBetaInviteCodeAction,
  updateBetaParticipantStatusAction,
} from "@/app/admin/(dashboard)/actions";
import { getPublicBetaAccessAdminSnapshot } from "@/sms-engine/access/accessControl";
import {
  PILOT_COHORTS,
  pilotParticipantStatusOptions,
} from "@/sms-engine/pilotReadiness";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const labelClass = "block text-sm font-medium text-zinc-300";
const buttonClass =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

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

function safeJson(value: unknown) {
  if (!value) return "{}";
  return JSON.stringify(value, null, 2);
}

export default async function AccessPage() {
  const snapshot = await getPublicBetaAccessAdminSnapshot();
  const health = snapshot.health;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Public beta access
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Access control</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Manage invite-only and future capped public-beta access for the
          standalone SMS producer app. This page has no public-launch button and
          no SMS send controls.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pilot stage" value={health.pilotStage} />
        <StatCard label="Access mode" value={health.accessModeEffective} />
        <StatCard
          label="Public beta enabled"
          value={health.publicBetaEnabled}
          tone={health.publicBetaEnabled ? "warn" : "safe"}
        />
        <StatCard
          label="Public launch enabled"
          value={health.publicLaunchEnabled}
          tone={health.publicLaunchEnabled ? "warn" : "safe"}
        />
        <StatCard label="Active participants" value={health.currentActiveParticipants} />
        <StatCard label="Waitlisted" value={health.waitlistedParticipantCount} />
        <StatCard label="Max active cap" value={health.maxActiveParticipants} />
        <StatCard label="Invite codes" value={health.inviteCodeCount} />
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <h3 className="text-sm font-semibold">Create invite code</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Codes are stored as hashes. The plaintext value is admin-only and is
          not displayed again after submission.
        </p>
        <form action={createBetaInviteCodeAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Plaintext code
            <input name="code" className={inputClass} placeholder="SAGA-BETA-001" />
          </label>
          <label className={labelClass}>
            Label
            <input name="label" className={inputClass} placeholder="Design partner batch 1" />
          </label>
          <label className={labelClass}>
            Cohort
            <select name="cohort" className={inputClass} defaultValue="design_partner">
              {PILOT_COHORTS.map((cohort) => (
                <option key={cohort} value={cohort}>
                  {cohort.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Max uses
            <input name="maxUses" className={inputClass} type="number" min={1} defaultValue={1} />
          </label>
          <label className={labelClass}>
            Expires at
            <input name="expiresAt" className={inputClass} type="datetime-local" />
          </label>
          <div className="flex items-end">
            <button className={buttonClass}>Create hashed code</button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold">Invite codes</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Plaintext codes are never shown in this list.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-950 text-xs uppercase tracking-[0.14em] text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-left">Cohort</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Uses</th>
                <th className="px-4 py-3 text-left">Expires</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {snapshot.inviteCodes.map((code) => (
                <tr key={code.id}>
                  <td className="px-4 py-3 text-zinc-200">{code.label || code.id}</td>
                  <td className="px-4 py-3 text-zinc-400">{code.cohort}</td>
                  <td className="px-4 py-3 text-zinc-400">{code.status}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {code.uses}/{code.maxUses}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {code.expiresAt ? code.expiresAt.toISOString() : "none"}
                  </td>
                  <td className="px-4 py-3">
                    {code.status === "ACTIVE" ? (
                      <form action={pauseBetaInviteCodeAction.bind(null, code.id)}>
                        <button className={buttonClass}>Pause</button>
                      </form>
                    ) : (
                      <span className="text-xs text-zinc-500">No action</span>
                    )}
                  </td>
                </tr>
              ))}
              {snapshot.inviteCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-sm text-zinc-500">
                    No invite codes created yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold">Participants</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Phone display is redacted. Paused, waitlisted, rejected, and opted-out
            participants do not get normal access.
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
                <th className="px-4 py-3 text-left">Last active</th>
                <th className="px-4 py-3 text-left">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {snapshot.participants.map((participant) => (
                <tr key={participant.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="text-zinc-200">
                      {participant.name || participant.redactedPhone || participant.id}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {participant.redactedPhone || "[no phone]"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{participant.cohort}</td>
                  <td className="px-4 py-3 text-zinc-400">{participant.role}</td>
                  <td className="px-4 py-3 text-zinc-400">{participant.status}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {participant.lastActiveAt
                      ? participant.lastActiveAt.toISOString()
                      : "none"}
                  </td>
                  <td className="px-4 py-3">
                    <form
                      action={updateBetaParticipantStatusAction.bind(
                        null,
                        participant.id,
                      )}
                      className="space-y-2"
                    >
                      <select
                        name="status"
                        className={inputClass}
                        defaultValue={participant.status}
                      >
                        {pilotParticipantStatusOptions.map((status) => (
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
                      <button className={buttonClass}>Update status</button>
                    </form>
                  </td>
                </tr>
              ))}
              {snapshot.participants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-sm text-zinc-500">
                    No participants captured yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold">Recent access decisions</h3>
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
              {snapshot.recentAccessEvents.map((event) => (
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
              {snapshot.recentAccessEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">
                    No access events yet.
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
