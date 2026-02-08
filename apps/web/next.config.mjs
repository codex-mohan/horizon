/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Configure Turbopack for Next.js 16
  turbopack: {
    // Enable watch for data directory in development
    rules: {
      // Add any Turbopack-specific rules here
    },
  },
  // Keep webpack config for any Node.js-only builds
  // Remove in favor of Turbopack for App Router
  webpack: undefined,
};

export default nextConfig;
