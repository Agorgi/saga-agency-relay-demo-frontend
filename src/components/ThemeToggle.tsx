"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ThemeMode, applyTheme, getActiveTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode | null>(null);

  useEffect(() => {
    setTheme(getActiveTheme());
  }, []);

  const toggleTheme = () => {
    const activeTheme = theme ?? "light";
    const nextTheme: ThemeMode = activeTheme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const isDark = theme === "dark";
  const nextThemeLabel = isDark ? "light" : "dark";

  return (
    <motion.button
      onClick={toggleTheme}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="brand-chip flex items-center gap-2 rounded-pill px-2.5 py-2.5 text-sm font-medium tracking-tight text-ink sm:px-4"
      aria-label={`Switch to ${nextThemeLabel} mode`}
    >
      <span className="brand-surface-inset flex h-8 w-8 items-center justify-center rounded-full">
        {theme === null ? <ThemeIcon /> : isDark ? <SunIcon /> : <MoonIcon />}
      </span>
      <span className="hidden sm:block">
        {theme === null ? "Theme" : isDark ? "Dark mode" : "Light mode"}
      </span>
    </motion.button>
  );
}

function ThemeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-ink">
      <path
        d="M8 2.1a5.9 5.9 0 1 0 0 11.8A5.9 5.9 0 0 0 8 2.1Zm0 0c1.2 1.1 1.8 2.4 1.8 3.9S9.2 8.8 8 9.9C6.8 8.8 6.2 7.5 6.2 6s.6-2.8 1.8-3.9Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-ink">
      <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.4v1.7M8 12.9v1.7M1.4 8h1.7M12.9 8h1.7M3.3 3.3l1.2 1.2M11.5 11.5l1.2 1.2M12.7 3.3l-1.2 1.2M4.5 11.5l-1.2 1.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-ink">
      <path d="M10.7 2.2c-2.8.3-5 2.7-5 5.7 0 3.2 2.6 5.8 5.8 5.8 1.1 0 2.1-.3 3-.8-.8 1.4-2.4 2.4-4.2 2.4-3 0-5.5-2.4-5.5-5.5 0-3 2.4-5.5 5.5-5.5.2 0 .3 0 .4 0z" fill="currentColor" />
    </svg>
  );
}
