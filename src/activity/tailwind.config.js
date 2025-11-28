/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Discord color palette
        discord: {
          primary: '#5865f2',
          'primary-hover': '#4752c4',
          green: '#248046',
          red: '#da373c',
          yellow: '#f0b232',
          background: {
            primary: '#313338',
            secondary: '#2b2d31',
            tertiary: '#1e1f22',
            floating: '#232428',
          },
          text: {
            normal: '#dbdee1',
            muted: '#80848e',
            link: '#00a8fc',
          },
          border: '#3f4147',
        },
      },
      fontFamily: {
        discord: ['Whitney', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
