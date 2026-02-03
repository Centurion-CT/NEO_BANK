import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { SessionsRepository } from './sessions.repository';
import { Session } from '@database/schemas';

interface CreateSessionOptions {
  identityId: string;
  refreshToken: string;
  deviceId?: string;
  deviceType?: 'web' | 'ios' | 'android' | 'desktop' | 'unknown';
  deviceName?: string;
  userAgent?: string;
  ipAddress: string;
  location?: string;
  expiresInDays?: number;
}

export interface SessionInfo {
  id: string;
  deviceId: string | null;
  deviceType: string;
  deviceName: string | null;
  ipAddress: string;
  location: string | null;
  isTrusted: boolean;
  lastActivityAt: Date;
  createdAt: Date;
  isCurrentSession?: boolean;
}

/**
 * Sessions Service
 *
 * Manages user sessions for security tracking and device management.
 *
 * SECURITY:
 * - Refresh tokens are hashed before storage
 * - Sessions can be revoked individually or all at once
 * - Devices can be marked as trusted
 * - Session activity is tracked
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private readonly sessionsRepository: SessionsRepository) {}

  /**
   * Create a new session
   */
  async createSession(options: CreateSessionOptions): Promise<Session> {
    const {
      identityId,
      refreshToken,
      deviceId,
      deviceType = 'unknown',
      deviceName,
      userAgent,
      ipAddress,
      location,
      expiresInDays = 7,
    } = options;

    // Hash the refresh token
    const refreshTokenHash = this.hashToken(refreshToken);

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // If same device already has a session, revoke it
    if (deviceId) {
      const existingSession = await this.sessionsRepository.findByDeviceId(identityId, deviceId);
      if (existingSession) {
        await this.sessionsRepository.revoke(existingSession.id);
        this.logger.log(`Revoked existing session for device ${deviceId}`);
      }
    }

    // Create new session
    const session = await this.sessionsRepository.create({
      identityId,
      refreshTokenHash,
      deviceId,
      deviceType,
      deviceName,
      userAgent,
      ipAddress,
      location,
      expiresAt,
    });

    this.logger.log(`Session created for identity ${identityId} from ${ipAddress}`);

    return session;
  }

  /**
   * Validate a session by refresh token
   */
  async validateSession(refreshToken: string): Promise<Session | null> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.sessionsRepository.findByTokenHash(tokenHash);

    if (!session) {
      return null;
    }

    // Check if expired
    if (new Date() > session.expiresAt) {
      await this.sessionsRepository.revoke(session.id);
      return null;
    }

    // Update last activity
    await this.sessionsRepository.updateLastActivity(session.id);

    return session;
  }

  /**
   * Update session with new refresh token (on token refresh)
   */
  async rotateToken(sessionId: string, newRefreshToken: string, expiresInDays: number = 7): Promise<Session> {
    const newTokenHash = this.hashToken(newRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    return this.sessionsRepository.update(sessionId, {
      refreshTokenHash: newTokenHash,
      expiresAt,
      lastActivityAt: new Date(),
    });
  }

  /**
   * Get all active sessions for an identity
   */
  async getIdentitySessions(identityId: string, currentSessionId?: string): Promise<SessionInfo[]> {
    const sessions = await this.sessionsRepository.findByIdentityId(identityId);

    return sessions.map((session) => ({
      id: session.id,
      deviceId: session.deviceId,
      deviceType: session.deviceType,
      deviceName: session.deviceName,
      ipAddress: session.ipAddress,
      location: session.location,
      isTrusted: session.isTrusted,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
      isCurrentSession: currentSessionId ? session.id === currentSessionId : false,
    }));
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string, identityId: string): Promise<void> {
    const session = await this.sessionsRepository.findById(sessionId);

    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    if (session.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'SESSION_ACCESS_DENIED',
        message: 'Cannot revoke another identity\'s session',
      });
    }

    await this.sessionsRepository.revoke(sessionId);
    this.logger.log(`Session ${sessionId} revoked for identity ${identityId}`);
  }

  /**
   * Revoke all sessions for an identity (force logout)
   */
  async revokeAllSessions(identityId: string, exceptCurrentSession?: string): Promise<void> {
    await this.sessionsRepository.revokeAllForIdentity(identityId, exceptCurrentSession);
    this.logger.log(`All sessions revoked for identity ${identityId}`);
  }

  /**
   * Trust a device
   */
  async trustDevice(sessionId: string, identityId: string): Promise<void> {
    const session = await this.sessionsRepository.findById(sessionId);

    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    if (session.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'SESSION_ACCESS_DENIED',
        message: 'Cannot trust another identity\'s device',
      });
    }

    await this.sessionsRepository.trustDevice(sessionId);
    this.logger.log(`Device trusted for session ${sessionId}`);
  }

  /**
   * Untrust a device
   */
  async untrustDevice(sessionId: string, identityId: string): Promise<void> {
    const session = await this.sessionsRepository.findById(sessionId);

    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }

    if (session.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'SESSION_ACCESS_DENIED',
        message: 'Cannot untrust another identity\'s device',
      });
    }

    await this.sessionsRepository.untrustDevice(sessionId);
    this.logger.log(`Device untrusted for session ${sessionId}`);
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(identityId: string, deviceId: string): Promise<boolean> {
    const session = await this.sessionsRepository.findByDeviceId(identityId, deviceId);
    return session?.isTrusted ?? false;
  }

  /**
   * Get session count for an identity
   */
  async getSessionCount(identityId: string): Promise<number> {
    return this.sessionsRepository.countActiveSessions(identityId);
  }

  /**
   * Get last N sessions for a device
   */
  async getDeviceSessions(identityId: string, deviceId: string, limit: number = 5) {
    const sessions = await this.sessionsRepository.findByDeviceIdHistory(identityId, deviceId, limit);
    return sessions.map((session) => ({
      id: session.id,
      deviceType: session.deviceType,
      deviceName: session.deviceName,
      ipAddress: session.ipAddress,
      location: session.location,
      isActive: session.isActive,
      isTrusted: session.isTrusted,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
      revokedAt: session.revokedAt,
    }));
  }

  /**
   * Revoke all sessions for a specific device
   */
  async revokeAllDeviceSessions(identityId: string, deviceId: string): Promise<number> {
    const count = await this.sessionsRepository.revokeAllForDevice(identityId, deviceId);
    this.logger.log(`Revoked ${count} sessions for device ${deviceId} of identity ${identityId}`);
    return count;
  }

  // ============================================================================
  // Admin Methods
  // ============================================================================

  /**
   * List all sessions with identity info (admin)
   */
  async findAllSessions(limit: number, offset: number) {
    const [data, total, active, desktop, mobile] = await Promise.all([
      this.sessionsRepository.findAllWithIdentity(limit, offset),
      this.sessionsRepository.countAll(),
      this.sessionsRepository.countAllActive(),
      this.sessionsRepository.countByDeviceType('desktop'),
      this.sessionsRepository.countByDeviceType('ios')
        .then(async (ios) => ios + await this.sessionsRepository.countByDeviceType('android')),
    ]);
    return { data, total, active, desktop, mobile };
  }

  /**
   * Revoke a session by ID (admin — no ownership check)
   */
  async revokeSessionAdmin(sessionId: string): Promise<void> {
    const session = await this.sessionsRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found',
      });
    }
    await this.sessionsRepository.revoke(sessionId);
    this.logger.log(`Admin revoked session ${sessionId}`);
  }

  /**
   * Revoke all sessions for an identity (admin)
   */
  async revokeAllSessionsAdmin(identityId: string): Promise<void> {
    await this.sessionsRepository.revokeAllForIdentity(identityId);
    this.logger.log(`Admin revoked all sessions for identity ${identityId}`);
  }

  /**
   * Hash a token using SHA-256
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
