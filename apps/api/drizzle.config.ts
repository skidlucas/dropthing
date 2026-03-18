import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DB_URL) {
  throw new Error('DB_URL environment variable is required');
}

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DB_URL,
  },
});
