/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        // Match Crit-Fumble brand colors
        'cf-primary': '#6366f1',
        'cf-secondary': '#8b5cf6',
      },
    },
  },
  plugins: [],
};
