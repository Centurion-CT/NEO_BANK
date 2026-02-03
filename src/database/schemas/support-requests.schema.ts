import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { identities } from './identities.schema';

/**
 * Support Requests Table
 * Stores user-submitted support tickets
 */
export const supportRequests = pgTable(
  'support_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id),
    subject: varchar('subject', { length: 200 }).notNull(),
    message: text('message').notNull(),
    category: varchar('category', { length: 50 }).notNull(), // account, transactions, security, general
    status: varchar('status', { length: 20 }).notNull().default('open'), // open, in_progress, resolved, closed
    priority: varchar('priority', { length: 20 }).notNull().default('medium'), // low, medium, high
    adminNotes: text('admin_notes'),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    identityIdIdx: index('support_requests_identity_id_idx').on(table.identityId),
    statusIdx: index('support_requests_status_idx').on(table.status),
    createdAtIdx: index('support_requests_created_at_idx').on(table.createdAt),
  }),
);

// Type inference
export type SupportRequest = typeof supportRequests.$inferSelect;
export type NewSupportRequest = typeof supportRequests.$inferInsert;
