import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: '#F97316',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.matchmindcom.com'),
  title: 'MatchMind — Your sports betting fund workspace',
  description: 'You\'re the coach of your own sports betting fund. MatchMind gives you the tools to run it — AI predictions, embedded coach, bankroll desk, public track record.',
  applicationName: 'MatchMind',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MatchMind',
  },
  formatDetection: {
    telephone: false,
  },
  // OG + Twitter cards point to /api/og — a 1200×630 dynamic brand card
  // that includes today's live value-bet count. Every shared link now
  // renders a branded preview on Twitter, IG DMs, WhatsApp, Slack, etc.
  // Without this, link previews were blank and got skipped past in feeds.
  openGraph: {
    title: 'MatchMind — Your sports betting fund workspace',
    description: 'You\'re the coach of your own sports betting fund. MatchMind gives you the tools to run it.',
    type: 'website',
    siteName: 'MatchMind',
    url: 'https://www.matchmindcom.com',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'MatchMind — AI Football Intelligence',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MatchMind — Your sports betting fund workspace',
    description: 'You\'re the coach. We\'re the tools.',
    images: ['/api/og'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0B0B14] min-h-screen antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
