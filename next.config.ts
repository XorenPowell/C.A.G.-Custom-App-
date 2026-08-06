import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root — there is a stray lockfile in the home directory
  // that Turbopack would otherwise try to treat as the project root.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
