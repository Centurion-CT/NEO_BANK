import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IdentityService } from './identity.service';
import { IdentityRepository } from './identity.repository';
import { ProfileController } from './profile.controller';
import { BunnyStorageService } from '@common/services/bunny-storage.service';
import { PermissionsModule } from '@modules/permissions/permissions.module';
import { OtpModule } from '@modules/otp/otp.module';

/**
 * Identity Module
 *
 * Handles:
 * - Identity lifecycle management
 * - Person and business profiles
 * - Authentication principals and secrets
 * - Identity events and audit trail
 * - Profile management (via ProfileController)
 *
 * Uses the compliance data model:
 * - Identities: Root identity object
 * - PersonProfiles: Natural person data
 * - BusinessProfiles: Legal entity data
 * - AuthPrincipals: Login identifiers (email, phone, username)
 * - AuthSecrets: Credentials (PIN, transaction PIN, TOTP)
 * - KycProfiles: KYC tier and status
 *
 * MICROSERVICE NOTE:
 * Designed for extraction as standalone Identity Service.
 * Uses repository pattern for clean data access separation.
 */
@Module({
  imports: [
    ConfigModule,
    forwardRef(() => PermissionsModule),
    forwardRef(() => OtpModule),
  ],
  controllers: [ProfileController],
  providers: [IdentityService, IdentityRepository, BunnyStorageService],
  exports: [IdentityService, IdentityRepository],
})
export class IdentityModule {}
