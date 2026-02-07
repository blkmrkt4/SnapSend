import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7c3aed',
          foreground: '#ffffff',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
