import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: { DEFAULT: '#FBF8F1', 100: '#F5F0E3', 200: '#EBE4D2' },
        forest: {
          50: '#F0F5F1', 100: '#DCE8DE', 300: '#8FB39B', 500: '#3F7A56',
          600: '#2F6445', 700: '#244F37', 800: '#1B3D2B', 900: '#122A1E',
        },
        sage: { 100: '#E8EFE6', 200: '#D3E0CF', 300: '#B8CDB3', 500: '#7E9E7B' },
        charcoal: { DEFAULT: '#26302B', soft: '#56615B' },
        line: '#E4DFD0',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '"Segoe UI"', '"Noto Sans"', '"Noto Sans Arabic"', 'Tahoma', 'sans-serif'],
        display: ['ui-serif', 'Georgia', '"Noto Serif"', '"Noto Naskh Arabic"', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(38,48,43,.04), 0 8px 24px -8px rgba(38,48,43,.10)',
        lift: '0 2px 4px rgba(38,48,43,.05), 0 16px 32px -12px rgba(36,79,55,.25)',
      },
      borderRadius: { xl2: '1.25rem' },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { rise: 'rise .4s ease-out both' },
    },
  },
  plugins: [],
};

export default config;
