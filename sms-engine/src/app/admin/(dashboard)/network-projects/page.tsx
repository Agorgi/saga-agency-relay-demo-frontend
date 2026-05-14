import Link from "next/link";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getDb } from "@/sms-engine/db";
import { createNetworkProjectAction } from "@/app/admin/(dashboard)/network-actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const labelClass = "block text-sm font-medium text-zinc-300";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

export default async function NetworkProjectsPage() {
  const projects = await getDb().project.findMany({
    include: {
      organizerPerson: true,
      roleOpenings: true,
      team: true,
      conversations: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Saga production network
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Network projects</h2>
      </div>

      <form action={createNetworkProjectAction} className="rounded-lg border border-zinc-800 bg-black p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create or import demo project</h3>
          <button className={buttonClass}>
            <Plus aria-hidden className="h-4 w-4" />
            Create
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className={labelClass}>
            Source
            <select name="source" defaultValue="IMPORT" className={inputClass}>
              <option value="IMPORT">Import</option>
              <option value="MOBILE_APP">Mobile app</option>
              <option value="WEB_APP">Web app</option>
              <option value="ADMIN">Admin</option>
              <option value="SMS">SMS</option>
            </select>
          </label>
          <label className={labelClass}>
            Existing Saga event ID
            <input name="existingSagaEventId" className={inputClass} />
          </label>
          <label className={labelClass}>
            Organizer phone
            <input name="organizerPhone" className={inputClass} />
          </label>
          <label className={labelClass}>
            Organizer name
            <input name="organizerName" className={inputClass} />
          </label>
          <label className={labelClass}>
            Title
            <input name="title" required className={inputClass} />
          </label>
          <label className={labelClass}>
            City
            <input name="city" className={inputClass} />
          </label>
          <label className={labelClass}>
            Target date
            <input name="targetDate" className={inputClass} />
          </label>
          <label className={labelClass}>
            Fandom/community
            <input name="fandoms" className={inputClass} />
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Description
            <textarea name="description" rows={3} className={inputClass} />
          </label>
          <label className={labelClass}>
            Budget
            <input name="budgetRange" className={inputClass} />
          </label>
          <label className={labelClass}>
            Audience
            <input name="audience" className={inputClass} />
          </label>
        </div>
      </form>

      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ops</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {projects.map((project) => (
              <tr key={project.id}>
                <td className="px-4 py-3">
                  <Link href={`/admin/network-projects/${project.id}`} className="font-medium text-zinc-100 hover:text-white">
                    {project.title || "Untitled project"}
                  </Link>
                  <p className="font-mono text-xs text-zinc-500">
                    {project.existingSagaEventId || project.id}
                  </p>
                </td>
                <td className="px-4 py-3"><StatusBadge status={project.source} /></td>
                <td className="px-4 py-3 text-zinc-400">{project.city || "Unknown"}</td>
                <td className="px-4 py-3"><StatusBadge status={project.status} /></td>
                <td className="px-4 py-3 text-zinc-400">
                  {project.roleOpenings.length} roles | {project.conversations.length} conversations
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {project.updatedAt.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
