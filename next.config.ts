import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets two dev servers run side by side (e.g. NEXT_DIST_DIR=.next-ui for a mock-mode UI server).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
