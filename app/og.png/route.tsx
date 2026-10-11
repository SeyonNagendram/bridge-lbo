// Open Graph image (§9, Phase 5): the LinkedIn / social link preview, rendered once at build time into
// out/og.png. A route handler rather than the opengraph-image convention, whose static export has no file
// extension. Figures come from lib/ogImage.ts (the engine); fonts are the app's own, as TTF (which the
// renderer needs), vendored in assets/fonts.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BASE_IRR, BASE_MOM, OG_IMAGE } from "@/lib/ogImage";
import { APP_NAME, APP_SUBTITLE, AUTHOR_NAME } from "@/lib/site";

// Required for a route handler in a static export: render once at build time.
export const dynamic = "force-static";

// Light theme tokens (§7).
const BG = "#FAFAF8";
const BORDER = "#E6E4DF";
const TEXT = "#0E1116";
const MUTED = "#6B6F76";
const ACCENT = "#0F3D6E";

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));

export async function GET() {
  const [serif, regular, medium] = await Promise.all([
    font("SourceSerif4-SemiBold.ttf"),
    font("Inter-Regular.ttf"),
    font("Inter-Medium.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "88px 96px",
          background: BG,
          color: TEXT,
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "Source Serif 4", fontSize: 112, lineHeight: 1, letterSpacing: "-0.01em" }}>
            {APP_NAME}
          </div>
          <div style={{ marginTop: 24, fontSize: 40, color: MUTED }}>{APP_SUBTITLE}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", borderTop: `2px solid ${BORDER}`, paddingTop: 40 }}>
          <div style={{ fontSize: 22, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase" }}>Base case</div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 12, fontSize: 64, fontWeight: 500 }}>
            <span style={{ color: ACCENT }}>{BASE_IRR} IRR</span>
            <span style={{ color: MUTED, margin: "0 24px" }}>·</span>
            <span>{BASE_MOM} MoM</span>
          </div>
          <div style={{ marginTop: 48, fontSize: 28, color: MUTED }}>{AUTHOR_NAME}</div>
        </div>
      </div>
    ),
    {
      width: OG_IMAGE.width,
      height: OG_IMAGE.height,
      fonts: [
        { name: "Source Serif 4", data: serif, weight: 600, style: "normal" },
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
