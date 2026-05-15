"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { PebbleMark } from "@/components/PebbleMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getDiscoverPath, getPrimaryCta } from "@/lib/sagasanPersonas";
import { useSagaNavigation } from "@/lib/useSagaNavigation";
import { useSessionPersona } from "@/lib/useSessionPersona";
import { useThemeMode } from "@/lib/useThemeMode";

export function AppChrome() {
  const pathname = usePathname();
  const { persona } = useSessionPersona();
  const { goExplore, goFeed, goHome, goMe, goSpaces, openPostProject } =
    useSagaNavigation();
  const isDark = useThemeMode() === "dark";

  const discoverPath = getDiscoverPath(persona);
  const primaryCta = getPrimaryCta(persona);
  const onHomePath = pathname === "/";
  const onForMePath = pathname === "/me" || pathname === "/profile";
  const onTalentPath =
    pathname.startsWith("/talent") || pathname === "/explore" || pathname === "/spaces";
  const shouldHideBottomNav =
    pathname === "/" ||
    pathname === "/post-project" ||
    pathname === "/create" ||
    pathname.includes("/discover") ||
    pathname.startsWith("/talent/") ||
    pathname.endsWith("/tickets");

  const navItems: Array<{
    label: string;
    active: boolean;
    onClick: () => void;
  }> = [{ label: "Home", active: onHomePath, onClick: goHome }];

  if (persona) {
    navItems.push({
      label: "For me",
      active: onForMePath,
      onClick: goMe,
    });
  }

  if (discoverPath) {
    navItems.push({
      label: "Discover",
      active: discoverPath === "/feed" ? pathname === "/feed" : onTalentPath,
      onClick: () => {
        if (discoverPath === "/feed") {
          goFeed();
        } else if (discoverPath === "/spaces") {
          goSpaces();
        } else {
          goExplore();
        }
      },
    });
  }

  const handlePrimaryCta = () => {
    if (!primaryCta) {
      return;
    }

    if (persona === "host") {
      openPostProject();
      return;
    }

    if (persona === "creative") {
      goMe();
      return;
    }

    if (persona === "venue") {
      goSpaces();
      return;
    }

    if (persona === "fan") {
      goFeed();
    }
  };

  return (
    <>
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 hidden items-center justify-between gap-4 px-4 pt-4 md:flex lg:px-8 lg:pt-6">
        <div className="pointer-events-auto flex items-center gap-3">
          <PebbleMark />
          <div className="brand-chip flex items-center gap-2 rounded-pill px-2 py-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`rounded-pill px-3.5 py-2 text-sm font-medium transition-colors ${
                  item.active
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
          {primaryCta ? (
            <button
              onClick={handlePrimaryCta}
              className="brand-button-primary rounded-pill px-5 py-2.5 text-sm font-medium"
            >
              {primaryCta.label}
            </button>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 pt-4 md:hidden">
        <div className="pointer-events-auto">
          <PebbleMark />
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <ThemeToggle />
          {!shouldHideBottomNav && primaryCta ? (
            <button
              onClick={handlePrimaryCta}
              className="brand-button-primary rounded-pill px-3.5 py-2 text-sm font-medium"
            >
              Go
            </button>
          ) : null}
        </div>
      </div>

      {!shouldHideBottomNav && persona && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className={`brand-surface-strong fixed bottom-[calc(0.8rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[calc(100vw-1.2rem)] max-w-[460px] -translate-x-1/2 items-center justify-between rounded-[28px] px-4 py-3 md:hidden ${
            isDark ? "text-white" : "text-ink"
          }`}
        >
          <BottomNavButton label="Home" active={onHomePath} dark={isDark} onClick={goHome} />
          <BottomNavButton label="For me" active={onForMePath} dark={isDark} onClick={goMe} />
          <BottomNavButton
            label="Discover"
            active={discoverPath === "/feed" ? pathname === "/feed" : onTalentPath}
            dark={isDark}
            onClick={() => {
              if (discoverPath === "/feed") {
                goFeed();
              } else if (discoverPath === "/spaces") {
                goSpaces();
              } else {
                goExplore();
              }
            }}
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
