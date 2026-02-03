import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { OtpRepository } from './otp.repository';
import { MailService } from '@modules/mail/mail.service';

export type OtpPurpose =
  | 'email_verification'
  | 'phone_verification'
  | 'pin_reset'
  | 'transaction_confirmation'
  | 'login_mfa'
  | 'mfa_setup'
  | 'sensitive_action';

interface GenerateOtpOptions {
  identityId?: string;
  target: string; // email or phone
  purpose: OtpPurpose;
  expiresInMinutes?: number;
  length?: number;
}

interface VerifyOtpOptions {
  target: string;
  purpose: OtpPurpose;
  code: string;
}

interface SendOtpOptions {
  target: string;
  purpose: OtpPurpose;
  firstName?: string;
}

/**
 * OTP Service
 *
 * Generates, stores, and verifies one-time passwords.
 * Integrates with mail service for email delivery.
 *
 * SECURITY:
 * - OTP codes are hashed before storage
 * - OTPs have short expiration (default 10 minutes)
 * - Max 3 verification attempts
 * - Old OTPs invalidated on new request
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly otpRepository: OtpRepository,
    private readonly mailService: MailService,
  ) {}

  /**
   * Generate and store a new OTP
   * Returns the plain OTP code (to be sent to user)
   */
  async generateOtp(options: GenerateOtpOptions): Promise<string> {
    const {
      identityId,
      target,
      purpose,
      expiresInMinutes = 10,
      length = 6,
    } = options;

    // Invalidate any existing pending OTPs
    await this.otpRepository.invalidatePendingOtps(target, purpose);

    // Generate random numeric OTP
    const code = this.generateRandomCode(length);

    // Hash the code before storing
    const codeHash = await this.hashCode(code);

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    // Store OTP
    await this.otpRepository.create({
      identityId,
      target,
      purpose,
      codeHash,
      expiresAt,
    });

    this.logger.log(`OTP generated for ${this.maskTarget(target)} (${purpose})`);

    return code;
  }

  /**
   * Send OTP via email
   * The OTP is generated and stored synchronously (so it's ready for verification).
   * The actual email dispatch is fire-and-forget so the caller isn't blocked by SMTP latency.
   */
  async sendEmailOtp(options: SendOtpOptions & { identityId?: string }): Promise<void> {
    const { target, purpose, firstName, identityId } = options;

    // Generate OTP (must complete before returning — the code needs to be in the DB)
    const code = await this.generateOtp({
      identityId,
      target,
      purpose,
    });

    // Map purpose to human-readable text
    const purposeText = this.getPurposeText(purpose);

    console.log(`Generated OTP for ${target}: ${code} (Purpose: ${purposeText})`);

    // Fire-and-forget: dispatch email without awaiting SMTP
    this.mailService
      .sendOtpEmail(target, {
        firstName: firstName || 'User',
        otp: code,
        purpose: purposeText,
        expiresIn: 10,
      })
      .then(() => {
        this.logger.log(`OTP email sent to ${this.maskTarget(target)}`);
      })
      .catch((error) => {
        this.logger.error(
          `Failed to send OTP email to ${this.maskTarget(target)}: ${error.message}`,
        );
      });
  }

  /**
   * Verify an OTP code
   * Returns true if valid, throws error if invalid
   */
  async verifyOtp(options: VerifyOtpOptions): Promise<boolean> {
    const { target, purpose, code } = options;

    // Find valid OTP
    const otp = await this.otpRepository.findValidOtp(target, purpose);

    if (!otp) {
      throw new BadRequestException({
        code: 'OTP_NOT_FOUND',
        message: 'No valid OTP found. Please request a new one.',
      });
    }

    // Check if max attempts exceeded
    if (otp.attempts >= otp.maxAttempts) {
      throw new BadRequestException({
        code: 'OTP_MAX_ATTEMPTS',
        message: 'Maximum verification attempts exceeded. Please request a new OTP.',
      });
    }

    // Verify the code
    const isValid = await this.verifyCode(code, otp.codeHash);

    if (!isValid) {
      // Increment attempts
      await this.otpRepository.incrementAttempts(otp.id);

      const remainingAttempts = otp.maxAttempts - otp.attempts - 1;
      throw new BadRequestException({
        code: 'INVALID_OTP',
        message: `Invalid OTP code. ${remainingAttempts} attempts remaining.`,
      });
    }

    // Mark as verified
    await this.otpRepository.markVerified(otp.id);

    this.logger.log(`OTP verified for ${this.maskTarget(target)} (${purpose})`);

    return true;
  }

  /**
   * Check if a valid OTP exists for the target
   */
  async hasValidOtp(target: string, purpose: OtpPurpose): Promise<boolean> {
    const otp = await this.otpRepository.findValidOtp(target, purpose);
    return !!otp && otp.attempts < otp.maxAttempts;
  }

  /**
   * Generate a random numeric code
   */
  private generateRandomCode(length: number): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    const randomNum = crypto.randomInt(min, max);
    return randomNum.toString();
  }

  /**
   * Hash the OTP code using Argon2
   */
  private async hashCode(code: string): Promise<string> {
    return argon2.hash(code, {
      type: argon2.argon2id,
      memoryCost: 16384, // Lighter than PIN hashing for faster verification
      timeCost: 2,
      parallelism: 1,
    });
  }

  /**
   * Verify code against hash
   */
  private async verifyCode(code: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, code);
  }

  /**
   * Mask target for logging (privacy)
   */
  private maskTarget(target: string): string {
    if (target.includes('@')) {
      // Email
      const [local, domain] = target.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    }
    // Phone
    return `${target.substring(0, 4)}****${target.slice(-2)}`;
  }

  /**
   * Get human-readable purpose text
   */
  private getPurposeText(purpose: OtpPurpose): string {
    const purposeMap: Record<OtpPurpose, string> = {
      email_verification: 'Email Verification',
      phone_verification: 'Phone Verification',
      pin_reset: 'PIN Reset',
      transaction_confirmation: 'Transaction Confirmation',
      login_mfa: 'Login Verification',
      mfa_setup: 'MFA Setup Verification',
      sensitive_action: 'Security Verification',
    };
    return purposeMap[purpose] || 'Verification';
  }
}
