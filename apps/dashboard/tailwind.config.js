/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EBF5FF',
          100: '#D4E9FF',
          200: '#A8D2FF',
          300: '#75B5FF',
          400: '#3D90FF',
          500: '#0D6EFD',
          600: '#0958CC',
          700: '#074199',
          800: '#052E6B',
          900: '#031A3D',
        },
        secondary: {
          50: '#E6FAF1',
          100: '#C2F2DD',
          200: '#85E5BB',
          300: '#48D899',
          400: '#1DCB7C',
          500: '#0FB969',
          600: '#0C9655',
          700: '#097342',
          800: '#06502E',
          900: '#03331D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
