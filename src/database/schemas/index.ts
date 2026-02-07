/**
 * Database Schema Index
 * Export all schemas for DrizzleORM
 */

// Identity schemas (compliance model)
export * from './identities.schema';
export * from './person-profiles.schema';
export * from './business-profiles.schema';
export * from './identity-status-history.schema';

// Authentication schemas
export * from './auth-principals.schema';
export * from './auth-secrets.schema';
export * from './devices.schema';
export * from './auth-events.schema';
export * from './session-events.schema';
export * from './identity-events.schema';

// KYC schemas
export * from './kyc-profiles.schema';
export * from './bvn-checks.schema';

// Financial schemas
export * from './accounts.schema';
export * from './transactions.schema';

// Legacy KYC documents
export * from './kyc.schema';

// Session management
export * from './sessions.schema';

// Audit and compliance
export * from './audit-logs.schema';

// Communication
export * from './notifications.schema';
export * from './otp.schema';

// Support
export * from './support-requests.schema';

// Access control (RBAC)
export * from './permissions.schema';
export * from './tenants.schema';
export * from './properties.schema';

// Subscriptions
export * from './subscriptions.schema';

// Addons
export * from './addons.schema';

// Biometric authentication
export * from './biometric-challenges.schema';

// MFA backup codes
export * from './mfa-backup-codes.schema';

// Push notifications
export * from './push-subscriptions.schema';

// Pending registrations
export * from './pending-business-registrations.schema';
