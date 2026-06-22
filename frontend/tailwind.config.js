/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0c12',
          900: '#0d1018',
          850: '#11151f',
          800: '#161b27',
          750: '#1b2130',
          700: '#222a3c',
          600: '#2d384f',
          500: '#3a4866',
        },
        brand: {
          DEFAULT: '#ff6a3d',
          400: '#ff8a63',
          500: '#ff6a3d',
          600: '#f04e1f',
        },
        accent: {
          DEFAULT: '#5b9dff',
          400: '#7db2ff',
          500: '#5b9dff',
          600: '#3d83f0',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
}
