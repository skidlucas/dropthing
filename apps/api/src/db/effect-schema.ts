import { createInsertSchema, createSelectSchema } from 'drizzle-orm/effect-schema';
import { Schema } from 'effect';
import { dropsTable } from './schema.js';

export const DropSelect = createSelectSchema(dropsTable);
export const DropInsert = createInsertSchema(dropsTable);

export const DropSelectArray = Schema.Array(DropSelect);
