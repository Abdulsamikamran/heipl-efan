/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          500: '#ffb84d',
          600: '#f58220',
          700: '#e07010',
          800: '#c45f0c',
        },
        navy: {
          50: '#eef3f6',
          600: '#0d212e',
          700: '#0a1a24',
          800: '#07141c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
