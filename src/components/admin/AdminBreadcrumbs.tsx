"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getAdminBreadcrumbs } from "@/components/admin/adminNavigation";

export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const breadcrumbs = getAdminBreadcrumbs(pathname);
  if (breadcrumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
      <ol className="flex flex-wrap items-center gap-2">
        {breadcrumbs.map((breadcrumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <li key={`${breadcrumb.href}-${index}`} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden>/</span> : null}
              {isLast ? (
                <span className="text-zinc-300">{breadcrumb.label}</span>
              ) : (
                <Link href={breadcrumb.href} className="hover:text-zinc-200">
                  {breadcrumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
