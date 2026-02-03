import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import { devices, Device, NewDevice } from '@database/schemas';

/**
 * Devices Repository
 * Handles all database operations for device management
 */
@Injectable()
export class DevicesRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new device record
   */
  async create(data: NewDevice): Promise<Device> {
    const [device] = await this.db.insert(devices).values(data).returning();
    return device;
  }

  /**
   * Find device by ID
   */
  async findById(id: string): Promise<Device | null> {
    const [device] = await this.db
      .select()
      .from(devices)
      .where(eq(devices.id, id))
      .limit(1);
    return device || null;
  }

  /**
   * Find device by fingerprint for an identity
   */
  async findByFingerprint(identityId: string, fingerprint: string): Promise<Device | null> {
    const [device] = await this.db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.identityId, identityId),
          eq(devices.deviceFingerprint, fingerprint),
          eq(devices.isRevoked, false),
        ),
      )
      .limit(1);
    return device || null;
  }

  /**
   * Find all devices for an identity
   */
  async findByIdentityId(identityId: string): Promise<Device[]> {
    return this.db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.identityId, identityId),
          eq(devices.isRevoked, false),
        ),
      )
      .orderBy(desc(devices.lastActiveAt));
  }

  /**
   * Find the bound device for an identity (only one can be bound)
   */
  async findBoundDevice(identityId: string): Promise<Device | null> {
    const [device] = await this.db
      .select()
      .from(devices)
      .where(
        and(
          eq(devices.identityId, identityId),
          eq(devices.isBound, true),
          eq(devices.isRevoked, false),
        ),
      )
      .limit(1);
    return device || null;
  }

  /**
   * Update device
   */
  async update(id: string, data: Partial<Device>): Promise<Device> {
    const [device] = await this.db
      .update(devices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(devices.id, id))
      .returning();
    return device;
  }

  /**
   * Bind a device (mark as bound for login restriction)
   */
  async bindDevice(id: string): Promise<Device> {
    const [device] = await this.db
      .update(devices)
      .set({
        isBound: true,
        boundAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(devices.id, id))
      .returning();
    return device;
  }

  /**
   * Unbind a device
   */
  async unbindDevice(id: string): Promise<Device> {
    const [device] = await this.db
      .update(devices)
      .set({
        isBound: false,
        boundAt: null,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, id))
      .returning();
    return device;
  }

  /**
   * Unbind all devices for an identity
   */
  async unbindAllDevices(identityId: string): Promise<void> {
    await this.db
      .update(devices)
      .set({
        isBound: false,
        boundAt: null,
        updatedAt: new Date(),
      })
      .where(eq(devices.identityId, identityId));
  }

  /**
   * Trust a device
   */
  async trustDevice(id: string, expiresAt?: Date): Promise<Device> {
    const [device] = await this.db
      .update(devices)
      .set({
        isTrusted: true,
        trustedAt: new Date(),
        trustExpiresAt: expiresAt || null,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, id))
      .returning();
    return device;
  }

  /**
   * Untrust a device
   */
  async untrustDevice(id: string): Promise<Device> {
    const [device] = await this.db
      .update(devices)
      .set({
        isTrusted: false,
        trustedAt: null,
        trustExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, id))
      .returning();
    return device;
  }

  /**
   * Update last activity
   */
  async updateLastActivity(id: string, ipAddress: string): Promise<void> {
    await this.db
      .update(devices)
      .set({
        lastActiveAt: new Date(),
        lastIpAddress: ipAddress,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, id));
  }

  /**
   * Revoke a device
   */
  async revokeDevice(id: string, reason?: string): Promise<Device> {
    const [device] = await this.db
      .update(devices)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
        isBound: false,
        boundAt: null,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, id))
      .returning();
    return device;
  }

  /**
   * Create or update device (upsert)
   */
  async upsert(identityId: string, fingerprint: string, data: Partial<NewDevice>): Promise<Device> {
    const existing = await this.findByFingerprint(identityId, fingerprint);

    if (existing) {
      return this.update(existing.id, {
        ...data,
        lastActiveAt: new Date(),
      });
    }

    return this.create({
      identityId,
      deviceFingerprint: fingerprint,
      ...data,
    } as NewDevice);
  }
}
