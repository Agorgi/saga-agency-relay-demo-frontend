import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { redactPhoneForDisplay } from "@/sms-engine/adminPrivacy";
import { getDb } from "@/sms-engine/db";
import { briefTitle } from "@/sms-engine/workflow";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await getDb().projectBrief.findMany({
    include: {
      user: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Intake
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Projects</h2>
      </div>
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-zinc-950">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-100">
                    {briefTitle(project)}
                  </div>
                  <div className="mt-1 max-w-md truncate text-xs text-zinc-500">
                    {project.description || "No concept captured yet."}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                  {redactPhoneForDisplay(project.user.phone)}
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  {project.city || "-"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={project.status} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {project.createdAt.toLocaleDateString()}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {project.updatedAt.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                    title="Open project"
                  >
                    <ArrowUpRight aria-hidden className="h-4 w-4" />
                    <span className="sr-only">Open project</span>
                  </Link>
                </td>
              </tr>
            ))}
            {projects.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-zinc-500" colSpan={7}>
                  No projects yet. Text the Saga number to create the first one.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
