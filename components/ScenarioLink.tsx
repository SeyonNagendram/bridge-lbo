"use client";

// A link between the model and the methodology page that keeps the scenario: it carries the current
// query string, so the inputs are still there on the way back. The address bar follows the inputs
// only after a short debounce (Calculator), so before reading it the link asks the calculator to
// write any pending change at once. Plain <a>: no client router, the pages stay static HTML.

import type { AnchorHTMLAttributes } from "react";

/** Dispatched on window, synchronously; the calculator writes its pending URL in response. */
export const FLUSH_SCENARIO_URL = "bridge-flush-scenario-url";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

export function ScenarioLink({ href, ...props }: Props) {
  // On every way a link can be used (hover, focus, press, click, which keyboard Enter also fires), so
  // "Copy link address" and middle-click get the scenario too. The server renders the bare path.
  const withScenario = (event: { currentTarget: HTMLAnchorElement }) => {
    window.dispatchEvent(new Event(FLUSH_SCENARIO_URL));
    event.currentTarget.href = `${href}${window.location.search}`;
  };
  return (
    <a
      {...props}
      href={href}
      onPointerEnter={withScenario}
      onPointerDown={withScenario}
      onFocus={withScenario}
      onClick={withScenario}
    />
  );
}
