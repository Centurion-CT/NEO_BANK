/**
 * Database Seeds Index
 *
 * Combines all seed files for running together
 * Run with: npx ts-node src/database/seeds/index.ts
 */

import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schemas';
import { seedPermissions } from './permissions.seed';
import { seedTenantsAndProperties } from './tenants-properties.seed';
import { seedSubscriptions } from './subscriptions.seed';
import { seedAddons } from './addons.seed';

/**
 * Run all seeds
 */
export async function runAllSeeds(db: NodePgDatabase<typeof schema>): Promise<void> {
  console.log('🌱 Running all database seeds...\n');

  // Run seeds in order:
  // 1. Permissions (roles, permissions, role-permission mappings)
  // 2. Tenants and Properties (system tenant, virtual/physical properties)
  // 3. Subscriptions (subscription plans)
  // 4. Addons (addon products and plans)
  await seedPermissions(db);
  console.log('');
  await seedTenantsAndProperties(db);
  console.log('');
  await seedSubscriptions(db);
  console.log('');
  await seedAddons(db);

  console.log('\n✅ All seeds completed successfully');
}

/**
 * Standalone seed runner
 */
async function main(): Promise<void> {
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');

  // Load environment variables
  const dotenv = await import('dotenv');
  dotenv.config();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
  });

  const db = drizzle(pool, { schema });

  try {
    await runAllSeeds(db);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    });
}
