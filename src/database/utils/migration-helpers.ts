import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql, SQL } from 'drizzle-orm';
import { PgTable, PgColumn } from 'drizzle-orm/pg-core';

/**
 * Migration Helper Utilities
 * Transaction and batch utilities for safe data migration
 */

/**
 * Execute a function within a database transaction
 * Automatically handles commit/rollback
 */
export async function withTransaction<T>(
  db: NodePgDatabase<any>,
  fn: (tx: NodePgDatabase<any>) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await fn(tx);
  });
}

/**
 * Batch processing configuration
 */
export interface BatchConfig {
  batchSize: number;
  delayMs?: number;
  onProgress?: (processed: number, total: number) => void;
  onError?: (error: Error, batch: number) => void;
}

/**
 * Process records in batches to avoid memory issues and reduce lock contention
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  config: BatchConfig,
): Promise<R[]> {
  const { batchSize, delayMs = 0, onProgress, onError } = config;
  const results: R[] = [];
  const totalItems = items.length;

  for (let i = 0; i < totalItems; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;

    try {
      const batchResults = await processor(batch);
      results.push(...batchResults);

      if (onProgress) {
        onProgress(Math.min(i + batchSize, totalItems), totalItems);
      }

      // Optional delay between batches to reduce database load
      if (delayMs > 0 && i + batchSize < totalItems) {
        await sleep(delayMs);
      }
    } catch (error) {
      if (onError) {
        onError(error as Error, batchNumber);
      }
      throw error;
    }
  }

  return results;
}

/**
 * Migrate data from source table to target table in batches
 */
export interface MigrationConfig<S, T> {
  sourceTable: PgTable;
  targetTable: PgTable;
  transform: (source: S) => T;
  batchSize?: number;
  whereClause?: SQL;
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Count records in a table with optional where clause
 */
export async function countRecords(
  db: NodePgDatabase<any>,
  table: PgTable,
  whereClause?: SQL,
): Promise<number> {
  const query = whereClause
    ? sql`SELECT COUNT(*)::int as count FROM ${table} WHERE ${whereClause}`
    : sql`SELECT COUNT(*)::int as count FROM ${table}`;

  const result = await db.execute(query);
  return (result.rows[0] as { count: number }).count;
}

/**
 * Verify record counts match between source and target tables
 */
export async function verifyMigration(
  db: NodePgDatabase<any>,
  sourceTable: PgTable,
  targetTable: PgTable,
  sourceWhere?: SQL,
  targetWhere?: SQL,
): Promise<{ match: boolean; sourceCount: number; targetCount: number }> {
  const sourceCount = await countRecords(db, sourceTable, sourceWhere);
  const targetCount = await countRecords(db, targetTable, targetWhere);

  return {
    match: sourceCount === targetCount,
    sourceCount,
    targetCount,
  };
}

/**
 * Create an idempotent migration check
 * Returns true if migration should proceed, false if already completed
 */
export async function shouldRunMigration(
  db: NodePgDatabase<any>,
  migrationKey: string,
): Promise<boolean> {
  // Check if migration tracking table exists, create if not
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_migration_state" (
      "key" varchar(255) PRIMARY KEY,
      "completed_at" timestamp DEFAULT now(),
      "metadata" jsonb
    )
  `);

  const result = await db.execute(
    sql`SELECT 1 FROM "_migration_state" WHERE "key" = ${migrationKey}`,
  );

  return result.rows.length === 0;
}

/**
 * Mark a migration as completed
 */
export async function markMigrationComplete(
  db: NodePgDatabase<any>,
  migrationKey: string,
  metadata?: Record<string, any>,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO "_migration_state" ("key", "metadata")
    VALUES (${migrationKey}, ${JSON.stringify(metadata || {})})
    ON CONFLICT ("key") DO UPDATE SET "completed_at" = now(), "metadata" = ${JSON.stringify(metadata || {})}
  `);
}

/**
 * Utility to safely add a column if it doesn't exist
 */
export async function addColumnIfNotExists(
  db: NodePgDatabase<any>,
  tableName: string,
  columnName: string,
  columnDefinition: string,
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ${tableName} AND column_name = ${columnName}
  `);

  if (result.rows.length === 0) {
    await db.execute(
      sql.raw(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnDefinition}`),
    );
    return true;
  }

  return false;
}

/**
 * Utility to safely create an index if it doesn't exist
 */
export async function createIndexIfNotExists(
  db: NodePgDatabase<any>,
  indexName: string,
  tableName: string,
  columns: string[],
  unique = false,
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM pg_indexes WHERE indexname = ${indexName}
  `);

  if (result.rows.length === 0) {
    const uniqueStr = unique ? 'UNIQUE' : '';
    const columnsStr = columns.map((c) => `"${c}"`).join(', ');
    await db.execute(
      sql.raw(`CREATE ${uniqueStr} INDEX "${indexName}" ON "${tableName}" (${columnsStr})`),
    );
    return true;
  }

  return false;
}

/**
 * Sleep utility for batch delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a deterministic UUID v5 from a namespace and name
 * Useful for creating consistent IDs during migration
 */
export function generateDeterministicId(namespace: string, name: string): string {
  // Simple deterministic ID generation using hash
  // In production, use a proper UUID v5 library
  const combined = `${namespace}:${name}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  // Convert to hex and pad to UUID format
  const hex = Math.abs(hash).toString(16).padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
