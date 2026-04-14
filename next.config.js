/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin", "pdf-parse"],
  },
  webpack: (config) => {
    // pdf-parse optionally requires canvas; disable it to avoid build warnings
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
