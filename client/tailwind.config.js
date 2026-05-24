/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        board: '#1a2e22',
        boardCell: '#0e1d15',
        tile: '#f3e2b8',
        tileBorder: '#a88d4f',
        dl: '#3a6ea5',
        tl: '#1b3a6e',
        dw: '#9c3b6e',
        tw: '#8a2222',
      },
    },
  },
  plugins: [],
};
