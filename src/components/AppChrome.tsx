"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { PebbleMark } from "@/components/PebbleMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useThemeMode } from "@/lib/useThemeMode";
import { useAgencyStore } from "@/store/useAgencyStore";

const NAV_ITEMS = [
  { label: "Home", action: "home" as const },
  { label: "Explore Talent", action: "talent" as const },
  { label: "Projects", action: "projects" as const },
  { label: "Relay", action: "relay" as const },
  { label: "Profile", action: "profile" as const },
];

export function AppChrome() {
  const pathname = usePathname();
  const selectedProjectId = useAgencyStore((state) => state.selectedProjectId);
  const { goHome, goTalent, goProjects, goRelay, goProfile, openPostProject } = useSagaNavigation();
  const isDark = useThemeMode() === "dark";

  const onHomePath = pathname === "/";
  const onTalentPath = pathname.startsWith("/talent") || pathname === "/explore";
  const onProjectsPath =
    pathname.startsWith("/projects") ||
    pathname.startsWith("/events") ||
    pathname === "/my-events";
  const onRelayPath = pathname.startsWith("/relay");
  const onProfilePath = pathname.startsWith("/profile");
  const shouldHideBottomNav =
    pathname === "/" ||
    pathname === "/post-project" ||
    pathname === "/create" ||
    pathname.includes("/discover") ||
    pathname.startsWith("/talent/") ||
    pathname.endsWith("/tickets");

  const handleNav = (action: (typeof NAV_ITEMS)[number]["action"]) => {
    if (action === "home") return goHome();
    if (action === "talent") return goTalent(selectedProjectId || undefined);
    if (action === "projects") return goProjects();
    if (action === "relay") return goRelay(selectedProjectId || undefined);
    if (action === "profile") return goProfile();
  };

  return (
    <>
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 hidden items-center justify-between gap-4 px-4 pt-4 md:flex lg:px-8 lg:pt-6">
        <div className="pointer-events-auto flex items-center gap-3">
          <PebbleMark />
          <div className="brand-chip flex items-center gap-2 rounded-pill px-2 py-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNav(item.action)}
                className={`rounded-pill px-3.5 py-2 text-sm font-medium transition-colors ${
                  (item.action === "home" && onHomePath) ||
                  (item.action === "talent" && onTalentPath) ||
                  (item.action === "projects" && onProjectsPath) ||
                  (item.action === "relay" && onRelayPath) ||
                  (item.action === "profile" && onProfilePath)
                    ? "brand-chip-signal"
                    : isDark
                      ? "text-white/62 hover:text-white"
                      : "text-ink-light hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={openPostProject}
            className="brand-button-primary rounded-pill px-5 py-2.5 text-sm font-medium"
          >
            Post a Project
          </button>
        </div>
      </div>

      <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 pt-4 md:hidden">
        <div className="pointer-events-auto">
          <PebbleMark />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <ThemeToggle />
          {!shouldHideBottomNav && (
            <button
              onClick={openPostProject}
              className="brand-button-primary rounded-pill px-3.5 py-2 text-sm font-medium"
            >
              Post
            </button>
          )}
        </div>
      </div>

      {!shouldHideBottomNav && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className={`brand-surface-strong fixed bottom-[calc(0.8rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[calc(100vw-1.2rem)] max-w-[460px] -translate-x-1/2 items-center justify-between rounded-[28px] px-4 py-3 md:hidden ${
            isDark ? "text-white" : "text-ink"
          }`}
        >
          <BottomNavButton label="Talent" active={onTalentPath} dark={isDark} onClick={() => goTalent(selectedProjectId || undefined)} />
          <BottomNavButton label="Projects" active={onProjectsPath} dark={isDark} onClick={goProjects} />
          <button
            onClick={openPostProject}
            className="brand-button-primary absolute left-1/2 top-0 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-lg font-semibold"
            aria-label="Post project"
          >
            +
          </button>
          <BottomNavButton label="Relay" active={onRelayPath} dark={isDark} onClick={() => goRelay(selectedProjectId || undefined)} />
          <BottomNavButton
            label="Profile"
            active={onProfilePath}
            dark={isDark}
            onClick={goProfile}
          />
        </motion.div>
      )}
    </>
  );
}

function BottomNavButton({
  label,
  active,
  dark,
  onClick,
}: {
  label: string;
  active: boolean;
  dark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 text-xs font-medium ${
        active ? (dark ? "text-white" : "text-ink") : dark ? "text-white/48" : "text-ink-light"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-accent" : "bg-transparent"
        }`}
      />
      {label}
    </button>
  );
}
