// The Open Graph image's figures and tags (§9, Phase 5), shared by the image route (app/og.png) and the
// page metadata. The base case comes from the engine, not typed in, so the link preview can never
// disagree with the app.

import { formatMoM, formatPercent } from "./format";
import { BASE_CASE, runLbo } from "./lbo";
import { APP_NAME, APP_SUBTITLE, AUTHOR_NAME } from "./site";

const { returns } = runLbo(BASE_CASE);

/** Base-case returns as displayed in the app, e.g. "20.6%" and "2.55x". */
export const BASE_IRR = returns.irr === null ? "n.m." : formatPercent(returns.irr);
export const BASE_MOM = formatMoM(returns.mom);

/** Served from a path with a .png extension, so any static host sends it as image/png. */
export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: `${APP_NAME}, ${APP_SUBTITLE}. Base case: ${BASE_IRR} IRR, ${BASE_MOM} MoM. By ${AUTHOR_NAME}.`,
} as const;
