"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import {
  Activity,
  AlertCircle,
  Brain,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Command,
  Database,
  FolderKanban,
  KeyRound,
  MessageSquare,
  Network,
  Rocket,
  Rows3,
  ScrollText,
  Search,
  Send,
  ShieldCheck,
  TestTube2,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  adminNavSections,
  getAdminChevronDirection,
  getAdminSectionOpenState,
  isAdminNavItemActive,
  type AdminNavBadgeKey,
  type AdminNavIcon,
} from "@/components/admin/adminNavigation";

const iconMap: Record<AdminNavIcon, LucideIcon> = {
  activity: Activity,
  alertCircle: AlertCircle,
  brain: Brain,
  checkSquare: CheckSquare,
  circleDot: CircleDot,
  command: Command,
  database: Database,
  folderKanban: FolderKanban,
  keyRound: KeyRound,
  messageSquare: MessageSquare,
  network: Network,
  rocket: Rocket,
  rows3: Rows3,
  scrollText: ScrollText,
  search: Search,
  send: Send,
  shieldCheck: ShieldCheck,
  testTube: TestTube2,
  users: Users,
};

const storageKey = "saga-admin-sidebar-open-sections";
const storageEventName = "saga-admin-sidebar-storage";

function getStoredOpenStateSnapshot() {
  if (typeof window === "undefined") return "{}";
  return window.localStorage.getItem(storageKey) || "{}";
}

function subscribeToOpenState(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(storageEventName, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(storageEventName, callback);
  };
}

function parseOpenState(snapshot: string) {
  try {
    const parsed = JSON.parse(snapshot);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

export type AdminSidebarBadges = Partial<Record<AdminNavBadgeKey, number>>;

function Badge({ count }: { count?: number }) {
  if (!count) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span className="ml-auto rounded-full border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100">
      {label}
    </span>
  );
}

export function AdminSidebar({
  compact = false,
  badges = {},
}: {
  compact?: boolean;
  badges?: AdminSidebarBadges;
}) {
  const pathname = usePathname();
  const storedSnapshot = useSyncExternalStore(
    subscribeToOpenState,
    getStoredOpenStateSnapshot,
    () => "{}",
  );
  const openSections = useMemo(
    () => getAdminSectionOpenState(pathname, parseOpenState(storedSnapshot)),
    [pathname, storedSnapshot],
  );

  function toggleSection(sectionId: string) {
    const next = { ...openSections, [sectionId]: !openSections[sectionId] };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new Event(storageEventName));
    } catch {
      // Local storage is a convenience only; navigation still works without it.
    }
  }

  return (
    <nav
      aria-label="Admin navigation"
      className={compact ? "grid gap-2" : "space-y-2"}
    >
      {adminNavSections.map((section, sectionIndex) => {
        const isOpen = openSections[section.id] || false;
        const sectionIsCommandCenter = sectionIndex === 0;
        const sectionIsNeedsAttention = section.id === "needs-attention";
        const sectionBadge = section.badgeKey ? badges[section.badgeKey] : undefined;

        if (!section.collapsible && section.items[0]) {
          const item = section.items[0];
          const active = isAdminNavItemActive(pathname, item);
          const Icon = iconMap[item.icon];
          const badge = item.badgeKey ? badges[item.badgeKey] : sectionBadge;
          return (
            <Link
              key={section.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                active
                  ? "border-emerald-400/40 bg-emerald-400/15 text-white shadow-sm shadow-emerald-950/30"
                  : sectionIsCommandCenter
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-50 hover:border-emerald-400/50"
                    : sectionIsNeedsAttention
                      ? "border-amber-400/30 bg-amber-400/10 text-amber-50 hover:border-amber-300/50"
                      : "border-zinc-900 bg-zinc-950/60 text-zinc-300 hover:border-zinc-700 hover:text-white"
              }`}
            >
              <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.label}</span>
              <Badge count={badge} />
            </Link>
          );
        }

        const ChevronIcon = getAdminChevronDirection(isOpen) === "down"
          ? ChevronDown
          : ChevronRight;
        return (
          <section
            key={section.id}
            className="rounded-lg border border-zinc-900 bg-zinc-950/60 p-1.5"
          >
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
              aria-expanded={isOpen}
            >
              <ChevronIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {section.label}
                {section.advanced ? (
                  <span className="ml-2 rounded border border-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-500">
                    Advanced
                  </span>
                ) : null}
              </span>
              <Badge count={sectionBadge} />
            </button>
            {isOpen ? (
              <div className="mt-1 space-y-0.5">
                {section.items.map((item) => {
                  const active = isAdminNavItemActive(pathname, item);
                  const Icon = iconMap[item.icon];
                  const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
                        active
                          ? "border border-emerald-400/40 bg-emerald-400/15 text-white shadow-sm shadow-emerald-950/30"
                          : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                      }`}
                    >
                      <Icon
                        aria-hidden
                        className={`h-3.5 w-3.5 shrink-0 ${
                          active ? "text-emerald-200" : "text-zinc-500 group-hover:text-zinc-300"
                        }`}
                      />
                      <span className="min-w-0 truncate font-medium">
                        {compact ? item.shortLabel || item.label : item.label}
                      </span>
                      <Badge count={badge} />
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </nav>
  );
}
