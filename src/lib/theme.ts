import { THEME_KEY } from "./constants";

export type Theme = "light" | "dark" | "system";

export function getStoredTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY) as Theme | null;
    if (t === "light" || t === "dark" || t === "system") return t;
  } catch {
    /* ignore */
  }
  return "system";
}

export function isDarkNow(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function applyTheme(t: Theme) {
  const sys = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = t === "dark" || (t === "system" && sys);
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore */
  }
}

export function watchSystem(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
