import type { Config } from 'tailwindcss';
import { fontFamily } from 'tailwindcss/defaultTheme';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0A0A0F',
          surface: '#111118',
          'surface-2': '#16161F',
          'surface-3': '#1C1C28',
          border: '#1E1E2E',
          'border-2': '#2A2A3A',
          'border-subtle': '#14141E',
          amber: '#F59E0B',
          gold: '#EAB308',
          'amber-muted': '#F59E0B26',
          'amber-subtle': '#F59E0B14',
        },
        text: {
          primary: '#F8F8FF',
          secondary: '#9494A8',
          muted: '#52526B',
          inverse: '#0A0A0F',
          disabled: '#3A3A52',
        },
        status: {
          success: '#10B981',
          'success-muted': '#10B98120',
          warning: '#F59E0B',
          'warning-muted': '#F59E0B20',
          error: '#EF4444',
          'error-muted': '#EF444420',
          info: '#6366F1',
          'info-muted': '#6366F120',
        },
        sidebar: {
          bg: '#0D0D14',
          border: '#1A1A26',
          item: '#F8F8FF',
          'item-muted': '#9494A8',
          'item-active-bg': '#16161F',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', ...fontFamily.sans],
        mono: ['var(--font-geist-mono)', ...fontFamily.mono],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      spacing: {
        sidebar: '240px',
        'sidebar-collapsed': '56px',
        header: '56px',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'glow-amber': '0 0 40px -8px rgba(245, 158, 11, 0.3)',
        'glow-amber-sm': '0 0 20px -4px rgba(245, 158, 11, 0.2)',
        card: '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.5)',
        panel: '0 4px 24px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)',
        modal: '0 20px 60px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.4)',
        'input-focus': '0 0 0 3px rgba(245,158,11,0.15)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-card':
          'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%)',
        shimmer:
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-amber': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'fade-in-up': 'fade-in-up 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.2s ease-out',
        'slide-in-left': 'slide-in-left 0.25s cubic-bezier(0.4,0,0.2,1)',
        shimmer: 'shimmer 1.5s linear infinite',
        'pulse-amber': 'pulse-amber 1.2s ease-in-out infinite',
        'scale-in': 'scale-in 0.15s ease-out',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
