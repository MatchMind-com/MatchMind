import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ─── Editorial palette — "The Athletic, but for betting" ───
        bg: {
          base: '#0F1115',
          surface: '#1A1D24',
          elevated: '#232730',
        },
        border: {
          // DEFAULT preserves the bare `border` utility (border-color: var(--border-subtle) by default)
          DEFAULT: '#2A2F3A',
          subtle: '#2A2F3A',
          strong: '#3A4050',
        },
        fg: {
          DEFAULT: '#F5F1E8',
          secondary: '#B8B5AB',
          muted: '#6E6B62',
        },
        brand: {
          DEFAULT: '#F97316',
          hover: '#FB923C',
        },
        success: '#10B981',
        loss: '#F43F5E',
        value: '#F59E0B',
        live: '#EF4444',

        // ─── Legacy aliases (kept so existing components don't break) ───
        background: '#0F1115',
        card: '#1A1D24',
        accent: '#10B981',
        danger: '#F43F5E',
        primary: '#F97316',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        stat: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.025em',
        tighter: '-0.022em',
        editorial: '-0.02em',
      },
      borderRadius: {
        card: '12px',
      },
      spacing: {
        '4.5': '1.125rem',
      },
      animation: {
        'slide-down': 'slide-down 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'live-ping': 'live-ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      boxShadow: {
        'editorial': '0 1px 3px rgba(0,0,0,0.35), 0 0 0 1px rgba(58,64,80,0.4)',
      },
    },
  },
  plugins: [],
}

export default config
