import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';

/**
 * MFA Backup Codes Table
 * Stores one-time recovery codes for MFA bypass
 *
 * When MFA is enabled, a set of backup codes is generated.
 * Each code can only be used once. Users should save these
 * codes in a secure location in case they lose access to
 * their primary MFA method.
 *
 * Security Notes:
 * - Codes are stored as hashed values (Argon2)
 * - Each code can only be used once (isUsed flag)
 * - Codes are regenerated when MFA is re-enabled
 */
export const mfaBackupCodes = pgTable(
  'mfa_backup_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Foreign key to identity
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),

    // Hashed backup code (Argon2)
    codeHash: varchar('code_hash', { length: 255 }).notNull(),

    // Usage tracking
    isUsed: boolean('is_used').notNull().default(false),
    usedAt: timestamp('used_at'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Index for finding backup codes by identity
    identityIdIdx: index('mfa_backup_codes_identity_id_idx').on(table.identityId),
    // Index for checking unused codes
    identityUnusedIdx: index('mfa_backup_codes_identity_unused_idx').on(
      table.identityId,
      table.isUsed,
    ),
  }),
);

/**
 * MFA Backup Codes Relations
 */
export const mfaBackupCodesRelations = relations(mfaBackupCodes, ({ one }) => ({
  identity: one(identities, {
    fields: [mfaBackupCodes.identityId],
    references: [identities.id],
  }),
}));

// Type inference
export type MfaBackupCode = typeof mfaBackupCodes.$inferSelect;
export type NewMfaBackupCode = typeof mfaBackupCodes.$inferInsert;
