export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "saga-theme";
export const THEME_CLASS_LIGHT = "theme-light";
export const THEME_CLASS_DARK = "theme-dark";

export const THEME_INIT_SCRIPT = `(() => {
  try {
    const stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    const theme = stored === "dark" || stored === "light" ? stored : "light";
    const root = document.documentElement;
    root.classList.remove("${THEME_CLASS_LIGHT}", "${THEME_CLASS_DARK}");
    root.classList.add(theme === "dark" ? "${THEME_CLASS_DARK}" : "${THEME_CLASS_LIGHT}");
    root.style.colorScheme = theme;
  } catch (error) {
    document.documentElement.classList.add("${THEME_CLASS_LIGHT}");
    document.documentElement.style.colorScheme = "light";
  }
})();`;

export function getActiveTheme(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains(THEME_CLASS_DARK)
    ? "dark"
    : "light";
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove(THEME_CLASS_LIGHT, THEME_CLASS_DARK);
  root.classList.add(theme === "dark" ? THEME_CLASS_DARK : THEME_CLASS_LIGHT);
  root.style.colorScheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}
