/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mahana: {
          50: '#fdf8f0',
          100: '#f9eddb',
          200: '#f2d8b5',
          300: '#e9bd86',
          400: '#df9c55',
          500: '#d78333',
          600: '#c96b28',
          700: '#a75223',
          800: '#864222',
          900: '#6c371e',
        },
        ocean: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
    },
  },
  plugins: [],
}
