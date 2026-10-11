import { describe, expect, it } from "vitest";
import { BASE_IRR, BASE_MOM, OG_IMAGE } from "../ogImage";

describe("Open Graph image", () => {
  it("shows the engine's base case, as in the Excel model (§6)", () => {
    expect(BASE_IRR).toBe("20.6%");
    expect(BASE_MOM).toBe("2.55x");
  });

  it("is 1200 × 630 PNG with the figures in its alt text", () => {
    expect(OG_IMAGE).toMatchObject({ url: "/og.png", width: 1200, height: 630, type: "image/png" });
    expect(OG_IMAGE.alt).toContain("20.6% IRR, 2.55x MoM");
  });
});
