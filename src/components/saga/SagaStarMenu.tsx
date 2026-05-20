"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

type StarMenuEntry = {
  href: string;
  label: string;
  hint?: string;
};

type StarMenuSection = {
  label: string;
  entries: StarMenuEntry[];
};

/**
 * Single source of truth for the design-QA navigator. Lists the core
 * tracer flow plus the kept utility pages. Persona-demo surfaces
 * (/feed, /spaces, /explore, /me) and the standalone /demo design
 * twins were removed in the pre-branch cleanup.
 */
export const STAR_MENU_SECTIONS: StarMenuSection[] = [
  {
    label: "Tracer",
    entries: [
      { href: "/", label: "Landing" },
      { href: "/chat", label: "Chat" },
      { href: "/projects", label: "Projects" },
      { href: "/projects/new", label: "New brief" },
    ],
  },
  {
    label: "Pages",
    entries: [
      { href: "/talent", label: "Talent" },
      { href: "/profile", label: "Profile" },
      { href: "/my-events", label: "My events" },
    ],
  },
];

export function SagaStarMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        className="saga-star-button"
        aria-label="Open page index"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <StarIcon />
      </button>

      <div
        className={`saga-star-backdrop${isOpen ? " is-open" : ""}`}
        aria-hidden="true"
        onClick={() => setIsOpen(false)}
      />

      <aside
        id={panelId}
        className={`saga-star-panel${isOpen ? " is-open" : ""}`}
        role="dialog"
        aria-label="Page index"
        aria-modal="true"
        aria-hidden={!isOpen}
      >
        <header className="saga-star-panel-header">
          <span className="saga-star-overline">INDEX</span>
          <button
            type="button"
            className="saga-star-close"
            aria-label="Close page index"
            onClick={() => setIsOpen(false)}
          >
            ×
          </button>
        </header>

        <nav className="saga-star-nav" aria-label="Design QA pages">
          {STAR_MENU_SECTIONS.map((section) => (
            <section key={section.label} className="saga-star-section">
              <h3 className="saga-star-section-label">{section.label}</h3>
              <ul>
                {section.entries.map((entry) => {
                  const isActive = pathname === entry.href;
                  return (
                    <li key={entry.href}>
                      <Link
                        href={entry.href}
                        className={isActive ? "is-active" : undefined}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <span className="saga-star-entry-label">
                          {entry.label}
                        </span>
                        {entry.hint ? (
                          <span className="saga-star-entry-hint">
                            {entry.hint}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        <footer className="saga-star-panel-footer">
          <span className="saga-star-overline">design qa</span>
        </footer>
      </aside>
    </>
  );
}

function StarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 2 L13.6 9.4 L21 12 L13.6 14.6 L12 22 L10.4 14.6 L3 12 L10.4 9.4 Z"
        fill="currentColor"
      />
    </svg>
  );
}
