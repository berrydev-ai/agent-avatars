import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx', 'tests/catalog/**/*.test.ts'],
          setupFiles: ['./src/test/setup.ts'],
          css: true,
        },
      },
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/lib/**/*.test.ts', 'tests/avatars/**/*.test.ts'],
          restoreMocks: true,
        },
      },
    ],
  },
});
