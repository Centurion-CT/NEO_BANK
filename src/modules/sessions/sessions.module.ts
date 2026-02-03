import { Module, Global } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsRepository } from './sessions.repository';

/**
 * Sessions Module
 *
 * Provides session management for user authentication.
 * Global module - can be injected anywhere without importing.
 *
 * Features:
 * - Create and validate sessions
 * - Track device information
 * - Revoke sessions (single or all)
 * - Trust/untrust devices
 * - Session activity tracking
 *
 * SECURITY:
 * - Refresh tokens are hashed before storage
 * - Sessions have expiration
 * - Force logout capability
 */
@Global()
@Module({
  providers: [SessionsService, SessionsRepository],
  exports: [SessionsService],
})
export class SessionsModule {}
