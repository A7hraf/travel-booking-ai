import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Company applications upload up to 3 documents of 5MB each.
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
