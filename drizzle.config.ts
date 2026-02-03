import type { Config } from 'drizzle-kit';
import 'dotenv/config';

export default {
  schema: './src/database/schemas/index.ts',
  out: './src/database/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bankapp',
  },
  verbose: true,
  strict: true,
} satisfies Config;
