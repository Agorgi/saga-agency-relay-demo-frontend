import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  getNeedsAttentionSummary,
  type NeedsAttentionSeverity,
} from "@/sms-engine/admin/needsAttention";

export const dynamic = "force-dynamic";

const filterButtonClass =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900";

function toneForSeverity(severity: NeedsAttentionSeverity) {
  if (severity === "critical") return "border-red-900 bg-red-950/30 text-red-100";
  if (severity === "needs_review") return "border-amber-900 bg-amber-950/30 text-amber-100";
  if (severity === "warning") return "border-yellow-900 bg-yellow-950/30 text-yellow-100";
  return "border-zinc-800 bg-zinc-950 text-zinc-300";
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "danger" | "warn";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-900 bg-red-950/30 text-red-100"
      : tone === "warn"
        ? "border-amber-900 bg-amber-950/30 text-amber-100"
        : "border-zinc-800 bg-black text-zinc-100";
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default async function NeedsAttentionPage(props: {
  searchParams: Promise<{ type?: string; severity?: NeedsAttentionSeverity }>;
}) {
  const params = await props.searchParams;
  const summary = await getNeedsAttentionSummary({ limit: 100 });
  const filteredItems = summary.items.filter((item) => {
    if (params.type && item.type !== params.type) return false;
    if (params.severity && item.severity !== params.severity) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Operator queue"
        title="Needs Attention"
        description="Review approvals, failed jobs, blocked drafts, and safety warnings in one place."
        primaryStatus={`${summary.totalCount} open`}
        helpText="This page is read-only. It has no send buttons, launch buttons, outreach controls, raw phone numbers, or secrets."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total" value={summary.totalCount} />
        <StatCard
          label="Critical"
          value={summary.criticalCount}
          tone={summary.criticalCount ? "danger" : "neutral"}
        />
        <StatCard
          label="Needs review"
          value={summary.reviewCount}
          tone={summary.reviewCount ? "warn" : "neutral"}
        />
        <StatCard label="Warnings" value={summary.warningCount} />
      </section>

      <section className="rounded-lg border border-zinc-800 bg-black p-4">
        <div className="flex flex-wrap gap-2">
          <Link className={filterButtonClass} href="/admin/needs-attention">
            All
          </Link>
          <Link className={filterButtonClass} href="/admin/needs-attention?severity=critical">
            Critical
          </Link>
          <Link className={filterButtonClass} href="/admin/needs-attention?severity=needs_review">
            Needs review
          </Link>
          <Link className={filterButtonClass} href="/admin/needs-attention?severity=warning">
            Warnings
          </Link>
          <Link className={filterButtonClass} href="/admin/needs-attention?type=outbound_draft">
            Drafts
          </Link>
          <Link className={filterButtonClass} href="/admin/needs-attention?type=public_web_result">
            Public research
          </Link>
          <Link className={filterButtonClass} href="/admin/needs-attention?type=conversation">
            Conversations
          </Link>
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Approving a draft does not send while SMS_SENDS_DISABLED is on. No
          message is sent unless all safety gates pass.
        </p>
      </section>

      <section className="space-y-3">
        {filteredItems.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-black p-4 text-sm text-zinc-500">
            No items need attention for this filter.
          </p>
        ) : null}
        {filteredItems.map((item) => (
          <article
            key={item.id}
            className={`rounded-lg border p-4 ${toneForSeverity(item.severity)}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  {item.type.replaceAll("_", " ")}
                </p>
                <h3 className="mt-1 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {item.description}
                </p>
              </div>
              <span className="rounded-md border border-zinc-700 bg-black/30 px-2 py-1 text-xs uppercase tracking-[0.12em] text-zinc-300">
                {item.severity.replaceAll("_", " ")}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link className={filterButtonClass} href={item.href}>
                Open related page
              </Link>
              {item.projectBriefId ? (
                <span className="font-mono text-xs text-zinc-500">
                  Project: {item.projectBriefId.slice(0, 8)}
                </span>
              ) : null}
              <span className="text-xs text-zinc-500">
                Source: {item.source}
              </span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
