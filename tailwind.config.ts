import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },

      fontFamily: {
        sans: [
          'Arial',
          'Helvetica',
          'sans-serif',
        ],
        mono: [
          'var(--font-geist-mono)',
          'monospace',
        ],
      },

      borderRadius: {
        xl: '0.75rem',
      },
    },
  },
  plugins: [],
};

export default config;