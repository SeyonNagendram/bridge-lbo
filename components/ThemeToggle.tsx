"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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

// Functional icons, drawn inline (no icon library): the moon offers dark mode, the sun light mode.
function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1Z" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="8" r="3" />
      <path
        d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ThemeToggle() {
  // null on the server: the theme is only known in the browser.
  const theme = useSyncExternalStore<Theme | null>(subscribe, getTheme, () => null);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Switch to dark mode" : "Switch to light mode";

  // Escape hides the tooltip until the pointer leaves or focus moves (WCAG 1.4.13).
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTooltipDismissed(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    // The wrapper holds button and tooltip, so the pointer can move onto the tooltip without losing it.
    <span
      className={`group relative inline-flex ${theme === null ? "invisible" : ""}`}
      onMouseLeave={() => setTooltipDismissed(false)}
    >
      <button
        type="button"
        onClick={toggle}
        onBlur={() => setTooltipDismissed(false)}
        aria-label={label}
        className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-border text-muted transition-colors duration-150 hover:text-text"
      >
        {next === "dark" ? <MoonIcon /> : <SunIcon />}
      </button>
      <span
        aria-hidden="true"
        className={`invisible absolute top-full right-0 z-10 pt-2 opacity-0 transition-[opacity,visibility] duration-150 ${
          tooltipDismissed
            ? ""
            : "group-hover:visible group-hover:opacity-100 group-has-[:focus-visible]:visible group-has-[:focus-visible]:opacity-100"
        }`}
      >
        <span className="block rounded-[6px] border border-border bg-surface px-2 py-1 text-[12px] whitespace-nowrap">
          {label}
        </span>
      </span>
    </span>
  );
}
