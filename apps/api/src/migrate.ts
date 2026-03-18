import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const db = drizzle(process.env.DB_URL!);
await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations applied successfully');
