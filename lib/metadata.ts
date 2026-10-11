// Per-page metadata (§9, Phase 5): title, description, canonical URL and the Open Graph / Twitter tags.
// Next.js replaces a layout's openGraph object wholesale when a page sets its own, so every page builds
// the full set here and they all share the same image.

import type { Metadata } from "next";
import { OG_IMAGE } from "./ogImage";
import { APP_NAME } from "./site";

export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", url: path, siteName: APP_NAME, title, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}
