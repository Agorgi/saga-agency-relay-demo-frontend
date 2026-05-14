import Link from "next/link";
import { Save, Send } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { redactPhoneForDisplay } from "@/lib/adminPrivacy";
import { getDb } from "@/lib/db";
import { briefTitle } from "@/lib/workflow";
import {
  approveSingleOutreachAction,
  updateOutreachAction,
} from "@/app/admin/(dashboard)/actions";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

export default async function OutreachPage() {
  const outreaches = await getDb().outreach.findMany({
    include: {
      contact: true,
      projectBrief: {
        include: { user: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Human approved
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Outreach</h2>
      </div>

      <section className="space-y-4">
        {outreaches.map((outreach) => {
          const updateAction = updateOutreachAction.bind(null, outreach.id);
          const approveAction = approveSingleOutreachAction.bind(
            null,
            outreach.id,
          );

          return (
            <div
              key={outreach.id}
              className="rounded-lg border border-zinc-800 bg-black p-4"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">
                      {outreach.contact.name}
                    </h3>
                    <StatusBadge status={outreach.status} />
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">
                    <Link
                      href={`/admin/projects/${outreach.projectBriefId}`}
                      className="hover:text-white"
                    >
                      {briefTitle(outreach.projectBrief)}
                    </Link>{" "}
                    | {redactPhoneForDisplay(outreach.contact.phone)}
                  </p>
                </div>
                <form action={approveAction}>
                  <button
                    disabled={outreach.status !== "DRAFTED"}
                    className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <Send aria-hidden className="h-4 w-4" />
                    Approve/send
                  </button>
                </form>
              </div>
              <form action={updateAction} className="space-y-4">
                <label className="block text-sm font-medium text-zinc-300">
                  Drafted message
                  <textarea
                    name="draftedMessage"
                    rows={5}
                    defaultValue={outreach.draftedMessage}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm font-medium text-zinc-300">
                  Last response
                  <textarea
                    name="lastResponse"
                    rows={2}
                    defaultValue={outreach.lastResponse || ""}
                    className={inputClass}
                  />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                  <span>
                    Admin approved: {outreach.adminApproved ? "yes" : "no"} |
                    Consent: {outreach.consentToGroupChat ? "yes" : "no"}
                  </span>
                  <button className={buttonClass}>
                    <Save aria-hidden className="h-4 w-4" />
                    Save draft
                  </button>
                </div>
              </form>
            </div>
          );
        })}
        {outreaches.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
            No outreach drafted yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}
