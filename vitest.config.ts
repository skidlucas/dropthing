import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/**/src/**/*.test.ts', 'packages/**/src/**/*.test.ts'],
    env: {
      // Load .env for integration tests that need DB_URL
      ...require('dotenv').config().parsed,
    },
  },
});
