import { create } from "zustand";

export type Theme = "light" | "dark";

const STORAGE_KEY = "lf-theme";

/** Read the persisted theme, else fall back to the OS preference. */
function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Toggle the `dark` class on <html> so every CSS token flips at once. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
    set({ theme });
  },
  toggle: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));
