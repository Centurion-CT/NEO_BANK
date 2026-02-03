import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';

/**
 * Audit Action Enum
 */
export const auditActionEnum = pgEnum('audit_action', [
  // Authentication
  'login_success',
  'login_failure',
  'logout',
  'password_change',
  'pin_change',
  'mfa_enroll',
  'mfa_verify',

  // User
  'user_create',
  'user_update',
  'user_delete',
  'profile_update',

  // Account
  'account_create',
  'account_update',
  'account_close',

  // Transaction
  'transaction_initiate',
  'transaction_complete',
  'transaction_fail',
  'transaction_reverse',

  // KYC
  'kyc_submit',
  'kyc_approve',
  'kyc_reject',

  // Security
  'session_create',
  'session_revoke',
  'device_trust',
  'device_revoke',

  // Admin
  'admin_action',
  'config_change',
]);

/**
 * Audit Logs Table
 * Immutable log of all security-relevant actions
 *
 * SECURITY NOTES:
 * - This table is append-only (no updates/deletes)
 * - Used for compliance and forensics
 * - Retained per regulatory requirements
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Actor
    userId: uuid('user_id'),
    userEmail: varchar('user_email', { length: 255 }),
    adminId: uuid('admin_id'),

    // Action
    action: auditActionEnum('action').notNull(),
    resourceType: varchar('resource_type', { length: 50 }), // user, account, transaction, etc.
    resourceId: uuid('resource_id'),

    // Details
    description: text('description').notNull(),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    metadata: jsonb('metadata'),

    // Request Context
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    requestId: varchar('request_id', { length: 100 }),
    sessionId: uuid('session_id'),

    // Status
    status: varchar('status', { length: 20 }).notNull().default('success'),
    errorMessage: text('error_message'),

    // Timestamp
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    resourceIdx: index('audit_logs_resource_idx').on(table.resourceType, table.resourceId),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
    requestIdIdx: index('audit_logs_request_id_idx').on(table.requestId),
  }),
);

// Type inference
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
