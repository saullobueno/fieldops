import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@fieldops/ui", "@fieldops/config"]
};

export default nextConfig;
