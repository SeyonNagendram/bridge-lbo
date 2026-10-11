"use client";

import { useEffect, useRef } from "react";

/**
 * Briefly tints an element when `value` (the text it displays) changes, so a reader sees which
 * outputs moved. Not on first render. The animation lives in CSS (.flash in globals.css), which
 * also switches it off under prefers-reduced-motion. On SVG text (chart labels) the figure itself is
 * tinted instead, since text in an SVG has no background.
 */
export function useFlash<T extends HTMLElement | SVGElement>(value: string) {
  const ref = useRef<T>(null);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    const element = ref.current;
    if (!element) return;
    // Remove, force a reflow, re-add: restarts the animation even mid-fade. getBoundingClientRect
    // rather than offsetWidth, which SVG elements (chart labels) don't have.
    element.classList.remove("flash");
    void element.getBoundingClientRect();
    element.classList.add("flash");
  }, [value]);

  return ref;
}
