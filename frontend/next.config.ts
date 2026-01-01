import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  serverExternalPackages: [
    "@meshsdk/core",
    "@meshsdk/core-cst",
    "@meshsdk/react",
  ],

  webpack: function (config) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;
