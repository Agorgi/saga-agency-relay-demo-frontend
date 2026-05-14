import { clsx } from "clsx";

const toneByStatus: Record<string, string> = {
  NEEDS_ADMIN: "border-red-800 bg-red-950 text-red-200",
  BRIEF_READY_FOR_REVIEW: "border-amber-700 bg-amber-950 text-amber-100",
  SHORTLIST_READY: "border-amber-700 bg-amber-950 text-amber-100",
  GROUPCHAT_ACTIVE: "border-emerald-800 bg-emerald-950 text-emerald-100",
  ACTIVE: "border-emerald-800 bg-emerald-950 text-emerald-100",
  DONE: "border-emerald-800 bg-emerald-950 text-emerald-100",
  BLOCKED: "border-red-800 bg-red-950 text-red-200",
  DRAFTED: "border-zinc-700 bg-zinc-900 text-zinc-200",
  SENT: "border-sky-800 bg-sky-950 text-sky-100",
  INTERESTED: "border-emerald-800 bg-emerald-950 text-emerald-100",
  APPROVED_FOR_GROUPCHAT: "border-emerald-800 bg-emerald-950 text-emerald-100",
  NOT_INTERESTED: "border-zinc-700 bg-zinc-900 text-zinc-400",
  MAYBE: "border-amber-700 bg-amber-950 text-amber-100",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-md border px-2 py-1 font-mono text-[11px] font-medium uppercase leading-none",
        toneByStatus[status] || "border-zinc-800 bg-zinc-950 text-zinc-300",
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
