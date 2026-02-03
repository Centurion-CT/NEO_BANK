import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { BiometricRepository } from './biometric.repository';
import { EnableBiometricDto } from './dto/enable-biometric.dto';
import { VerifyBiometricDto } from './dto/verify-biometric.dto';
import { BiometricLoginDto } from './dto/biometric-login.dto';
import { IdentityService } from '@modules/identity/identity.service';
import { SessionsService } from '@modules/sessions/sessions.service';

// Challenge expiry time in minutes
const CHALLENGE_EXPIRY_MINUTES = 5;

// Max failed biometric attempts before lockout
const MAX_FAILED_ATTEMPTS = 5;

// Lockout duration in minutes
const LOCKOUT_DURATION_MINUTES = 15;

@Injectable()
export class BiometricService {
  constructor(
    private readonly biometricRepository: BiometricRepository,
    private readonly identityService: IdentityService,
    private readonly sessionsService: SessionsService,
  ) {}

  // =====================
  // REGISTRATION
  // =====================

  /**
   * Enable biometric authentication for a session/device
   * Requires PIN verification for security
   */
  async enableBiometric(
    identityId: string,
    sessionId: string,
    dto: EnableBiometricDto,
  ): Promise<{ biometricToken: string }> {
    // Verify identity exists and get PIN from auth_secrets
    const pinSecret = await this.identityService.getAuthSecret(identityId, 'pin');
    if (!pinSecret) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Verify PIN
    const isPinValid = await argon2.verify(pinSecret.secretHash, dto.pin);
    if (!isPinValid) {
      throw new UnauthorizedException({
        code: 'INVALID_PIN',
        message: 'Invalid PIN',
      });
    }

    // Verify session exists and belongs to identity
    const session = await this.biometricRepository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    if (session.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'SESSION_ACCESS_DENIED',
        message: 'Session does not belong to user',
      });
    }

    if (!session.isActive) {
      throw new BadRequestException({
        code: 'SESSION_INACTIVE',
        message: 'Session is not active',
      });
    }

    // Generate biometric token
    const biometricToken = crypto.randomBytes(32).toString('hex');
    const biometricTokenHash = await argon2.hash(biometricToken);

    // Update session with biometric info
    await this.biometricRepository.updateSessionBiometric(sessionId, {
      biometricEnabled: true,
      biometricType: dto.biometricType,
      biometricTokenHash,
      biometricRegisteredAt: new Date(),
      biometricFailedAttempts: 0,
      biometricLockedUntil: null,
    });

    // Also mark session as trusted since biometric is enabled
    await this.sessionsService.trustDevice(sessionId, identityId);

    return { biometricToken };
  }

  /**
   * Disable biometric authentication for a session
   */
  async disableBiometric(identityId: string, sessionId: string): Promise<void> {
    // Verify session exists and belongs to identity
    const session = await this.biometricRepository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    if (session.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'SESSION_ACCESS_DENIED',
        message: 'Session does not belong to user',
      });
    }

    // Disable biometric
    await this.biometricRepository.updateSessionBiometric(sessionId, {
      biometricEnabled: false,
      biometricType: null,
      biometricTokenHash: null,
      biometricRegisteredAt: null,
      biometricLastUsedAt: null,
      biometricFailedAttempts: 0,
      biometricLockedUntil: null,
    });
  }

  // =====================
  // CHALLENGE-RESPONSE FLOW
  // =====================

  /**
   * Generate a challenge for biometric verification
   */
  async generateChallenge(
    identityId: string,
    sessionId: string,
  ): Promise<{ challengeId: string; challenge: string; expiresAt: Date }> {
    // Verify session exists and has biometric enabled
    const session = await this.biometricRepository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    if (session.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'SESSION_ACCESS_DENIED',
        message: 'Session does not belong to user',
      });
    }

    if (!session.biometricEnabled) {
      throw new BadRequestException({
        code: 'BIOMETRIC_NOT_ENABLED',
        message: 'Biometric is not enabled for this session',
      });
    }

    // Check if biometric is locked
    if (this.isSessionBiometricLocked(session)) {
      const remainingMs = session.biometricLockedUntil!.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      throw new ForbiddenException({
        code: 'BIOMETRIC_LOCKED',
        message: `Biometric is locked. Try again in ${remainingMinutes} minutes.`,
      });
    }

    // Generate challenge
    const challenge = crypto.randomBytes(32).toString('hex');
    const challengeHash = crypto.createHash('sha256').update(challenge).digest('hex');

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + CHALLENGE_EXPIRY_MINUTES);

    // Store challenge
    const storedChallenge = await this.biometricRepository.createChallenge({
      identityId,
      sessionId,
      challengeHash,
      isUsed: false,
      isExpired: false,
      expiresAt,
    });

    return {
      challengeId: storedChallenge.id,
      challenge,
      expiresAt,
    };
  }

  /**
   * Verify a challenge response
   */
  async verifyChallenge(
    identityId: string,
    sessionId: string,
    dto: VerifyBiometricDto,
  ): Promise<{ verified: boolean }> {
    // Get session
    const session = await this.biometricRepository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    if (session.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'SESSION_ACCESS_DENIED',
        message: 'Session does not belong to user',
      });
    }

    // Check if biometric is locked
    if (this.isSessionBiometricLocked(session)) {
      throw new ForbiddenException({
        code: 'BIOMETRIC_LOCKED',
        message: 'Biometric is locked due to too many failed attempts',
      });
    }

    // Find valid challenge
    const challenge = await this.biometricRepository.findValidChallenge(
      dto.challengeId,
      identityId,
      sessionId,
    );

    if (!challenge) {
      await this.handleFailedBiometricAttempt(sessionId);
      throw new BadRequestException({
        code: 'INVALID_CHALLENGE',
        message: 'Challenge is invalid, expired, or already used',
      });
    }

    // Verify the response (hash of challenge should match stored hash)
    const responseHash = crypto.createHash('sha256').update(dto.response).digest('hex');
    if (responseHash !== challenge.challengeHash) {
      await this.handleFailedBiometricAttempt(sessionId);
      throw new BadRequestException({
        code: 'INVALID_RESPONSE',
        message: 'Invalid challenge response',
      });
    }

    // Verify biometric token
    if (!session.biometricTokenHash) {
      throw new BadRequestException({
        code: 'BIOMETRIC_NOT_CONFIGURED',
        message: 'Biometric token not configured for this session',
      });
    }

    const isTokenValid = await argon2.verify(session.biometricTokenHash, dto.biometricToken);
    if (!isTokenValid) {
      await this.handleFailedBiometricAttempt(sessionId);
      throw new UnauthorizedException({
        code: 'INVALID_BIOMETRIC_TOKEN',
        message: 'Invalid biometric token',
      });
    }

    // Mark challenge as used
    await this.biometricRepository.markChallengeAsUsed(dto.challengeId);

    // Reset failed attempts and update last used
    await this.biometricRepository.resetBiometricFailedAttempts(sessionId);
    await this.biometricRepository.updateSessionBiometric(sessionId, {
      biometricLastUsedAt: new Date(),
    });

    return { verified: true };
  }

  // =====================
  // BIOMETRIC LOGIN
  // =====================

  /**
   * Generate a login challenge for biometric authentication
   * This is used for unauthenticated login with biometric
   */
  async generateLoginChallenge(
    sessionId: string,
  ): Promise<{ challengeId: string; challenge: string; expiresAt: Date }> {
    // Get session
    const session = await this.biometricRepository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    if (!session.biometricEnabled) {
      throw new BadRequestException({
        code: 'BIOMETRIC_NOT_ENABLED',
        message: 'Biometric is not enabled for this session',
      });
    }

    if (!session.isTrusted) {
      throw new ForbiddenException({
        code: 'DEVICE_NOT_TRUSTED',
        message: 'Device is not trusted for biometric login',
      });
    }

    // Check if biometric is locked
    if (this.isSessionBiometricLocked(session)) {
      const remainingMs = session.biometricLockedUntil!.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      throw new ForbiddenException({
        code: 'BIOMETRIC_LOCKED',
        message: `Biometric is locked. Try again in ${remainingMinutes} minutes.`,
      });
    }

    // Generate challenge
    const challenge = crypto.randomBytes(32).toString('hex');
    const challengeHash = crypto.createHash('sha256').update(challenge).digest('hex');

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + CHALLENGE_EXPIRY_MINUTES);

    // Store challenge
    const storedChallenge = await this.biometricRepository.createChallenge({
      identityId: session.identityId,
      sessionId,
      challengeHash,
      isUsed: false,
      isExpired: false,
      expiresAt,
    });

    return {
      challengeId: storedChallenge.id,
      challenge,
      expiresAt,
    };
  }

  /**
   * Verify biometric login
   * Returns identity info if successful (for token generation)
   */
  async verifyBiometricLogin(
    dto: BiometricLoginDto,
  ): Promise<{ identityId: string; sessionId: string }> {
    // Get session
    const session = await this.biometricRepository.findSessionById(dto.sessionId);
    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    if (!session.biometricEnabled) {
      throw new BadRequestException({
        code: 'BIOMETRIC_NOT_ENABLED',
        message: 'Biometric is not enabled for this session',
      });
    }

    if (!session.isTrusted) {
      throw new ForbiddenException({
        code: 'DEVICE_NOT_TRUSTED',
        message: 'Device is not trusted for biometric login',
      });
    }

    // Check if biometric is locked
    if (this.isSessionBiometricLocked(session)) {
      throw new ForbiddenException({
        code: 'BIOMETRIC_LOCKED',
        message: 'Biometric is locked due to too many failed attempts',
      });
    }

    // Find valid challenge
    const challenge = await this.biometricRepository.findValidChallenge(
      dto.challengeId,
      session.identityId,
      dto.sessionId,
    );

    if (!challenge) {
      await this.handleFailedBiometricAttempt(dto.sessionId);
      throw new BadRequestException({
        code: 'INVALID_CHALLENGE',
        message: 'Challenge is invalid, expired, or already used',
      });
    }

    // Verify the response
    const responseHash = crypto.createHash('sha256').update(dto.response).digest('hex');
    if (responseHash !== challenge.challengeHash) {
      await this.handleFailedBiometricAttempt(dto.sessionId);
      throw new BadRequestException({
        code: 'INVALID_RESPONSE',
        message: 'Invalid challenge response',
      });
    }

    // Verify biometric token
    if (!session.biometricTokenHash) {
      throw new BadRequestException({
        code: 'BIOMETRIC_NOT_CONFIGURED',
        message: 'Biometric token not configured for this session',
      });
    }

    const isTokenValid = await argon2.verify(session.biometricTokenHash, dto.biometricToken);
    if (!isTokenValid) {
      await this.handleFailedBiometricAttempt(dto.sessionId);
      throw new UnauthorizedException({
        code: 'INVALID_BIOMETRIC_TOKEN',
        message: 'Invalid biometric token',
      });
    }

    // Mark challenge as used
    await this.biometricRepository.markChallengeAsUsed(dto.challengeId);

    // Reset failed attempts and update last used
    await this.biometricRepository.resetBiometricFailedAttempts(dto.sessionId);
    await this.biometricRepository.updateSessionBiometric(dto.sessionId, {
      biometricLastUsedAt: new Date(),
    });

    return {
      identityId: session.identityId,
      sessionId: session.id,
    };
  }

  // =====================
  // STATUS
  // =====================

  /**
   * Get biometric status for a session
   */
  async getBiometricStatus(
    identityId: string,
    sessionId: string,
  ): Promise<{
    enabled: boolean;
    type: string | null;
    registeredAt: Date | null;
    lastUsedAt: Date | null;
    isLocked: boolean;
    lockedUntil: Date | null;
  }> {
    const session = await this.biometricRepository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    if (session.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'SESSION_ACCESS_DENIED',
        message: 'Session does not belong to user',
      });
    }

    return {
      enabled: session.biometricEnabled,
      type: session.biometricType,
      registeredAt: session.biometricRegisteredAt,
      lastUsedAt: session.biometricLastUsedAt,
      isLocked: this.isSessionBiometricLocked(session),
      lockedUntil: session.biometricLockedUntil,
    };
  }

  /**
   * Check if biometric is enabled for a session
   */
  async isBiometricEnabled(sessionId: string): Promise<boolean> {
    const session = await this.biometricRepository.findSessionById(sessionId);
    return session?.biometricEnabled ?? false;
  }

  // =====================
  // SECURITY HELPERS
  // =====================

  /**
   * Handle failed biometric attempt
   */
  async handleFailedBiometricAttempt(sessionId: string): Promise<void> {
    await this.biometricRepository.incrementBiometricFailedAttempts(sessionId);
  }

  /**
   * Check if session's biometric is locked
   */
  isSessionBiometricLocked(session: any): boolean {
    if (!session.biometricLockedUntil) {
      return false;
    }
    return new Date(session.biometricLockedUntil) > new Date();
  }

  /**
   * Clean up expired challenges (scheduled task)
   */
  async cleanupExpiredChallenges(): Promise<void> {
    await this.biometricRepository.expireOldChallenges();
    await this.biometricRepository.deleteExpiredChallenges(24);
  }
}
