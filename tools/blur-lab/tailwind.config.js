/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // itsmenike.com design-system palette
      colors: {
        page: '#FAFAF8',
        ink: '#141414',
        muted: '#6b6b6b',
        faint: '#a3a3a3',
        rule: '#e4e2dc',
        accent: '#3f7ff4',
      },
    },
  },
  plugins: [],
};
