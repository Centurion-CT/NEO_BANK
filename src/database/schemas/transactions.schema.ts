import {
  pgTable,
  uuid,
  varchar,
  decimal,
  text,
  timestamp,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';
import { accounts } from './accounts.schema';

/**
 * Transactions Table
 * All financial transactions
 *
 * SECURITY NOTES:
 * - Immutable once completed (no updates, only reversals)
 * - All transactions require idempotency keys
 * - Reference numbers are unique and traceable
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityId: uuid('identity_id').notNull().references(() => identities.id),

    // Account references for transfers
    sourceAccountId: uuid('source_account_id').references(() => accounts.id),
    destinationAccountId: uuid('destination_account_id').references(() => accounts.id),

    // Transaction Identity
    reference: varchar('reference', { length: 50 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 100 }),

    // Type & Status (using varchar for flexibility)
    type: varchar('type', { length: 30 }).notNull(), // transfer, deposit, withdrawal, payment, etc.
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, processing, completed, failed, reversed

    // Amounts
    amount: decimal('amount', { precision: 18, scale: 2 }).notNull(),
    fee: decimal('fee', { precision: 18, scale: 2 }).default('0.00'),
    currency: varchar('currency', { length: 3 }).notNull().default('NGN'),

    // Balance tracking
    balanceBefore: decimal('balance_before', { precision: 18, scale: 2 }),
    balanceAfter: decimal('balance_after', { precision: 18, scale: 2 }),

    // Description
    description: text('description'),
    narration: text('narration'),

    // Counterparty (for external transfers)
    counterpartyName: varchar('counterparty_name', { length: 255 }),
    counterpartyAccount: varchar('counterparty_account', { length: 20 }),
    counterpartyBank: varchar('counterparty_bank', { length: 100 }),

    // Failure tracking
    failureReason: text('failure_reason'),

    // Metadata
    metadata: jsonb('metadata'),
    channel: varchar('channel', { length: 50 }), // web, mobile, ussd, api

    // Security
    ipAddress: varchar('ip_address', { length: 45 }),
    deviceId: varchar('device_id', { length: 100 }),

    // Timestamps
    initiatedAt: timestamp('initiated_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    referenceIdx: index('transactions_reference_idx').on(table.reference),
    idempotencyIdx: index('transactions_idempotency_idx').on(table.idempotencyKey),
    identityIdIdx: index('transactions_identity_id_idx').on(table.identityId),
    sourceAccountIdx: index('transactions_source_account_idx').on(table.sourceAccountId),
    destAccountIdx: index('transactions_dest_account_idx').on(table.destinationAccountId),
    statusIdx: index('transactions_status_idx').on(table.status),
    typeIdx: index('transactions_type_idx').on(table.type),
    createdAtIdx: index('transactions_created_at_idx').on(table.createdAt),
  }),
);

// Relations
export const transactionsRelations = relations(transactions, ({ one }) => ({
  identity: one(identities, {
    fields: [transactions.identityId],
    references: [identities.id],
  }),
  sourceAccount: one(accounts, {
    fields: [transactions.sourceAccountId],
    references: [accounts.id],
  }),
  destinationAccount: one(accounts, {
    fields: [transactions.destinationAccountId],
    references: [accounts.id],
  }),
}));

// Type inference
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
