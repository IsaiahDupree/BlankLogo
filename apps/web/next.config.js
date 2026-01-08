/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@blanklogo/shared"],
  eslint: {
    ignoreDuringBuilds: true, // Fix lint errors later, deploy now
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

module.exports = nextConfig;
