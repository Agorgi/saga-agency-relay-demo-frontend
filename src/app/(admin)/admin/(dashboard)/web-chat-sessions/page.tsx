import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getDb } from "@/sms-engine/db";

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

export default async function WebChatSessionsPage() {
  const sessions = await getDb().webSession.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: 50,
    include: { _count: { select: { messages: true } } },
  });

  return (
    <div className="space-y-6">
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
