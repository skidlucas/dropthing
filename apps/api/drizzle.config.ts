import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './d1',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
});
