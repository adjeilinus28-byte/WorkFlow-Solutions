import { fileURLToPath } from 'node:url'

/** @type {import('tailwindcss').Config} */
export default {
  content: [fileURLToPath(new URL('./index.html', import.meta.url)), fileURLToPath(new URL('./src/**/*.{js,jsx}', import.meta.url))],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0F172A', 700: '#1E293B', 950: '#0B1120' },
        amber: { DEFAULT: '#F59E0B', 600: '#D97706', 700: '#B45309', 50: '#FFFBEB', 100: '#FEF3C7' },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 10px 24px -10px rgba(245,158,11,.65)',
        lift: '0 24px 48px -24px rgba(15,23,42,.28)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in': { from: { transform: 'translateX(24px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        grow: { from: { transform: 'scaleY(0)' }, to: { transform: 'none' } },
        draw: { from: { strokeDashoffset: '1' }, to: { strokeDashoffset: '0' } },
        pop: { from: { opacity: '0', transform: 'scale(.4)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up .5s cubic-bezier(.16,1,.3,1) both',
        'fade-in': 'fade-in .24s cubic-bezier(.16,1,.3,1) both',
        'slide-in': 'slide-in .32s cubic-bezier(.16,1,.3,1) both',
        grow: 'grow .7s cubic-bezier(.16,1,.3,1) both',
        draw: 'draw 1.6s cubic-bezier(.16,1,.3,1) .2s both',
        pop: 'pop .5s cubic-bezier(.34,1.56,.64,1) both',
      },
    },
  },
  plugins: [],
}
