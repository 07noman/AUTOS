/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../desktop/src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        bg: {
          DEFAULT: 'hsl(var(--bg))',
          subtle: 'hsl(var(--bg-subtle))',
          elevated: 'hsl(var(--bg-elevated))',
        },
        text: {
          DEFAULT: 'hsl(var(--text))',
          secondary: 'hsl(var(--text-secondary))',
          muted: 'hsl(var(--text-muted))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
          active: 'hsl(var(--primary-active))',
        },
        success: { DEFAULT: 'hsl(var(--success))', bg: 'hsl(var(--success-bg))', text: 'hsl(var(--success-text))' },
        warning: { DEFAULT: 'hsl(var(--warning))', bg: 'hsl(var(--warning-bg))', text: 'hsl(var(--warning-text))' },
        error: { DEFAULT: 'hsl(var(--error))', bg: 'hsl(var(--error-bg))', text: 'hsl(var(--error-text))' },
        info: { DEFAULT: 'hsl(var(--info))', bg: 'hsl(var(--info-bg))', text: 'hsl(var(--info-text))' },
        online: 'hsl(var(--online))',
        offline: 'hsl(var(--offline))',
        syncing: 'hsl(var(--syncing))',
      },
    },
  },
  plugins: [],
};
