import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', 'build/**', '**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'build/', '**/*.test.ts', '**/*.spec.ts'],
    },
  },
});
