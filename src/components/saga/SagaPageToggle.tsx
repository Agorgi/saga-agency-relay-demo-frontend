"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type PageToggleEntry = {
  href: string;
  label: string;
};

export const PAGE_TOGGLE_ENTRIES: PageToggleEntry[] = [
  { href: "/", label: "Landing" },
  { href: "/chat", label: "Chat" },
  { href: "/projects", label: "Projects" },
  { href: "/projects/new", label: "New brief" },
  { href: "/discover", label: "Discover" },
  { href: "/explore", label: "Explore" },
  { href: "/feed", label: "Feed" },
  { href: "/for-me", label: "For me" },
  { href: "/me", label: "Me" },
  { href: "/profile", label: "Profile" },
  { href: "/my-events", label: "My events" },
  { href: "/spaces", label: "Spaces" },
  { href: "/talent", label: "Talent" },
  { href: "/relay", label: "Relay" },
  { href: "/create", label: "Create" },
  { href: "/post-project", label: "Post project" },
];

export function SagaPageToggle({
  entries = PAGE_TOGGLE_ENTRIES,
}: {
  entries?: PageToggleEntry[];
}) {
  const pathname = usePathname();
  return (
    <nav className="saga-page-toggle" aria-label="Design QA page navigator">
      <span className="pt-label">DESIGN QA</span>
      {entries.map((entry, index) => {
        const isActive = pathname === entry.href;
        return (
          <Link
            key={entry.href}
            href={entry.href}
            className={isActive ? "is-active" : undefined}
            title={`${index + 1}. ${entry.label}`}
            aria-label={entry.label}
            aria-current={isActive ? "page" : undefined}
          >
            {index + 1}
          </Link>
        );
      })}
    </nav>
  );
}
