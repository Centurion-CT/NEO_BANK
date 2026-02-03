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
import { sessions } from './sessions.schema';

/**
 * Biometric Challenges Table
 * Stores temporary challenges for biometric authentication verification
 *
 * SECURITY NOTES:
 * - Challenges expire after a short period (typically 5 minutes)
 * - Each challenge can only be used once
 * - Challenge hash is stored, not the actual challenge
 */
export const biometricChallenges = pgTable(
  'biometric_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityId: uuid('identity_id').notNull().references(() => identities.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),

    // Challenge data (hashed for security)
    challengeHash: varchar('challenge_hash', { length: 255 }).notNull(),

    // Status
    isUsed: boolean('is_used').notNull().default(false),
    isExpired: boolean('is_expired').notNull().default(false),

    // Timestamps
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    identityIdIdx: index('biometric_challenges_identity_id_idx').on(table.identityId),
    sessionIdIdx: index('biometric_challenges_session_id_idx').on(table.sessionId),
    challengeHashIdx: index('biometric_challenges_challenge_hash_idx').on(table.challengeHash),
    expiresAtIdx: index('biometric_challenges_expires_at_idx').on(table.expiresAt),
    isUsedIdx: index('biometric_challenges_is_used_idx').on(table.isUsed),
  }),
);

// Relations
export const biometricChallengesRelations = relations(biometricChallenges, ({ one }) => ({
  identity: one(identities, {
    fields: [biometricChallenges.identityId],
    references: [identities.id],
  }),
  session: one(sessions, {
    fields: [biometricChallenges.sessionId],
    references: [sessions.id],
  }),
}));

// Type inference
export type BiometricChallenge = typeof biometricChallenges.$inferSelect;
export type NewBiometricChallenge = typeof biometricChallenges.$inferInsert;
