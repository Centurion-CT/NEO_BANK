import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import {
  Notification,
  NewNotification,
  notifications,
  PushSubscription,
  NewPushSubscription,
  pushSubscriptions,
} from '@database/schemas';

/**
 * Notifications Repository
 *
 * Data access layer for notifications table.
 * Follows Repository Pattern for clean separation.
 */
@Injectable()
export class NotificationsRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new notification
   */
  async create(data: Omit<NewNotification, 'id' | 'createdAt'>): Promise<Notification> {
    const [notification] = await this.db
      .insert(notifications)
      .values(data)
      .returning();
    return notification;
  }

  /**
   * Find notification by ID
   */
  async findById(id: string): Promise<Notification | null> {
    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);
    return notification || null;
  }

  /**
   * Find all notifications for an identity
   */
  async findByIdentityId(
    identityId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<Notification[]> {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.identityId, identityId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Find unread notifications for an identity
   */
  async findUnreadByIdentityId(identityId: string): Promise<Notification[]> {
    return this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.identityId, identityId),
          eq(notifications.isRead, false),
        ),
      )
      .orderBy(desc(notifications.createdAt));
  }

  /**
   * Count unread notifications
   */
  async countUnread(identityId: string): Promise<number> {
    const result = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.identityId, identityId),
          eq(notifications.isRead, false),
        ),
      );
    return result.length;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<Notification> {
    const [notification] = await this.db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(notifications.id, id))
      .returning();
    return notification;
  }

  /**
   * Mark all notifications as read for an identity
   */
  async markAllAsRead(identityId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notifications.identityId, identityId),
          eq(notifications.isRead, false),
        ),
      );
  }

  /**
   * Delete notification
   */
  async delete(id: string): Promise<void> {
    await this.db
      .delete(notifications)
      .where(eq(notifications.id, id));
  }

  // ============ Push Subscriptions ============

  /**
   * Create a new push subscription
   */
  async createPushSubscription(
    data: Omit<NewPushSubscription, 'id' | 'createdAt'>,
  ): Promise<PushSubscription> {
    const [subscription] = await this.db
      .insert(pushSubscriptions)
      .values(data)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          p256dh: data.p256dh,
          auth: data.auth,
          userAgent: data.userAgent,
          expirationTime: data.expirationTime,
          lastUsedAt: new Date(),
        },
      })
      .returning();
    return subscription;
  }

  /**
   * Find push subscription by endpoint
   */
  async findPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscription | null> {
    const [subscription] = await this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);
    return subscription || null;
  }

  /**
   * Find all push subscriptions for an identity
   */
  async findPushSubscriptionsByIdentityId(identityId: string): Promise<PushSubscription[]> {
    return this.db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.identityId, identityId));
  }

  /**
   * Delete push subscription by endpoint
   */
  async deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }

  /**
   * Update last used timestamp for push subscription
   */
  async updatePushSubscriptionLastUsed(endpoint: string): Promise<void> {
    await this.db
      .update(pushSubscriptions)
      .set({ lastUsedAt: new Date() })
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }
}
