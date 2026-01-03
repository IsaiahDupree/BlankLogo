/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@canvascast/shared"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

module.exports = nextConfig;
