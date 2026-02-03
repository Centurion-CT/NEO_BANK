import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';

/**
 * Account Type Enum
 */
export const accountTypeEnum = pgEnum('account_type', [
  'savings',
  'current',
  'fixed_deposit',
  'loan',
  'investment',
]);

/**
 * Account Status Enum
 */
export const accountStatusEnum = pgEnum('account_status', [
  'active',
  'dormant',
  'frozen',
  'closed',
  'pending_activation',
]);

/**
 * Currency Enum
 */
export const currencyEnum = pgEnum('currency', [
  'NGN',
  'USD',
  'GBP',
  'EUR',
]);

/**
 * Accounts Table
 * Bank accounts linked to users
 *
 * SECURITY NOTES:
 * - Account numbers are generated securely
 * - Balance operations use transactions
 * - All modifications are audited
 */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityId: uuid('identity_id').notNull().references(() => identities.id),

    // External Core Banking Reference
    accountId: varchar('account_id', { length: 100 }).notNull(), // ID from core banking system

    // Account Identity
    accountNumber: varchar('account_number', { length: 20 }).notNull(),
    accountType: accountTypeEnum('account_type').notNull(),
    currency: currencyEnum('currency').notNull().default('NGN'),
    nickname: varchar('nickname', { length: 100 }),

    // Balances (using decimal for precision)
    balance: decimal('balance', { precision: 18, scale: 2 }).notNull().default('0.00'),
    availableBalance: decimal('available_balance', { precision: 18, scale: 2 }).notNull().default('0.00'),
    holdAmount: decimal('hold_amount', { precision: 18, scale: 2 }).notNull().default('0.00'),

    // Status
    status: accountStatusEnum('status').notNull().default('pending_activation'),

    // Interest (for savings/FD)
    interestRate: decimal('interest_rate', { precision: 5, scale: 2 }),

    // Primary account flag
    isPrimary: boolean('is_primary').notNull().default(false),

    // Timestamps
    openedAt: timestamp('opened_at').notNull().defaultNow(),
    lastTransactionAt: timestamp('last_transaction_at'),
    closedAt: timestamp('closed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdIdx: uniqueIndex('accounts_account_id_idx').on(table.accountId), // Core banking ID
    accountNumberIdx: uniqueIndex('accounts_account_number_idx').on(table.accountNumber),
    identityIdIdx: index('accounts_identity_id_idx').on(table.identityId),
    statusIdx: index('accounts_status_idx').on(table.status),
    typeIdx: index('accounts_type_idx').on(table.accountType),
  }),
);

// Relations
export const accountsRelations = relations(accounts, ({ one }) => ({
  identity: one(identities, {
    fields: [accounts.identityId],
    references: [identities.id],
  }),
}));

// Type inference
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
