import { Module } from '@nestjs/common';
import { BiometricController } from './biometric.controller';
import { BiometricService } from './biometric.service';
import { BiometricRepository } from './biometric.repository';
import { IdentityModule } from '@modules/identity/identity.module';
import { SessionsModule } from '@modules/sessions/sessions.module';

/**
 * Biometric Module
 *
 * Handles biometric authentication for trusted devices
 * including fingerprint, Face ID, and Touch ID
 */
@Module({
  imports: [IdentityModule, SessionsModule],
  controllers: [BiometricController],
  providers: [BiometricService, BiometricRepository],
  exports: [BiometricService],
})
export class BiometricModule {}
