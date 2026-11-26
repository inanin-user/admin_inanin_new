import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  basePath: "/admin_inanin_new",
  serverExternalPackages: ["bcrypt"],
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
