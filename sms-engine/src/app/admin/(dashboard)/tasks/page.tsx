import Link from "next/link";
import { Bell, Plus, Save, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getDb } from "@/lib/db";
import { briefTitle } from "@/lib/workflow";
import {
  createTaskAction,
  deleteTaskAction,
  sendTaskReminderAction,
  updateTaskAction,
} from "@/app/admin/(dashboard)/actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const labelClass = "block text-sm font-medium text-zinc-300";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

function dateInput(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function taskProjectLabel(task: {
  projectBrief: { title: string | null; projectType: string | null } | null;
  project: { title: string | null; existingSagaEventId: string | null } | null;
}) {
  if (task.projectBrief) return briefTitle(task.projectBrief);
  return task.project?.title || task.project?.existingSagaEventId || "Network project";
}

export default async function TasksPage() {
  const db = getDb();
  const [
    tasks,
    projects,
    networkProjects,
    productionConversations,
    groupChats,
  ] = await Promise.all([
    db.task.findMany({
      include: {
        projectBrief: true,
        project: true,
        groupChat: true,
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
    }),
    db.projectBrief.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.project.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.productionConversation.findMany({
      include: { project: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.groupChat.findMany({
      include: { projectBrief: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Follow-through
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Tasks</h2>
      </div>

      <form
        action={createTaskAction}
        className="rounded-lg border border-zinc-800 bg-black p-4"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create task</h3>
          <button className={buttonClass}>
            <Plus aria-hidden className="h-4 w-4" />
            Create
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className={labelClass}>
            SMS project brief
            <select name="projectBriefId" className={inputClass}>
              <option value="">None</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {briefTitle(project)}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Network project
            <select name="projectId" className={inputClass}>
              <option value="">None</option>
              {networkProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title || project.existingSagaEventId || project.id}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Group chat
            <select name="groupChatId" className={inputClass}>
              <option value="">None</option>
              {groupChats.map((groupChat) => (
                <option key={groupChat.id} value={groupChat.id}>
                  {briefTitle(groupChat.projectBrief)}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Production conversation
            <select name="productionConversationId" className={inputClass}>
              <option value="">None</option>
              {productionConversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {conversation.project.title || conversation.id}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Title
            <input name="title" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Status
            <select name="status" defaultValue="TODO" className={inputClass}>
              <option value="TODO">TODO</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="DONE">DONE</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
          </label>
          <label className={labelClass}>
            Owner
            <input name="ownerName" className={inputClass} />
          </label>
          <label className={labelClass}>
            Owner phone
            <input name="ownerPhone" className={inputClass} />
          </label>
          <label className={labelClass}>
            Due date
            <input name="dueDate" type="date" className={inputClass} />
          </label>
          <label className={labelClass}>
            Description
            <input name="description" className={inputClass} />
          </label>
        </div>
      </form>

      <section className="space-y-4">
        {tasks.map((task) => {
          const updateAction = updateTaskAction.bind(null, task.id);
          const deleteAction = deleteTaskAction.bind(null, task.id);
          const reminderAction = sendTaskReminderAction.bind(null, task.id);

          return (
            <div
              key={task.id}
              className="rounded-lg border border-zinc-800 bg-black p-4"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{task.title}</h3>
                    <StatusBadge status={task.status} />
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {task.projectBriefId ? (
                      <Link
                        href={`/admin/projects/${task.projectBriefId}`}
                        className="hover:text-zinc-200"
                      >
                        {taskProjectLabel(task)}
                      </Link>
                    ) : task.projectId ? (
                      <Link
                        href={`/admin/network-projects/${task.projectId}`}
                        className="hover:text-zinc-200"
                      >
                        {taskProjectLabel(task)}
                      </Link>
                    ) : (
                      taskProjectLabel(task)
                    )}
                    {task.groupChat ? " | group chat task" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {task.dueDate ? (
                    <form action={reminderAction}>
                      <button className={buttonClass}>
                        <Bell aria-hidden className="h-4 w-4" />
                        Remind
                      </button>
                    </form>
                  ) : null}
                  <form action={deleteAction}>
                    <button className={buttonClass}>
                      <Trash2 aria-hidden className="h-4 w-4" />
                      Delete
                    </button>
                  </form>
                </div>
              </div>
              <form action={updateAction}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className={labelClass}>
                    Group chat
                    <select
                      name="groupChatId"
                      defaultValue={task.groupChatId || ""}
                      className={inputClass}
                    >
                      <option value="">None</option>
                      {groupChats.map((groupChat) => (
                        <option key={groupChat.id} value={groupChat.id}>
                          {briefTitle(groupChat.projectBrief)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Production conversation
                    <select
                      name="productionConversationId"
                      defaultValue={task.productionConversationId || ""}
                      className={inputClass}
                    >
                      <option value="">None</option>
                      {productionConversations.map((conversation) => (
                        <option key={conversation.id} value={conversation.id}>
                          {conversation.project.title || conversation.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Title
                    <input
                      name="title"
                      defaultValue={task.title}
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Status
                    <select
                      name="status"
                      defaultValue={task.status}
                      className={inputClass}
                    >
                      <option value="TODO">TODO</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="DONE">DONE</option>
                      <option value="BLOCKED">BLOCKED</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    Due date
                    <input
                      name="dueDate"
                      type="date"
                      defaultValue={dateInput(task.dueDate)}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Owner
                    <input
                      name="ownerName"
                      defaultValue={task.ownerName || ""}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Owner phone
                    <input
                      name="ownerPhone"
                      type="password"
                      autoComplete="off"
                      defaultValue={task.ownerPhone || ""}
                      className={inputClass}
                    />
                  </label>
                  <label className={`${labelClass} md:col-span-2`}>
                    Description
                    <input
                      name="description"
                      defaultValue={task.description || ""}
                      className={inputClass}
                    />
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <button className={buttonClass}>
                    <Save aria-hidden className="h-4 w-4" />
                    Save task
                  </button>
                </div>
              </form>
            </div>
          );
        })}
        {tasks.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
            No tasks yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}
