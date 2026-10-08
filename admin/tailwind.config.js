import { fileURLToPath } from 'node:url'

/** @type {import('tailwindcss').Config} */
export default {
  content: [fileURLToPath(new URL('./index.html', import.meta.url)), fileURLToPath(new URL('./src/**/*.{js,jsx}', import.meta.url))],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0F172A', 700: '#1E293B' },
        amber: { DEFAULT: '#F59E0B', 600: '#D97706', 700: '#B45309', 50: '#FFFBEB', 100: '#FEF3C7' },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
