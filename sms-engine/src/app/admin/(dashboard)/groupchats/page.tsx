import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { Bell } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MessageThread } from "@/components/admin/MessageThread";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { redactPhoneForDisplay } from "@/lib/adminPrivacy";
import { getDb } from "@/lib/db";
import { briefTitle } from "@/lib/workflow";
import { sendTaskReminderAction } from "@/app/admin/(dashboard)/actions";

export const dynamic = "force-dynamic";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

function jsonObject(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export default async function GroupChatsPage() {
  const db = getDb();
  const groupChats = await db.groupChat.findMany({
    include: {
      projectBrief: {
        include: { user: true },
      },
      participants: true,
      tasks: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  const projectIds = groupChats.map((groupChat) => groupChat.projectBriefId);
  const messages = await db.message.findMany({
    where: {
      projectBriefId: { in: projectIds },
      channel: "GROUP_SMS",
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Pre-production"
        title="Group Chats"
        description="Review group-chat planning records and task state."
        helpText="This page does not create group chats automatically. Use Command Center first if you are unsure."
      />

      <section className="space-y-6">
        {groupChats.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-black p-4 text-sm text-zinc-500">
            No group chat records yet. Approved and consented coordination
            plans will appear here before any future chat workflow.
          </p>
        ) : null}
        {groupChats.map((groupChat) => {
          const groupMessages = messages.filter((message) => {
            const metadata = jsonObject(message.metadata);
            return (
              metadata.groupChatId === groupChat.id ||
              metadata.conversationSid === groupChat.twilioConversationSid
            );
          });
          const kickoff = groupMessages.find(
            (message) => message.direction === "OUTBOUND",
          );

          return (
            <article
              key={groupChat.id}
              className="rounded-lg border border-zinc-800 bg-black p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold">
                      <Link
                        href={`/admin/projects/${groupChat.projectBriefId}`}
                        className="hover:text-white"
                      >
                        {briefTitle(groupChat.projectBrief)}
                      </Link>
                    </h3>
                    <StatusBadge status={groupChat.status} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    {groupChat.twilioConversationSid || "No Conversation SID"}
                  </p>
                </div>
                <span className="font-mono text-xs text-zinc-500">
                  {groupChat.participants.length} participants
                </span>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-300">
                      Participants
                    </h4>
                    <div className="mt-2 space-y-2">
                      {groupChat.participants.map((participant) => (
                        <div
                          key={participant.id}
                          className="rounded-md border border-zinc-800 p-3"
                        >
                          <div className="flex justify-between gap-3">
                            <p className="text-sm font-medium">
                              {participant.role}
                            </p>
                            <span className="text-xs text-zinc-500">
                              {participant.consentConfirmed ? "consented" : "pending"}
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-xs text-zinc-500">
                            {redactPhoneForDisplay(participant.phone)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-zinc-300">
                      Tasks
                    </h4>
                    <div className="mt-2 space-y-2">
                      {groupChat.tasks.map((task) => {
                        const reminderAction = sendTaskReminderAction.bind(
                          null,
                          task.id,
                        );
                        return (
                          <div
                            key={task.id}
                            className="rounded-md border border-zinc-800 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">
                                  {task.title}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {task.ownerName || "Unassigned"} |{" "}
                                  {task.dueDate
                                    ? task.dueDate.toLocaleDateString()
                                    : "No due date"}
                                </p>
                              </div>
                              <StatusBadge status={task.status} />
                            </div>
                            {task.dueDate ? (
                              <form action={reminderAction} className="mt-3">
                                <button className={buttonClass}>
                                  <Bell aria-hidden className="h-4 w-4" />
                                  Remind
                                </button>
                              </form>
                            ) : null}
                          </div>
                        );
                      })}
                      {groupChat.tasks.length === 0 ? (
                        <p className="text-sm text-zinc-500">
                          No tasks detected yet.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-300">
                      Kickoff message
                    </h4>
                    <p className="mt-2 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm leading-6 text-zinc-300">
                      {kickoff?.body || "No kickoff message saved yet."}
                    </p>
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-zinc-300">
                      Recent messages
                    </h4>
                    <MessageThread messages={groupMessages.slice(-8)} />
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        {groupChats.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
            No group chats yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}
