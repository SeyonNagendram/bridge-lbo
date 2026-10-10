import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the whole app is HTML/CSS/JS, all maths runs in the browser.
  output: "export",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
