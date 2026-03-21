import { integer, pgTable, text, varchar, timestamp, index, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const dropsTable = pgTable(
  'drops',
  {
    id: uuid().primaryKey().defaultRandom(),
    type: varchar({ enum: ['file', 'text', 'link'] })
      .notNull()
      .default('text'),
    content: text(),
    fileName: varchar(),
    mimeType: varchar(),
    size: integer(),
    storageKey: varchar(),
    createdAt: timestamp().notNull().defaultNow(),
    expiresAt: timestamp()
      .notNull()
      .default(sql`now() + interval '1 week'`),
  },
  (table) => [index('expires_at_index').on(table.expiresAt)]
);
