import Link from "next/link";
import { Plus, Save } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getDb } from "@/sms-engine/db";
import {
  createOpportunityAction,
  updateRoleOpeningAction,
} from "@/app/admin/(dashboard)/network-actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const labelClass = "block text-sm font-medium text-zinc-300";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

export default async function RoleOpeningsPage() {
  const roles = await getDb().roleOpening.findMany({
    include: { project: true, opportunities: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Team needs
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Role openings</h2>
      </div>
      <section className="space-y-4">
        {roles.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-black p-4 text-sm text-zinc-500">
            No role openings yet. Create a project or run the full demo scenario
            to generate suggested production roles.
          </p>
        ) : null}
        {roles.map((role) => {
          const updateAction = updateRoleOpeningAction.bind(null, role.id);
          const createOpportunity = createOpportunityAction.bind(null, role.id);
          return (
            <div key={role.id} className="rounded-lg border border-zinc-800 bg-black p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{role.title}</h3>
                    <StatusBadge status={role.status} />
                    <StatusBadge status={role.compensationType} />
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    <Link href={`/admin/network-projects/${role.projectId}`} className="hover:text-white">
                      {role.project.title || "Untitled project"}
                    </Link>{" "}
                    | {role.project.city || "Unknown city"} | {role.opportunities.length} opportunities
                  </p>
                </div>
                <form action={createOpportunity}>
                  <button className={buttonClass}>
                    <Plus aria-hidden className="h-4 w-4" />
                    Opportunity
                  </button>
                </form>
              </div>
              <form action={updateAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className={labelClass}>Role type<input name="roleType" defaultValue={role.roleType} className={inputClass} /></label>
                <label className={labelClass}>Title<input name="title" defaultValue={role.title} className={inputClass} /></label>
                <label className={labelClass}>Status<select name="status" defaultValue={role.status} className={inputClass}>{["DRAFT", "OPEN", "RECOMMENDING", "OUTREACHING", "FILLED", "ARCHIVED"].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                <label className={labelClass}>Compensation<select name="compensationType" defaultValue={role.compensationType} className={inputClass}>{["UNKNOWN", "PAID", "VOLUNTEER", "COLLAB", "TRADE"].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                <label className={labelClass}>Required skills<input name="requiredSkills" defaultValue={role.requiredSkills.join(", ")} className={inputClass} /></label>
                <label className={labelClass}>Preferred fandoms<input name="preferredFandoms" defaultValue={role.preferredFandoms.join(", ")} className={inputClass} /></label>
                <label className={labelClass}>Location<input name="locationRequirement" defaultValue={role.locationRequirement || ""} className={inputClass} /></label>
                <label className={labelClass}>Remote<select name="remoteAllowed" defaultValue={String(role.remoteAllowed)} className={inputClass}><option value="false">No</option><option value="true">Yes</option></select></label>
                <label className={labelClass}>Budget<input name="budgetRange" defaultValue={role.budgetRange || ""} className={inputClass} /></label>
                <label className={labelClass}>Quantity<input name="quantityNeeded" type="number" min="1" defaultValue={role.quantityNeeded} className={inputClass} /></label>
                <label className={`${labelClass} md:col-span-2`}>Description<textarea name="description" rows={3} defaultValue={role.description || ""} className={inputClass} /></label>
                <div className="md:col-span-2 xl:col-span-4 flex justify-end">
                  <button className={buttonClass}><Save aria-hidden className="h-4 w-4" />Save role</button>
                </div>
              </form>
            </div>
          );
        })}
      </section>
    </div>
  );
}
