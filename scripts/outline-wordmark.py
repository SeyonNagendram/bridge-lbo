"""Writes the Bridge logo SVGs to docs/brand/ with the wordmark as outlines (no font needed to view them).

The word is shaped with HarfBuzz (so kerning matches the browser) from the app's own Source Serif 4
SemiBold (assets/fonts) and drawn as paths with fontTools. The lockup keeps the header's proportions
(components/SiteHeader.tsx): mark = cap height, sitting on the baseline, then a 0.36em gap.
Run by hand after changing the mark or the name; the outputs are committed. Needs fonttools and uharfbuzz,
for example in a throwaway virtualenv:

    python3 -m venv /tmp/brand && /tmp/brand/bin/pip install fonttools uharfbuzz
    /tmp/brand/bin/python scripts/outline-wordmark.py && node scripts/build-brand.mjs
"""

from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "assets/fonts/SourceSerif4-SemiBold.ttf"
OUT = ROOT / "docs/brand"
NAME = "Bridge"  # APP_NAME in lib/site.ts

# Theme tokens (§7): the mark's tile is --accent and its bars are --bg; the word is --text.
THEMES = {
    "light": {"tile": "#0F3D6E", "bars": "#FAFAF8", "text": "#0E1116"},
    "dark": {"tile": "#7FB2E5", "bars": "#0B0D10", "text": "#E8EAED"},
}
BARS = "M6 18h4v8H6zM14 12h4v6h-4zM22 6h4v20h-4z"  # app/icon.svg, on a 32-unit tile with rx 6
GAP_EM = 0.36


def mark_svg(tile: str, bars: str) -> str:
    return f'<rect width="32" height="32" rx="6" fill="{tile}"/><path fill="{bars}" d="{BARS}"/>'


def main() -> None:
    font = TTFont(FONT)
    upm = font["head"].unitsPerEm
    cap = font["OS/2"].sCapHeight
    glyph_set = font.getGlyphSet()
    order = font.getGlyphOrder()

    blob = hb.Blob.from_file_path(str(FONT))
    hb_font = hb.Font(hb.Face(blob))
    buf = hb.Buffer()
    buf.add_str(NAME)
    buf.guess_segment_properties()
    hb.shape(hb_font, buf, {"kern": True, "liga": True})

    # The word in font units, baseline at y = 0, y pointing up; starts after the mark and the gap.
    x0 = cap + GAP_EM * upm
    pen = SVGPathPen(glyph_set)
    bounds = BoundsPen(glyph_set)
    x = x0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        offset = (1, 0, 0, 1, x + pos.x_offset, pos.y_offset)
        glyph_set[name].draw(TransformPen(pen, offset))
        glyph_set[name].draw(TransformPen(bounds, offset))
        x += pos.x_advance
    _, y_min, x_max, y_max = bounds.bounds
    top = max(y_max, cap)

    # viewBox in font units with y flipped (SVG y points down), tight around the ink.
    width, height = x_max, top - y_min
    OUT.mkdir(parents=True, exist_ok=True)
    for theme, colours in THEMES.items():
        scale = cap / 32
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {height:.0f}" '
            f'width="{width / upm * 100:.1f}" height="{height / upm * 100:.1f}">'
            f"<title>{NAME}</title>"
            f'<g transform="translate(0 {top - cap:.0f}) scale({scale:.4f})">{mark_svg(colours["tile"], colours["bars"])}</g>'
            f'<path fill="{colours["text"]}" transform="translate(0 {top:.0f}) scale(1 -1)" d="{pen.getCommands()}"/>'
            "</svg>\n"
        )
        (OUT / f"bridge-lockup-{theme}.svg").write_text(svg)

    # The mark on its own: identical to the favicon source.
    (OUT / "bridge-mark.svg").write_text((ROOT / "app/icon.svg").read_text())
    print(f"Wrote {OUT.relative_to(ROOT)}: bridge-mark.svg, bridge-lockup-light.svg, bridge-lockup-dark.svg")


if __name__ == "__main__":
    main()
