import Link from "next/link";
import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";

export type AdminPageHeaderProps = {
  title: string;
  eyebrow?: string;
  description: string;
  primaryStatus?: string;
  helpText?: string;
  docsLink?: {
    href: string;
    label: string;
  };
  dangerNotice?: string;
  showBreadcrumbs?: boolean;
};

export function AdminPageHeader({
  title,
  eyebrow,
  description,
  primaryStatus,
  helpText,
  docsLink,
  dangerNotice,
  showBreadcrumbs = true,
}: AdminPageHeaderProps) {
  return (
    <header className="space-y-4">
      {showBreadcrumbs ? <AdminBreadcrumbs /> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            {description}
          </p>
        </div>
        {primaryStatus ? (
          <span className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-200">
            {primaryStatus}
          </span>
        ) : null}
      </div>
      {helpText || docsLink || dangerNotice ? (
        <div className="flex flex-wrap items-center gap-3">
          {helpText ? (
            <p className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-xs leading-5 text-zinc-400">
              {helpText}
            </p>
          ) : null}
          {docsLink ? (
            <Link
              href={docsLink.href}
              className="inline-flex rounded-md border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-900"
            >
              {docsLink.label}
            </Link>
          ) : null}
          {dangerNotice ? (
            <p className="rounded-md border border-red-900 bg-red-950/30 px-3 py-2 text-xs leading-5 text-red-100">
              {dangerNotice}
            </p>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
