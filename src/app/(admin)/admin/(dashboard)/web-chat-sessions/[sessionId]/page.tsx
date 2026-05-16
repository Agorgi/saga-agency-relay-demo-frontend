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

function metadataValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(", ") || "none";
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return typeof value === "string" && value ? value : "none";
}

function validationStatus(value: string | null) {
  if (value === "openai_called_succeeded") {
    return "validated";
  }
  if (value === "openai_called_validation_failed") {
    return "validation_failed";
  }
  if (value === "openai_called_failed") {
    return "provider_failed";
  }
  return "not_called";
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
            {(() => {
              const latestAssistant = [...conversation.messages]
                .reverse()
                .find((message) => message.role === "assistant");

              if (!latestAssistant) {
                return null;
              }

              const nextStepRecord =
                latestAssistant.nextStep &&
                typeof latestAssistant.nextStep === "object" &&
                !Array.isArray(latestAssistant.nextStep)
                  ? (latestAssistant.nextStep as {
                      label?: unknown;
                      prefill?: Record<string, unknown>;
                    })
                  : null;

              return (
                <div className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Persona
                    </p>
                    <p className="mt-1 text-sm text-zinc-100">
                      {metadataValue(latestAssistant.persona)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Route
                    </p>
                    <p className="mt-1 text-sm text-zinc-100">
                      {metadataValue(latestAssistant.route)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Reply source
                    </p>
                    <p className="mt-1 text-sm text-zinc-100">
                      {metadataValue(latestAssistant.selectedReplySource)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Fallback reason
                    </p>
                    <p className="mt-1 text-sm text-zinc-100">
                      {metadataValue(latestAssistant.fallbackReason)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Provider state
                    </p>
                    <p className="mt-1 text-sm text-zinc-100">
                      {metadataValue(latestAssistant.providerState)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Model
                    </p>
                    <p className="mt-1 text-sm text-zinc-100">
                      {metadataValue(latestAssistant.model)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Configured mode
                    </p>
                    <p className="mt-1 text-sm text-zinc-100">
                      {metadataValue(latestAssistant.configuredMode)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Effective mode
                    </p>
                    <p className="mt-1 text-sm text-zinc-100">
                      {metadataValue(latestAssistant.effectiveMode)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Validation
                    </p>
                    <p className="mt-1 text-sm text-zinc-100">
                      {validationStatus(latestAssistant.providerState)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Next label
                    </p>
                    <p className="mt-1 text-sm text-zinc-100">
                      {metadataValue(nextStepRecord?.label ?? null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Prefill keys
                    </p>
                    <p className="mt-1 text-sm text-zinc-100">
                      {metadataValue(nextStepRecord?.prefill ? Object.keys(nextStepRecord.prefill) : [])}
                    </p>
                  </div>
                  <div className="md:col-span-2 xl:col-span-4">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Next step
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap break-words rounded-md border border-zinc-800 bg-black/50 p-3 text-xs leading-relaxed text-zinc-300">
                      {metadataValue(latestAssistant.nextStep)}
                    </pre>
                  </div>
                  <div className="md:col-span-2 xl:col-span-4">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Handoff telemetry
                    </p>
                    <p className="mt-2 rounded-md border border-zinc-800 bg-black/50 p-3 text-xs leading-relaxed text-zinc-400">
                      CTA click and prefill hydration are client-side Sagasan telemetry events in this pass. They are available in the live browser session, but not persisted in the legacy production web-chat schema yet.
                    </p>
                  </div>
                  <div className="md:col-span-2 xl:col-span-4">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Extracted fields
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap break-words rounded-md border border-zinc-800 bg-black/50 p-3 text-xs leading-relaxed text-zinc-300">
                      {metadataValue(latestAssistant.extractedFields)}
                    </pre>
                  </div>
                </div>
              );
            })()}

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
