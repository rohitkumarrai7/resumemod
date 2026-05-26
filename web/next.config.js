/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@clerk/nextjs"],
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist", "pdf-parse", "canvas"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "canvas"];
    }
    return config;
  },
};

module.exports = nextConfig;
