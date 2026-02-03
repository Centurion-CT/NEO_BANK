import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';

/**
 * Notifications Module
 *
 * Handles:
 * - Push notifications
 * - Email notifications
 * - SMS notifications
 * - In-app notifications
 * - Notification preferences
 *
 * MICROSERVICE NOTE:
 * Uses repository pattern for data access.
 * Can be extracted as standalone Notification Service.
 * Integrates with external providers (FCM, SendGrid, Twilio).
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository],
  exports: [NotificationsService],
})
export class NotificationsModule {}
