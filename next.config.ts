import type { NextConfig } from "next";
const basePath = '/admin_inanin_new';
const nextConfig: NextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
