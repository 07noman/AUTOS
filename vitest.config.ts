import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks',
    include: ['tests/unit/**/*.test.tsx', 'tests/unit/**/*.test.ts', 'packages/**/*.test.ts'],
    exclude: ['tests/e2e/**', '**/node_modules/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/desktop/src'),
    },
  },
});
