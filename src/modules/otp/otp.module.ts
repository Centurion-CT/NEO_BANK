import { Module, Global } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpRepository } from './otp.repository';
import { MailModule } from '@modules/mail/mail.module';

/**
 * OTP Module
 *
 * Provides OTP generation, storage, and verification.
 * Global module - can be injected anywhere without importing.
 *
 * Features:
 * - Generate 6-digit numeric OTPs
 * - Store hashed OTPs with expiration
 * - Verify OTPs with attempt limiting
 * - Send OTPs via email
 *
 * SECURITY:
 * - OTP codes hashed with Argon2
 * - 10-minute expiration by default
 * - Max 3 verification attempts
 * - Old OTPs invalidated on new request
 */
@Global()
@Module({
  imports: [MailModule],
  providers: [OtpService, OtpRepository],
  exports: [OtpService],
})
export class OtpModule {}
