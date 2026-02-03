import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, lt, desc, count, sql } from 'drizzle-orm';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import { sessions, Session, NewSession, identities, personProfiles, authPrincipals } from '@database/schemas';

/**
 * Sessions Repository
 * Handles all database operations for user sessions
 */
@Injectable()
export class SessionsRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new session
   */
  async create(data: NewSession): Promise<Session> {
    const [session] = await this.db.insert(sessions).values(data).returning();
    return session;
  }

  /**
   * Find session by ID
   */
  async findById(id: string): Promise<Session | null> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    return session || null;
  }

  /**
   * Find session by refresh token hash
   */
  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshTokenHash, tokenHash),
          eq(sessions.isActive, true),
        ),
      )
      .limit(1);
    return session || null;
  }

  /**
   * Find all active sessions for an identity
   */
  async findByIdentityId(identityId: string): Promise<Session[]> {
    return this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.identityId, identityId),
          eq(sessions.isActive, true),
        ),
      )
      .orderBy(desc(sessions.lastActivityAt));
  }

  /**
   * Find session by device ID for an identity
   */
  async findByDeviceId(identityId: string, deviceId: string): Promise<Session | null> {
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

  /**
   * Update session
   */
  async update(id: string, data: Partial<Session>): Promise<Session> {
    const [session] = await this.db
      .update(sessions)
      .set(data)
      .where(eq(sessions.id, id))
      .returning();
    return session;
  }

  /**
   * Update last activity timestamp
   */
  async updateLastActivity(id: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(sessions.id, id));
  }

  /**
   * Revoke a session
   */
  async revoke(id: string): Promise<Session> {
    const [session] = await this.db
      .update(sessions)
      .set({
        isActive: false,
        revokedAt: new Date(),
      })
      .where(eq(sessions.id, id))
      .returning();
    return session;
  }

  /**
   * Revoke all sessions for an identity
   */
  async revokeAllForIdentity(identityId: string, exceptSessionId?: string): Promise<number> {
    const conditions = [
      eq(sessions.identityId, identityId),
      eq(sessions.isActive, true),
    ];

    // If exceptSessionId provided, don't revoke that session
    if (exceptSessionId) {
      await this.db
        .update(sessions)
        .set({
          isActive: false,
          revokedAt: new Date(),
        })
        .where(
          and(
            ...conditions,
            // TODO: Add not equal condition for exceptSessionId
          ),
        );
    } else {
      await this.db
        .update(sessions)
        .set({
          isActive: false,
          revokedAt: new Date(),
        })
        .where(and(...conditions));
    }

    return 0; // Drizzle doesn't return count
  }

  /**
   * Trust a device
   */
  async trustDevice(id: string): Promise<Session> {
    const [session] = await this.db
      .update(sessions)
      .set({ isTrusted: true })
      .where(eq(sessions.id, id))
      .returning();
    return session;
  }

  /**
   * Untrust a device
   */
  async untrustDevice(id: string): Promise<Session> {
    const [session] = await this.db
      .update(sessions)
      .set({ isTrusted: false })
      .where(eq(sessions.id, id))
      .returning();
    return session;
  }

  /**
   * Delete expired sessions (cleanup job)
   */
  async deleteExpired(): Promise<void> {
    await this.db
      .delete(sessions)
      .where(lt(sessions.expiresAt, new Date()));
  }

  /**
   * Count active sessions for an identity
   */
  async countActiveSessions(identityId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.identityId, identityId),
          eq(sessions.isActive, true),
        ),
      );
    return result.length;
  }

  /**
   * Find all sessions with pagination, joined with identity info
   */
  async findAllWithIdentity(limit: number, offset: number): Promise<any[]> {
    return this.db
      .select({
        id: sessions.id,
        identityId: sessions.identityId,
        deviceId: sessions.deviceId,
        deviceType: sessions.deviceType,
        deviceName: sessions.deviceName,
        userAgent: sessions.userAgent,
        ipAddress: sessions.ipAddress,
        location: sessions.location,
        isActive: sessions.isActive,
        isTrusted: sessions.isTrusted,
        lastActivityAt: sessions.lastActivityAt,
        expiresAt: sessions.expiresAt,
        revokedAt: sessions.revokedAt,
        createdAt: sessions.createdAt,
        identityStatus: identities.status,
        userFirstName: personProfiles.firstName,
        userLastName: personProfiles.lastName,
      })
      .from(sessions)
      .innerJoin(identities, eq(sessions.identityId, identities.id))
      .leftJoin(personProfiles, eq(personProfiles.identityId, identities.id))
      .orderBy(desc(sessions.lastActivityAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count all sessions
   */
  async countAll(): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(sessions);
    return result?.count ?? 0;
  }

  /**
   * Count active sessions (all users)
   */
  async countAllActive(): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(sessions)
      .where(eq(sessions.isActive, true));
    return result?.count ?? 0;
  }

  /**
   * Count active sessions by device type
   */
  async countByDeviceType(deviceType: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(sessions)
      .where(
        and(
          eq(sessions.deviceType, deviceType as any),
          eq(sessions.isActive, true),
        ),
      );
    return result?.count ?? 0;
  }

  /**
   * Find last N sessions for a specific device (by deviceId)
   */
  async findByDeviceIdHistory(
    identityId: string,
    deviceId: string,
    limit: number = 5,
  ): Promise<Session[]> {
    return this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.identityId, identityId),
          eq(sessions.deviceId, deviceId),
        ),
      )
      .orderBy(desc(sessions.createdAt))
      .limit(limit);
  }

  /**
   * Revoke all active sessions for a device
   */
  async revokeAllForDevice(identityId: string, deviceId: string): Promise<number> {
    const result = await this.db
      .update(sessions)
      .set({
        isActive: false,
        revokedAt: new Date(),
      })
      .where(
        and(
          eq(sessions.identityId, identityId),
          eq(sessions.deviceId, deviceId),
          eq(sessions.isActive, true),
        ),
      );
    return result.rowCount ?? 0;
  }
}
