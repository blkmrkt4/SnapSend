import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Matches the in-app Liquid Relay palette
        teal: {
          DEFAULT: '#4fd1c5',
          dark: '#38b2ac',
          light: '#e6fffa',
        },
        navy: {
          DEFAULT: '#332D56',
          light: '#4E6688',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
