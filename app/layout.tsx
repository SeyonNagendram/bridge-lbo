import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { pageMetadata } from "@/lib/metadata";
import { APP_DESCRIPTION, APP_NAME, APP_SUBTITLE, AUTHOR_NAME, LINKEDIN_URL, SITE_URL, THEME_STORAGE_KEY } from "@/lib/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Headings only, in the single weight they use.
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: "600",
});

// metadataBase makes every metadata URL absolute (og:image, canonical), which LinkedIn requires. The
// Open Graph image is rendered at build time by app/og.png/route.tsx; pages set their own tags.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  authors: [{ name: AUTHOR_NAME, url: LINKEDIN_URL }],
  ...pageMetadata({ title: `${APP_NAME} · ${APP_SUBTITLE}`, description: APP_DESCRIPTION, path: "/" }),
};

// Browser chrome follows the page background (--bg) in each theme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF8" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0D10" },
  ],
};

// Runs while the HTML is parsed, before first paint, so a stored theme never flashes.
const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
