import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf ships its own PDF.js build; keep it out of the server bundle.
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
