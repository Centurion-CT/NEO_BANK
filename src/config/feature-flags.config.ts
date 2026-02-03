import { registerAs } from '@nestjs/config';

/**
 * Feature Flags Configuration
 * Controls migration-related feature toggles for the identity/authentication refactoring
 *
 * Migration Phases:
 * 1. USE_NEW_IDENTITY_TABLES = false, DUAL_WRITE_ENABLED = false - Legacy mode
 * 2. USE_NEW_IDENTITY_TABLES = false, DUAL_WRITE_ENABLED = true  - Dual write mode
 * 3. USE_NEW_IDENTITY_TABLES = true, READ_FROM_NEW_TABLES = true - New tables active
 * 4. Legacy tables deprecated and eventually removed
 */
export default registerAs('featureFlags', () => ({
  /**
   * When true, new identity tables are used for writes
   * DEFAULT: true (new app with no existing users)
   */
  useNewIdentityTables: process.env.USE_NEW_IDENTITY_TABLES !== 'false',

  /**
   * When true, writes go to both legacy and new tables
   * DEFAULT: false (no dual-write needed for new app)
   */
  dualWriteEnabled: process.env.DUAL_WRITE_ENABLED === 'true',

  /**
   * When true, reads come from new tables instead of legacy
   * DEFAULT: true (new app uses new tables)
   */
  readFromNewTables: process.env.READ_FROM_NEW_TABLES !== 'false',

  /**
   * When true, enables new authentication flow using auth_principals and auth_secrets
   * DEFAULT: true (new app uses new auth flow)
   */
  useNewAuthFlow: process.env.USE_NEW_AUTH_FLOW !== 'false',

  /**
   * When true, enables comprehensive audit logging to new event tables
   * DEFAULT: true (new app has full audit logging)
   */
  enableIdentityEventLogging: process.env.ENABLE_IDENTITY_EVENT_LOGGING !== 'false',
}));

/**
 * Type definition for feature flags
 */
export interface FeatureFlagsConfig {
  useNewIdentityTables: boolean;
  dualWriteEnabled: boolean;
  readFromNewTables: boolean;
  useNewAuthFlow: boolean;
  enableIdentityEventLogging: boolean;
}
