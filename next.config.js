/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript:{ignoreBuildErrors:true},
  eslint:{ignoreDuringBuilds:true},
  experimental: {
    serverComponentsExternalPackages: ['openai'],
  },
  async redirects() {
    return [
      // /pricing and /plans → home page pricing section. People manually
      // type these (or click stale outbound links) and currently 404. The
      // in-page #pricing section is the canonical pricing surface.
      { source: '/pricing', destination: '/#pricing', permanent: false },
      { source: '/plans', destination: '/#pricing', permanent: false },
    ]
  },
}

module.exports = nextConfig
