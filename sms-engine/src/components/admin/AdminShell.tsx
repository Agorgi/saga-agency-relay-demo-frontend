import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAdmin } from "@/app/admin/actions";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import {
  getNeedsAttentionSidebarBadges,
  getNeedsAttentionSummary,
} from "@/lib/admin/needsAttention";
import { getPilotModeBanners } from "@/lib/pilotReadiness";
import { getAdminSmsSafetyBanners } from "@/lib/smsSafety";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const smsSafetyBanners = [
    ...getAdminSmsSafetyBanners(),
    ...getPilotModeBanners(),
  ];
  const needsAttentionSummary = await getNeedsAttentionSummary({ limit: 0 });
  const sidebarBadges = getNeedsAttentionSidebarBadges(needsAttentionSummary);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="flex min-h-screen">
        <aside className="hidden max-h-screen w-80 overflow-y-auto border-r border-zinc-800 bg-black/30 px-4 py-5 lg:block">
          <Link href="/admin/command-center" className="block px-2">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
              Saga
            </p>
            <h1 className="mt-1 text-lg font-semibold">Operator Console</h1>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Start with Command Center. Every deeper tool stays grouped by job.
            </p>
          </Link>
          <div className="mt-6">
            <AdminSidebar badges={sidebarBadges} />
          </div>
          <form action={logoutAdmin} className="mt-8 px-2">
            <button className="flex w-full items-center gap-3 rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white">
              <LogOut aria-hidden className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 lg:hidden">
            <Link href="/admin/command-center" className="block">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
                Saga
              </p>
              <h1 className="mt-1 text-lg font-semibold">Operator Console</h1>
            </Link>
            <div className="mt-3 max-h-[60vh] overflow-y-auto">
              <AdminSidebar compact badges={sidebarBadges} />
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {smsSafetyBanners.length > 0 ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {smsSafetyBanners.map((banner) => (
                  <span
                    key={banner}
                    className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100"
                  >
                    {banner}
                  </span>
                ))}
              </div>
            ) : null}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
