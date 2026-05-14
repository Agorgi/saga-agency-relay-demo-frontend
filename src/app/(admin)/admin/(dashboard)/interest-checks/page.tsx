import { Plus, TrendingUp } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getDb } from "@/sms-engine/db";
import {
  addInterestAction,
  convertInterestCheckAction,
  createInterestCheckAction,
} from "@/app/(admin)/admin/(dashboard)/network-actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const labelClass = "block text-sm font-medium text-zinc-300";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

export default async function InterestChecksPage() {
  const checks = await getDb().interestCheck.findMany({
    include: { creatorPerson: true, convertedProject: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Demand before production
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Interest checks</h2>
      </div>
      <form action={createInterestCheckAction} className="rounded-lg border border-zinc-800 bg-black p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Create interest check</h3>
          <button className={buttonClass}><Plus aria-hidden className="h-4 w-4" />Create</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className={labelClass}>Creator phone<input name="creatorPhone" className={inputClass} /></label>
          <label className={labelClass}>Title<input name="title" required className={inputClass} /></label>
          <label className={labelClass}>City<input name="city" className={inputClass} /></label>
          <label className={labelClass}>Fandoms<input name="fandoms" className={inputClass} /></label>
          <label className={labelClass}>Timing<input name="proposedTiming" className={inputClass} /></label>
          <label className={labelClass}>Threshold<input name="thresholdValue" type="number" min="1" defaultValue="10" className={inputClass} /></label>
          <label className={`${labelClass} md:col-span-2`}>Description<textarea name="description" rows={3} className={inputClass} /></label>
        </div>
      </form>

      <section className="grid gap-4 xl:grid-cols-2">
        {checks.map((check) => {
          const addInterest = addInterestAction.bind(null, check.id);
          const convert = convertInterestCheckAction.bind(null, check.id);
          return (
            <div key={check.id} className="rounded-lg border border-zinc-800 bg-black p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{check.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {check.city || "Unknown city"} | {check.fandoms.join(", ") || "No fandoms"}
                  </p>
                </div>
                <StatusBadge status={check.status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{check.description}</p>
              <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
                {check.currentInterestCount} interested / threshold {check.thresholdValue || "admin"}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <form action={addInterest}>
                  <button className={buttonClass}><TrendingUp aria-hidden className="h-4 w-4" />Add interest</button>
                </form>
                <form action={convert}>
                  <button className={buttonClass} disabled={check.status === "CONVERTED_TO_PROJECT"}>
                    Convert to project
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
