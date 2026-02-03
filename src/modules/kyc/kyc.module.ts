import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { KycRepository } from './kyc.repository';
import { IdentityModule } from '@modules/identity/identity.module';
import { BunnyStorageService } from '@common/services/bunny-storage.service';

/**
 * KYC Module
 *
 * Handles:
 * - Document uploads (file → Bunny CDN)
 * - Digital identity verification (BVN/NIN via Qoreid)
 * - Tier upgrades
 * - Compliance checks
 *
 * MICROSERVICE NOTE:
 * Uses repository pattern for data access.
 * Can be extracted as standalone Identity Verification Service.
 * Integrates with external KYC providers.
 */
@Module({
  imports: [IdentityModule, ConfigModule],
  controllers: [KycController],
  providers: [KycService, KycRepository, BunnyStorageService],
  exports: [KycService],
})
export class KycModule {}
