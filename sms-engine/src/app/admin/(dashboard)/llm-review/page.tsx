import Link from "next/link";
import { updateLlmReviewItemAction } from "@/app/admin/(dashboard)/llm-review/actions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getDb } from "@/sms-engine/db";
import {
  LLM_REVIEW_STATUSES,
  safeLlmReviewItemForDisplay,
} from "@/sms-engine/llm/qualityReview";
import { briefTitle } from "@/sms-engine/workflow";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-zinc-500";
const labelClass = "block text-sm font-medium text-zinc-300";
const buttonClass =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

function metadataText(value: unknown) {
  if (Array.isArray(value)) return value.join(", ") || "none";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value ? value : "none";
}

function textBlock(value?: string | null) {
  return value ? (
    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-900 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-300">
      {value}
    </pre>
  ) : (
    <p className="mt-2 rounded-md border border-zinc-900 bg-zinc-950 p-3 text-xs text-zinc-600">
      Not captured for this operation.
    </p>
  );
}

export default async function LlmReviewPage() {
  const db = getDb();
  const items = await db.llmReviewItem.findMany({
    include: {
      projectBrief: { include: { user: true } },
      person: true,
      message: { select: { id: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 120,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          LLM quality
        </p>
        <h2 className="mt-2 text-2xl font-semibold">LLM review</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Compare deterministic fallback text with OpenAI output before any live
          LLM-driven SMS is considered. This page is admin-only and does not
          send SMS, approve outreach, or enable active_live.
        </p>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-black p-4">
          <p className="text-xs uppercase text-zinc-500">Items</p>
          <p className="mt-1 text-2xl font-semibold">{items.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-black p-4">
          <p className="text-xs uppercase text-zinc-500">Unreviewed</p>
          <p className="mt-1 text-2xl font-semibold">
            {items.filter((item) => item.reviewStatus === "UNREVIEWED").length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-black p-4">
          <p className="text-xs uppercase text-zinc-500">Fallback used</p>
          <p className="mt-1 text-2xl font-semibold">
            {items.filter((item) => item.fallbackUsed).length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-black p-4">
          <p className="text-xs uppercase text-zinc-500">Unsafe flagged</p>
          <p className="mt-1 text-2xl font-semibold">
            {items.filter((item) => item.forbiddenClaimsDetected).length}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        {items.map((rawItem) => {
          const item = safeLlmReviewItemForDisplay(rawItem);
          return (
            <article
              key={item.id}
              className="rounded-lg border border-zinc-800 bg-black p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={item.reviewStatus} />
                    <StatusBadge status={item.flow} />
                    <StatusBadge status={item.validationStatus} />
                    {item.toneReviewStatus ? (
                      <StatusBadge status={item.toneReviewStatus} />
                    ) : null}
                    <StatusBadge
                      status={item.fallbackUsed ? "FALLBACK_USED" : "LLM_SELECTED"}
                    />
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">
                    {item.operation}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {item.createdAt.toLocaleString()} | {item.provider} |{" "}
                    {item.model} | {item.mode}
                  </p>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <p>Selected: {metadataText(item.selectedReplySource)}</p>
                  <p>Fallback reason: {metadataText(item.fallbackReason)}</p>
                  <p>
                    Forbidden claims:{" "}
                    {metadataText(item.forbiddenClaimsDetected)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                <div>
                  <p className="font-medium text-zinc-200">
                    Deterministic fallback
                  </p>
                  {textBlock(item.deterministicText)}
                </div>
                <div>
                  <p className="font-medium text-zinc-200">LLM output</p>
                  {textBlock(item.llmText)}
                </div>
                <div>
                  <p className="font-medium text-zinc-200">Selected reply</p>
                  {textBlock(item.selectedText)}
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-zinc-500 md:grid-cols-3">
                <p>Safety flags: {metadataText(item.safetyFlags)}</p>
                <p>
                  Project:{" "}
                  {rawItem.projectBrief ? (
                    <Link
                      className="text-zinc-300 hover:text-white"
                      href={`/admin/projects/${rawItem.projectBrief.id}`}
                    >
                      {briefTitle(rawItem.projectBrief)}
                    </Link>
                  ) : (
                    metadataText(item.projectBriefId)
                  )}
                </p>
                <p>Person: {rawItem.person?.name || metadataText(item.personId)}</p>
              </div>

              <form
                action={updateLlmReviewItemAction}
                className="mt-4 grid gap-3 border-t border-zinc-900 pt-4 md:grid-cols-[220px_minmax(0,1fr)_auto]"
              >
                <input type="hidden" name="id" value={item.id} />
                <label className={labelClass}>
                  Review status
                  <select
                    name="reviewStatus"
                    className={inputClass}
                    defaultValue={item.reviewStatus}
                  >
                    {LLM_REVIEW_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Reviewer notes
                  <textarea
                    name="reviewerNotes"
                    rows={2}
                    className={inputClass}
                    defaultValue={item.reviewerNotes || ""}
                    placeholder="Admin-only notes. Do not include raw phone numbers, secrets, or production Saga app data."
                  />
                </label>
                <div className="flex items-end">
                  <button className={buttonClass}>Save review</button>
                </div>
              </form>
            </article>
          );
        })}
        {items.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-black p-8 text-center text-sm text-zinc-500">
            No LLM review items yet. Run shadow or active_mock LLM operations to
            populate this queue.
          </div>
        ) : null}
      </section>
    </div>
  );
}
