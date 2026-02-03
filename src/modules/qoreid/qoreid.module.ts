import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { QoreidService } from './qoreid.service';

/**
 * Qoreid Module
 *
 * Handles digital identity verification via Qoreid API.
 *
 * Supported Verifications:
 * - NIN (National Identity Number)
 * - BVN (Bank Verification Number)
 * - Driver's License
 * - International Passport
 * - Voter's Card
 *
 * CONFIGURATION:
 * Set QOREID_CLIENT_ID and QOREID_CLIENT_SECRET in environment.
 */
@Global()
@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 second timeout
      maxRedirects: 3,
    }),
  ],
  providers: [QoreidService],
  exports: [QoreidService],
})
export class QoreidModule {}
