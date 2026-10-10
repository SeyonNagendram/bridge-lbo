"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/lib/site";

type Theme = "light" | "dark";

const CHANGE_EVENT = "sweep-theme-change";
const DARK_QUERY = "(prefers-color-scheme: dark)";

// The theme lives on <html data-theme> (set before paint by the inline script in the layout),
// so the DOM is the single source of truth and React only subscribes to it.
function getTheme(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function ThemeToggle() {
  // null on the server: the theme is only known in the browser.
  const theme = useSyncExternalStore<Theme | null>(subscribe, getTheme, () => null);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode): the choice simply isn't remembered.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // Keeps its space before hydration so the header doesn't shift.
      className={`h-8 rounded-[6px] border border-border px-3 text-[13px] text-muted transition-colors duration-150 hover:text-text ${theme === null ? "invisible" : ""}`}
    >
      {next === "dark" ? "Dark mode" : "Light mode"}
    </button>
  );
}
