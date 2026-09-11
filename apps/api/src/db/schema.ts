import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const dropsTable = sqliteTable(
  'drops',
  {
    id: text().primaryKey(),
    type: text({ enum: ['file', 'text', 'link'] })
      .notNull()
      .default('text'),
    content: text(),
    fileName: text('file_name'),
    mimeType: text('mime_type'),
    size: integer(),
    storageKey: text('storage_key'),
    metadata: text({ mode: 'json' }).$type<{ language?: string; title?: string }>(),
    encrypted: integer({ mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('drops_expires_at_idx').on(table.expiresAt)]
);

export const uploadIntentsTable = sqliteTable(
  'upload_intents',
  {
    storageKey: text('storage_key').primaryKey(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    declaredSize: integer('declared_size').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [index('upload_intents_expires_at_idx').on(table.expiresAt)]
);
