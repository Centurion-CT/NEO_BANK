import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gt, lt, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import { otps, Otp, NewOtp } from '@database/schemas';

/**
 * OTP Repository
 * Handles all database operations for OTPs
 */
@Injectable()
export class OtpRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new OTP
   */
  async create(data: NewOtp): Promise<Otp> {
    const [otp] = await this.db.insert(otps).values(data).returning();
    return otp;
  }

  /**
   * Find OTP by ID
   */
  async findById(id: string): Promise<Otp | null> {
    const [otp] = await this.db
      .select()
      .from(otps)
      .where(eq(otps.id, id))
      .limit(1);
    return otp || null;
  }

  /**
   * Find valid (non-expired, non-verified) OTP by target and purpose
   */
  async findValidOtp(
    target: string,
    purpose: string,
  ): Promise<Otp | null> {
    const [otp] = await this.db
      .select()
      .from(otps)
      .where(
        and(
          eq(otps.target, target),
          eq(otps.purpose, purpose as any),
          gt(otps.expiresAt, new Date()),
          isNull(otps.verifiedAt),
        ),
      )
      .orderBy(otps.createdAt)
      .limit(1);
    return otp || null;
  }

  /**
   * Find valid OTP by identity ID and purpose
   */
  async findValidOtpByIdentityId(
    identityId: string,
    purpose: string,
  ): Promise<Otp | null> {
    const [otp] = await this.db
      .select()
      .from(otps)
      .where(
        and(
          eq(otps.identityId, identityId),
          eq(otps.purpose, purpose as any),
          gt(otps.expiresAt, new Date()),
          isNull(otps.verifiedAt),
        ),
      )
      .orderBy(otps.createdAt)
      .limit(1);
    return otp || null;
  }

  /**
   * Increment attempts
   */
  async incrementAttempts(id: string): Promise<Otp> {
    const [otp] = await this.db
      .update(otps)
      .set({ attempts: sql`${otps.attempts} + 1` })
      .where(eq(otps.id, id))
      .returning();
    return otp;
  }

  /**
   * Mark OTP as verified
   */
  async markVerified(id: string): Promise<Otp> {
    const [otp] = await this.db
      .update(otps)
      .set({ verifiedAt: new Date() })
      .where(eq(otps.id, id))
      .returning();
    return otp;
  }

  /**
   * Invalidate all pending OTPs for a target and purpose
   * (Used when requesting a new OTP)
   */
  async invalidatePendingOtps(target: string, purpose: string): Promise<void> {
    await this.db
      .update(otps)
      .set({ expiresAt: new Date() }) // Set expiry to now to invalidate
      .where(
        and(
          eq(otps.target, target),
          eq(otps.purpose, purpose as any),
          gt(otps.expiresAt, new Date()),
          isNull(otps.verifiedAt),
        ),
      );
  }

  /**
   * Delete expired OTPs (cleanup job)
   */
  async deleteExpired(): Promise<number> {
    const result = await this.db
      .delete(otps)
      .where(
        and(
          lt(otps.expiresAt, new Date()),
          // Keep verified OTPs for audit trail for 24 hours
          isNull(otps.verifiedAt),
        ),
      );
    return 0; // Drizzle doesn't return count, would need raw query
  }
}
