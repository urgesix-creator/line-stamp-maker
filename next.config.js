/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // sharp / heic-convert are native/server-only; keep them external to the server bundle
  serverExternalPackages: ["sharp", "heic-convert", "jszip"],
  eslint: {
    // Lint is run separately in CI; do not block production builds.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
