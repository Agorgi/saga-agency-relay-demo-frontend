import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getDb } from "@/sms-engine/db";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatTimestamp(value: Date) {
  return dateFormatter.format(value);
}

function modeTone(mode: string | null) {
  if (mode === "autonomous") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (mode === "holding") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

export default async function WebChatSessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getDb().webSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        orderBy: [
          { conversationId: "asc" },
          { turn: "asc" },
          { createdAt: "asc" },
          { id: "asc" },
        ],
      },
    },
  });

  if (!session) {
    notFound();
  }

  const groupedConversations = session.messages.reduce<
    Array<{
      conversationId: string;
      messages: typeof session.messages;
    }>
  >((groups, message) => {
    const existing = groups.at(-1);
    if (existing && existing.conversationId === message.conversationId) {
      existing.messages.push(message);
      return groups;
    }

    groups.push({
      conversationId: message.conversationId,
      messages: [message],
    });
    return groups;
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link
          href="/admin/web-chat-sessions"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
          Back to sessions
        </Link>

        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            Messages
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Session {session.id}</h2>
          <div className="mt-3 grid gap-3 text-sm text-zinc-400 sm:grid-cols-3">
            <p>
              <span className="block text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                Created
              </span>
              {formatTimestamp(session.createdAt)}
            </p>
            <p>
              <span className="block text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                Last seen
              </span>
              {formatTimestamp(session.lastSeenAt)}
            </p>
            <p>
              <span className="block text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                Messages
              </span>
              {session.messages.length}
            </p>
          </div>
        </div>
      </div>

      {groupedConversations.length === 0 ? (
        <section className="rounded-lg border border-zinc-800 bg-black p-6 text-sm text-zinc-500">
          No messages recorded for this session yet.
        </section>
      ) : (
        groupedConversations.map((conversation) => (
          <section
            key={conversation.conversationId}
            className="space-y-4 rounded-lg border border-zinc-800 bg-black p-5"
          >
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
                Conversation
              </p>
              <h3 className="mt-2 font-mono text-sm text-zinc-100">
                {conversation.conversationId}
              </h3>
            </div>

            <div className="space-y-3">
              {conversation.messages.map((message) => (
                <article
                  key={message.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <span className="rounded-full border border-zinc-700 px-2 py-1 font-medium uppercase tracking-[0.12em] text-zinc-200">
                      {message.role}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500">
                      turn {message.turn}
                    </span>
                    {message.mode ? (
                      <span
                        className={`rounded-full border px-2 py-1 font-medium uppercase tracking-[0.12em] ${modeTone(message.mode)}`}
                      >
                        {message.mode}
                      </span>
                    ) : null}
                    <span className="font-mono text-[11px] text-zinc-500">
                      {formatTimestamp(message.createdAt)}
                    </span>
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-zinc-100">
                    {message.content}
                  </pre>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
