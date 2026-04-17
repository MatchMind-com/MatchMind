import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MatchMind — AI Football Intelligence',
    short_name: 'MatchMind',
    description: 'AI-powered football predictions, value bets, and betting coach.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#060914',
    theme_color: '#F97316',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['sports', 'finance'],
    screenshots: [],
  }
}
