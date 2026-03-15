import { integer, pgTable, varchar, timestamp, index, uuid } from "drizzle-orm/pg-core";

export const sharesTable = pgTable("shares", {
  id: uuid().primaryKey(),
  fileName: varchar().notNull(),
  mimeType: varchar().notNull(),
  size: integer().notNull(),
  storageKey: varchar().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  expiresAt: timestamp().notNull(),
},
(table) => [
  index("expires_at_index").on(table.expiresAt),
],
);