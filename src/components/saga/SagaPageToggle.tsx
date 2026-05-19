"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type PageToggleEntry = {
  href: string;
  label: string;
};

export const PAGE_TOGGLE_ENTRIES: PageToggleEntry[] = [
  { href: "/", label: "Landing (slide 6)" },
  { href: "/chat", label: "Chat (slide 7)" },
  { href: "/demo/brief", label: "Brief (slide 8)" },
  { href: "/demo/crew", label: "Crew (slide 9)" },
  { href: "/demo/candidates", label: "Candidates (slide 10)" },
  { href: "/projects", label: "Projects (live)" },
  { href: "/projects/new", label: "New brief (live)" },
  { href: "/me", label: "Me" },
  { href: "/feed", label: "Feed" },
  { href: "/explore", label: "Explore" },
  { href: "/spaces", label: "Spaces" },
  { href: "/talent", label: "Talent" },
  { href: "/my-events", label: "My events" },
  { href: "/relay", label: "Relay" },
  { href: "/create", label: "Create (redirect)" },
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
