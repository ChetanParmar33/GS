import type { Config } from 'tailwindcss';

// Dark "Vice City night" theme: near-black purple base, electric violet primary, sunset pink as a rare second accent.
// Token names are unchanged from the old light theme so booking + admin screens pick up the new values.
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          base: '#0A0612', // page background
          surface: '#150D24', // cards
          soft: '#1C1331', // inset blocks, inputs
          lavender: '#2A1B4D', // selected / hover tint
          border: '#2E2248',
          primary: '#7A35F0', // buttons, selected fills
          hover: '#8E52FF',
          accent: '#B48CFF', // accent text, focus rings
          glow: '#DCCBFF', // tinted headings, selected text
          dark: '#F3EEFC', // main text
          muted: '#A89CC0',
          pink: '#FF4D9D',
          sun: '#FFB45C'
        }
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
        display: ['var(--font-unbounded)', 'var(--font-manrope)', 'sans-serif']
      },
      boxShadow: {
        card: '0 10px 30px rgba(0, 0, 0, 0.35)',
        elevated: '0 24px 60px rgba(0, 0, 0, 0.5)',
        glow: '0 0 0 1px rgba(180, 140, 255, 0.35), 0 12px 40px rgba(122, 53, 240, 0.35)'
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'none' }
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' }
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.8)' }
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(2%, -3%, 0) scale(1.06)' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        marquee: 'marquee 32s linear infinite',
        'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
        drift: 'drift 14s ease-in-out infinite'
      }
    }
  },
  plugins: []
};

export default config;
