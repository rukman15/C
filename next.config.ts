import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg dan klien Prisma hanya dipakai di server.
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  poweredByHeader: false,
};

export default nextConfig;
