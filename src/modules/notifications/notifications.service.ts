import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { Notification, PushSubscription } from '@database/schemas';

export interface CreateNotificationDto {
  identityId: string;
  type: string;
  category: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channel: 'push' | 'email' | 'sms' | 'in_app';
}

/**
 * Notifications Service
 *
 * Business logic for notification operations.
 * Handles multi-channel notification delivery.
 *
 * INTEGRATION NOTES:
 * - Push: Firebase Cloud Messaging (FCM)
 * - Email: SendGrid / SES
 * - SMS: Twilio / Africa's Talking
 */
export interface CreatePushSubscriptionDto {
  identityId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  expirationTime?: Date | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  /**
   * Create and send notification
   */
  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = await this.notificationsRepository.create({
      identityId: dto.identityId,
      type: dto.type,
      category: dto.category,
      title: dto.title,
      body: dto.body,
      data: dto.data,
      channel: dto.channel,
      sentAt: new Date(),
    });

    // In production, dispatch to appropriate channel
    // await this.dispatchToChannel(notification);

    return notification;
  }

  /**
   * Get notification by ID with ownership verification
   */
  async findById(id: string, identityId: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findById(id);

    if (!notification) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
      });
    }

    if (notification.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'NOTIFICATION_ACCESS_DENIED',
        message: 'Access denied to this notification',
      });
    }

    return notification;
  }

  /**
   * Get notifications for an identity
   */
  async getNotifications(
    identityId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<Notification[]> {
    return this.notificationsRepository.findByIdentityId(identityId, limit, offset);
  }

  /**
   * Get unread notifications
   */
  async getUnread(identityId: string): Promise<Notification[]> {
    return this.notificationsRepository.findUnreadByIdentityId(identityId);
  }

  /**
   * Get unread count
   */
  async getUnreadCount(identityId: string): Promise<number> {
    return this.notificationsRepository.countUnread(identityId);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, identityId: string): Promise<Notification> {
    // Verify ownership
    await this.findById(id, identityId);
    return this.notificationsRepository.markAsRead(id);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(identityId: string): Promise<void> {
    return this.notificationsRepository.markAllAsRead(identityId);
  }

  /**
   * Delete notification
   */
  async delete(id: string, identityId: string): Promise<void> {
    // Verify ownership
    await this.findById(id, identityId);
    return this.notificationsRepository.delete(id);
  }

  /**
   * Send transaction notification
   * Helper method for common notification types
   */
  async sendTransactionNotification(
    identityId: string,
    type: 'credit' | 'debit',
    amount: string,
    currency: string,
    description: string,
  ): Promise<void> {
    const title = type === 'credit' ? 'Money Received' : 'Money Sent';
    const body =
      type === 'credit'
        ? `You received ${currency} ${amount}. ${description}`
        : `You sent ${currency} ${amount}. ${description}`;

    await this.create({
      identityId,
      type: 'transaction',
      category: 'transactions',
      title,
      body,
      data: { type, amount, currency, description },
      channel: 'push',
    });

    // Also send in-app notification
    await this.create({
      identityId,
      type: 'transaction',
      category: 'transactions',
      title,
      body,
      data: { type, amount, currency, description },
      channel: 'in_app',
    });
  }

  /**
   * Send security alert
   */
  async sendSecurityAlert(
    identityId: string,
    alertType: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    const alertMessages: Record<string, { title: string; body: string }> = {
      new_login: {
        title: 'New Login Detected',
        body: 'A new login to your account was detected.',
      },
      password_changed: {
        title: 'PIN Changed',
        body: 'Your account PIN was successfully changed.',
      },
      failed_login: {
        title: 'Failed Login Attempt',
        body: 'Someone tried to access your account with an incorrect PIN.',
      },
      device_added: {
        title: 'New Device Added',
        body: 'A new device was added to your account.',
      },
    };

    const message = alertMessages[alertType] || {
      title: 'Security Alert',
      body: 'A security event occurred on your account.',
    };

    // Send via multiple channels for security alerts
    await Promise.all([
      this.create({
        identityId,
        type: 'security',
        category: 'security',
        title: message.title,
        body: message.body,
        data: { alertType, ...details },
        channel: 'push',
      }),
      this.create({
        identityId,
        type: 'security',
        category: 'security',
        title: message.title,
        body: message.body,
        data: { alertType, ...details },
        channel: 'email',
      }),
    ]);
  }

  // ============ Push Subscriptions ============

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush(dto: CreatePushSubscriptionDto): Promise<PushSubscription> {
    this.logger.log(`Creating push subscription for identity ${dto.identityId}`);

    const subscription = await this.notificationsRepository.createPushSubscription({
      identityId: dto.identityId,
      endpoint: dto.endpoint,
      p256dh: dto.p256dh,
      auth: dto.auth,
      userAgent: dto.userAgent,
      expirationTime: dto.expirationTime,
    });

    this.logger.log(`Push subscription created: ${subscription.id}`);
    return subscription;
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPush(endpoint: string, identityId: string): Promise<void> {
    this.logger.log(`Removing push subscription for endpoint: ${endpoint}`);

    // Verify the subscription belongs to the user
    const subscription = await this.notificationsRepository.findPushSubscriptionByEndpoint(endpoint);

    if (!subscription) {
      this.logger.warn(`Push subscription not found for endpoint: ${endpoint}`);
      return; // Silently return if not found
    }

    if (subscription.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'PUSH_SUBSCRIPTION_ACCESS_DENIED',
        message: 'Access denied to this push subscription',
      });
    }

    await this.notificationsRepository.deletePushSubscriptionByEndpoint(endpoint);
    this.logger.log(`Push subscription removed successfully`);
  }

  /**
   * Get push subscriptions for a user
   */
  async getPushSubscriptions(identityId: string): Promise<PushSubscription[]> {
    return this.notificationsRepository.findPushSubscriptionsByIdentityId(identityId);
  }
}
