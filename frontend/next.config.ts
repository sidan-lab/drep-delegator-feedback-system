import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Fix for libsodium-wrappers-sumo ESM resolution issue
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });

    // Ignore problematic ESM modules on server-side
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        "libsodium-wrappers-sumo": "commonjs libsodium-wrappers-sumo",
      });
    }

    return config;
  },
};

export default nextConfig;
