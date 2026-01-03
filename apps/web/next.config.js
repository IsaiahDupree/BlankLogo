/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@blanklogo/shared"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

module.exports = nextConfig;
