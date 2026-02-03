import { Module, Global } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesRepository } from './devices.repository';
import { DevicesController } from './devices.controller';
import { SessionsModule } from '@modules/sessions/sessions.module';

/**
 * Devices Module
 *
 * Provides device management for user authentication.
 * Global module - can be injected anywhere without importing.
 *
 * Features:
 * - Register and track devices
 * - Device binding (mobile-only) - restricts login to a single device
 * - Device trust management
 * - Device revocation
 * - View and manage sessions per device
 *
 * SECURITY:
 * - Device binding ensures users can only login from their bound device
 * - Only mobile devices (iOS/Android) can be bound
 * - Bound device must be verified on every login attempt
 */
@Global()
@Module({
  imports: [SessionsModule],
  controllers: [DevicesController],
  providers: [DevicesService, DevicesRepository],
  exports: [DevicesService],
})
export class DevicesModule {}
