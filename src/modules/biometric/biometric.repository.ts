import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, lte, gt } from 'drizzle-orm';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import { sessions, Session } from '@database/schemas/sessions.schema';
import {
  biometricChallenges,
  BiometricChallenge,
  NewBiometricChallenge,
} from '@database/schemas/biometric-challenges.schema';

@Injectable()
export class BiometricRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  // =====================
  // SESSIONS (Biometric fields)
  // =====================

  async findSessionById(sessionId: string): Promise<Session | null> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    return session || null;
  }

  async findActiveSessionByIdentityIdAndDevice(
    identityId: string,
    deviceId: string,
  ): Promise<Session | null> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.identityId, identityId),
          eq(sessions.deviceId, deviceId),
          eq(sessions.isActive, true),
        ),
      )
      .limit(1);
    return session || null;
  }

  async updateSessionBiometric(
    sessionId: string,
    data: {
      biometricEnabled?: boolean;
      biometricType?: 'fingerprint' | 'face_id' | 'touch_id' | null;
      biometricTokenHash?: string | null;
      biometricRegisteredAt?: Date | null;
      biometricLastUsedAt?: Date | null;
      biometricFailedAttempts?: number;
      biometricLockedUntil?: Date | null;
    },
  ): Promise<Session> {
    const [session] = await this.db
      .update(sessions)
      .set(data)
      .where(eq(sessions.id, sessionId))
      .returning();
    return session;
  }

  async incrementBiometricFailedAttempts(sessionId: string): Promise<Session> {
    const session = await this.findSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const newAttempts = session.biometricFailedAttempts + 1;

    // Lock biometric for 15 minutes after 5 failed attempts
    let biometricLockedUntil = null;
    if (newAttempts >= 5) {
      biometricLockedUntil = new Date();
      biometricLockedUntil.setMinutes(biometricLockedUntil.getMinutes() + 15);
    }

    return this.updateSessionBiometric(sessionId, {
      biometricFailedAttempts: newAttempts,
      biometricLockedUntil,
    });
  }

  async resetBiometricFailedAttempts(sessionId: string): Promise<void> {
    await this.updateSessionBiometric(sessionId, {
      biometricFailedAttempts: 0,
      biometricLockedUntil: null,
    });
  }

  // =====================
  // BIOMETRIC CHALLENGES
  // =====================

  async createChallenge(
    data: Omit<NewBiometricChallenge, 'id' | 'createdAt'>,
  ): Promise<BiometricChallenge> {
    const [challenge] = await this.db.insert(biometricChallenges).values(data).returning();
    return challenge;
  }

  async findChallengeById(challengeId: string): Promise<BiometricChallenge | null> {
    const [challenge] = await this.db
      .select()
      .from(biometricChallenges)
      .where(eq(biometricChallenges.id, challengeId))
      .limit(1);
    return challenge || null;
  }

  async findValidChallenge(
    challengeId: string,
    identityId: string,
    sessionId: string,
  ): Promise<BiometricChallenge | null> {
    const now = new Date();
    const [challenge] = await this.db
      .select()
      .from(biometricChallenges)
      .where(
        and(
          eq(biometricChallenges.id, challengeId),
          eq(biometricChallenges.identityId, identityId),
          eq(biometricChallenges.sessionId, sessionId),
          eq(biometricChallenges.isUsed, false),
          eq(biometricChallenges.isExpired, false),
          gt(biometricChallenges.expiresAt, now),
        ),
      )
      .limit(1);
    return challenge || null;
  }

  async markChallengeAsUsed(challengeId: string): Promise<void> {
    await this.db
      .update(biometricChallenges)
      .set({ isUsed: true, usedAt: new Date() })
      .where(eq(biometricChallenges.id, challengeId));
  }

  async markChallengeAsExpired(challengeId: string): Promise<void> {
    await this.db
      .update(biometricChallenges)
      .set({ isExpired: true })
      .where(eq(biometricChallenges.id, challengeId));
  }

  async expireOldChallenges(): Promise<void> {
    const now = new Date();
    await this.db
      .update(biometricChallenges)
      .set({ isExpired: true })
      .where(
        and(
          eq(biometricChallenges.isExpired, false),
          lte(biometricChallenges.expiresAt, now),
        ),
      );
  }

  async deleteExpiredChallenges(olderThanHours: number = 24): Promise<void> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - olderThanHours);

    await this.db
      .delete(biometricChallenges)
      .where(
        and(
          eq(biometricChallenges.isExpired, true),
          lte(biometricChallenges.createdAt, cutoff),
        ),
      );
  }
}
