/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        obsidian: {
          DEFAULT: '#060608',
          surface: '#0B0B0F',
          card: '#111116',
          border: 'rgba(255, 255, 255, 0.08)',
        },
        ceramic: {
          DEFAULT: '#F4F4F1',
          surface: '#FFFFFF',
          card: 'rgba(255, 255, 255, 0.85)',
          border: 'rgba(0, 0, 0, 0.07)',
        },
      },
      boxShadow: {
        'studio-light': '0 20px 50px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
        'studio-heavy': '0 30px 60px -12px rgba(0, 0, 0, 0.12), 0 18px 36px -18px rgba(0, 0, 0, 0.08)',
        'glow-emerald': '0 0 50px -10px rgba(16, 185, 129, 0.3)',
        'glow-rose': '0 0 50px -10px rgba(244, 63, 94, 0.3)',
        'glow-cyan': '0 0 50px -10px rgba(6, 182, 212, 0.25)',
      },
      keyframes: {
        'aurora': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)', opacity: '0.4' },
          '50%': { transform: 'scale(1.15) rotate(180deg)', opacity: '0.7' },
        },
        'shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'aurora': 'aurora 20s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s infinite',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
