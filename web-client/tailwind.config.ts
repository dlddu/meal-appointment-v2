import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        surface: 'var(--color-surface)',
        background: 'var(--color-background)',
        border: 'var(--color-border)',
        success: 'var(--color-success)',
        error: 'var(--color-error)',
        view: {
          primary: 'var(--color-view-primary)',
          secondary: 'var(--color-view-secondary)',
          neutral: 'var(--color-view-neutral)',
          border: 'var(--color-view-border)',
          warning: 'var(--color-view-warning)',
          error: 'var(--color-view-error)'
        },
        participation: {
          primary: 'var(--participation-primary)',
          secondary: 'var(--participation-secondary)',
          neutral: {
            50: 'var(--participation-neutral-50)',
            100: 'var(--participation-neutral-100)'
          },
          border: 'var(--participation-border)',
          success: 'var(--participation-success)',
          warning: 'var(--participation-warning)',
          error: 'var(--participation-error)'
        }
      },
      dropShadow: {
        card: '0 12px 24px rgba(15,23,42,0.12)',
        action: '0 8px 16px rgba(42,111,151,0.22)'
      },
      borderRadius: {
        lg: '12px'
      }
    }
  },
  plugins: []
};

export default config;
