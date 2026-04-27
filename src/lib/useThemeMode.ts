"use client";

import { useEffect, useState } from "react";
import { getActiveTheme, type ThemeMode } from "@/lib/theme";

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    setTheme(getActiveTheme());

    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(getActiveTheme());
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}
