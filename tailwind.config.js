/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Forest green: primary actions, links, positive states
        brand: {
          50: '#f1f7f2',
          100: '#dcebdf',
          200: '#bad7c0',
          300: '#8dbb97',
          400: '#5e9a6c',
          500: '#3e7e4e',
          600: '#2d663c',
          700: '#245232',
          800: '#1f4229',
          900: '#1a3723',
        },
        // Red murram soil: accents, warnings, forest-loss data
        soil: {
          50: '#fcf4ef',
          100: '#f8e4d8',
          200: '#f0c6ae',
          300: '#e5a07c',
          400: '#d8764c',
          500: '#c75b30',
          600: '#a94726',
          700: '#8a3822',
          800: '#6f3021',
          900: '#5b291e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
