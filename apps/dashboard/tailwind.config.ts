import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172026',
        mist: '#eef2f3',
        teal: '#12737a',
        coral: '#d95d39',
        lime: '#8aa342',
      },
    },
  },
  plugins: [],
} satisfies Config;
