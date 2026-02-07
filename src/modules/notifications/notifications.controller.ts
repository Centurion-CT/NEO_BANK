import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators';

// DTOs for push subscriptions
class SubscribePushDto {
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  auth: string;

  @IsOptional()
  @IsNumber()
  expirationTime?: number | null;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

class UnsubscribePushDto {
  @IsString()
  @IsNotEmpty()
  endpoint: string;
}

/**
 * Notifications Controller
 * Notification management endpoints
 */
@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get all notifications
   */
  @Get()
  @ApiOperation({
    summary: 'Get notifications',
    description: 'Returns paginated notifications for the user',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
  })
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const notifications = await this.notificationsService.getNotifications(
      userId,
      limit || 50,
      offset || 0,
    );

    return notifications.map((n) => ({
      id: n.id,
      type: n.type,
      category: n.category,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));
  }

  /**
   * Get unread count
   */
  @Get('unread/count')
  @ApiOperation({
    summary: 'Get unread count',
    description: 'Returns the count of unread notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Count retrieved successfully',
  })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { unreadCount: count };
  }

  /**
   * Get unread notifications
   */
  @Get('unread')
  @ApiOperation({
    summary: 'Get unread notifications',
    description: 'Returns all unread notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
  })
  async getUnread(@CurrentUser('id') userId: string) {
    const notifications = await this.notificationsService.getUnread(userId);
    return notifications.map((n) => ({
      id: n.id,
      type: n.type,
      category: n.category,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt,
    }));
  }

  // ============ Push Notifications ============
  // These routes must come BEFORE :id routes to avoid conflicts

  /**
   * Get push subscription status
   */
  @Get('push/status')
  @ApiOperation({
    summary: 'Get push subscription status',
    description: 'Check if the user has any active push subscriptions',
  })
  @ApiResponse({
    status: 200,
    description: 'Push subscription status retrieved',
  })
  async getPushStatus(@CurrentUser('id') userId: string) {
    const subscriptions = await this.notificationsService.getPushSubscriptions(userId);

    return {
      subscribed: subscriptions.length > 0,
      subscriptionCount: subscriptions.length,
    };
  }

  /**
   * Subscribe to push notifications
   */
  @Post('push/subscribe')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Subscribe to push notifications',
    description: 'Register a push subscription for the authenticated user',
  })
  @ApiResponse({
    status: 201,
    description: 'Push subscription created successfully',
  })
  async subscribeToPush(
    @CurrentUser('id') userId: string,
    @Body() dto: SubscribePushDto,
  ) {
    const subscription = await this.notificationsService.subscribeToPush({
      identityId: userId,
      endpoint: dto.endpoint,
      p256dh: dto.p256dh,
      auth: dto.auth,
      userAgent: dto.userAgent,
      expirationTime: dto.expirationTime ? new Date(dto.expirationTime) : null,
    });

    return {
      success: true,
      message: 'Push subscription created successfully',
      subscriptionId: subscription.id,
    };
  }

  /**
   * Unsubscribe from push notifications
   */
  @Post('push/unsubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unsubscribe from push notifications',
    description: 'Remove a push subscription for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Push subscription removed successfully',
  })
  async unsubscribeFromPush(
    @CurrentUser('id') userId: string,
    @Body() dto: UnsubscribePushDto,
  ) {
    await this.notificationsService.unsubscribeFromPush(dto.endpoint, userId);

    return {
      success: true,
      message: 'Push subscription removed successfully',
    };
  }

  /**
   * Get notification details
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get notification details',
    description: 'Returns details for a specific notification',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification retrieved successfully',
  })
  async getNotification(
    @CurrentUser('id') userId: string,
    @Param('id') notificationId: string,
  ) {
    const n = await this.notificationsService.findById(notificationId, userId);
    return {
      id: n.id,
      type: n.type,
      category: n.category,
      title: n.title,
      body: n.body,
      data: n.data,
      isRead: n.isRead,
      readAt: n.readAt,
      channel: n.channel,
      createdAt: n.createdAt,
    };
  }

  /**
   * Mark notification as read
   */
  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark as read',
    description: 'Mark a notification as read',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
  })
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') notificationId: string,
  ) {
    await this.notificationsService.markAsRead(notificationId, userId);
    return { success: true, message: 'Notification marked as read' };
  }

  /**
   * Mark all notifications as read
   */
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all as read',
    description: 'Mark all notifications as read',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
  })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    await this.notificationsService.markAllAsRead(userId);
    return { success: true, message: 'All notifications marked as read' };
  }

  /**
   * Delete notification
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete notification',
    description: 'Delete a notification',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 204,
    description: 'Notification deleted',
  })
  async deleteNotification(
    @CurrentUser('id') userId: string,
    @Param('id') notificationId: string,
  ) {
    await this.notificationsService.delete(notificationId, userId);
  }
}
