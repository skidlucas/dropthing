import { integer, pgTable, varchar, timestamp, index, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const dropsTable = pgTable(
  'drops',
  {
    id: uuid().primaryKey().defaultRandom(),
    fileName: varchar().notNull(),
    mimeType: varchar().notNull(),
    size: integer().notNull(),
    storageKey: varchar().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    expiresAt: timestamp()
      .notNull()
      .default(sql`now() + interval '1 week'`),
  },
  (table) => [index('expires_at_index').on(table.expiresAt)]
);
