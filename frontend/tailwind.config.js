/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
        brand: { light: '#38bdf8', DEFAULT: '#0ea5e9', dark: '#0284c7' },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.07)',
        'card-hover': '0 4px 6px rgba(0,0,0,0.07), 0 12px 32px rgba(0,0,0,0.12)',
        'input-focus': '0 0 0 3px rgba(59,130,246,0.15)',
        glass: '0 8px 32px rgba(0,0,0,0.12)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #1e40af 0%, #0891b2 100%)',
        'gradient-hero': 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 45%, #0e7490 100%)',
        'gradient-card': 'linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-in': 'slideIn 0.4s ease-out forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.65' },
        },
      },
    },
  },
  plugins: [],
};
