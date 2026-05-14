import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getDb } from "@/sms-engine/db";
import {
  getRecentAudit,
  getRuntimeSettingSnapshot,
} from "@/lib/webChatRuntimeSettings";
import { toggleAutonomousAction } from "@/app/(admin)/admin/(dashboard)/web-chat-sessions/actions";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatTimestamp(value: Date) {
  return dateFormatter.format(value);
}

function shortSessionId(sessionId: string) {
  return sessionId.slice(0, 8);
}

function toggleErrorMessage(value: string | undefined) {
  if (value === "env_ceiling") {
    return "The environment ceiling is off, so the runtime toggle cannot enable autonomous replies.";
  }
  if (value === "invalid_value") {
    return "The runtime toggle received an invalid value. Refresh and try again.";
  }
  return null;
}

function settingTone(enabled: boolean) {
  return enabled
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    : "border-amber-500/30 bg-amber-500/10 text-amber-200";
}

function shortActorId(value: string | null) {
  if (!value) {
    return "unknown";
  }

  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export default async function WebChatSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ toggle_error?: string }>;
}) {
  const [sessions, runtime, recentAudit, params] = await Promise.all([
    getDb().webSession.findMany({
      orderBy: { lastSeenAt: "desc" },
      take: 50,
      include: { _count: { select: { messages: true } } },
    }),
    getRuntimeSettingSnapshot(),
    getRecentAudit(),
    searchParams,
  ]);
  const toggleError = toggleErrorMessage(params.toggle_error);
  const nextValue = runtime.requestedAutonomousEnabled ? "false" : "true";
  const toggleLabel = runtime.requestedAutonomousEnabled
    ? "Switch to holding"
    : "Switch to autonomous";

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            Messages
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Web Chat Sessions</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Read-only view of the 50 most recent anonymous web chat sessions and
            their persisted message history.
          </p>
        </div>

        <section className="rounded-lg border border-zinc-800 bg-black p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${settingTone(runtime.effectiveAutonomousEnabled)}`}
                >
                  {runtime.effectiveAutonomousEnabled ? "AUTONOMOUS" : "HOLDING"}
                </span>
                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-zinc-300">
                  requested {runtime.requestedAutonomousEnabled ? "on" : "off"}
                </span>
              </div>
              <p className="max-w-3xl text-sm text-zinc-400">
                The environment flag remains a hard ceiling. If
                `WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED` is off, this UI cannot
                turn autonomous replies on until the server restarts with the
                ceiling enabled.
              </p>
              {toggleError ? (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  {toggleError}
                </p>
              ) : null}
            </div>

            <form action={toggleAutonomousAction} className="shrink-0">
              <input type="hidden" name="nextValue" value={nextValue} />
              <button
                type="submit"
                disabled={!runtime.envEnabled}
                title={
                  runtime.envEnabled
                    ? undefined
                    : "Restart with WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED=true before enabling autonomous replies."
                }
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500"
              >
                {toggleLabel}
              </button>
            </form>
          </div>

          <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
            <summary className="cursor-pointer text-sm font-medium text-zinc-200">
              Audit log
            </summary>
            <div className="mt-4 space-y-2 text-sm text-zinc-300">
              {recentAudit.length === 0 ? (
                <p className="text-zinc-500">No runtime flips recorded yet.</p>
              ) : (
                recentAudit.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-1 rounded-md border border-zinc-800 bg-black/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="font-mono text-xs text-zinc-400">
                      {formatTimestamp(entry.createdAt)}
                    </div>
                    <div className="text-sm text-zinc-200">
                      {entry.oldValue ? "autonomous" : "holding"} {"->"}{" "}
                      {entry.newValue ? "autonomous" : "holding"}
                    </div>
                    <div className="font-mono text-xs text-zinc-500">
                      actor {shortActorId(entry.actorAdminSessionId)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </details>
        </section>
      </div>

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Session</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Last seen</th>
              <th className="px-4 py-3 font-medium">Messages</th>
              <th className="px-4 py-3 font-medium">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {sessions.map((session) => (
              <tr key={session.id} className="hover:bg-zinc-950">
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-zinc-100">
                    {shortSessionId(session.id)}
                  </div>
                  <div className="mt-1 max-w-md truncate text-xs text-zinc-500">
                    {session.userAgent || "User agent not captured"}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                  {formatTimestamp(session.createdAt)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                  {formatTimestamp(session.lastSeenAt)}
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  {session._count.messages}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/web-chat-sessions/${session.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                    title="Open session"
                  >
                    <ArrowUpRight aria-hidden className="h-4 w-4" />
                    <span className="sr-only">Open session</span>
                  </Link>
                </td>
              </tr>
            ))}
            {sessions.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-zinc-500" colSpan={5}>
                  No web chat sessions yet. Use the internal test page to create
                  the first session.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
