import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CreatePlanDto, UpdatePlanDto } from './dto/create-plan.dto';
import { UpdateSubscriptionStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('Subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // =====================
  // PUBLIC ENDPOINTS
  // =====================

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'List all available subscription plans (public)' })
  @ApiResponse({ status: 200, description: 'List of available plans' })
  async findAllPlans() {
    const plans = await this.subscriptionsService.findAllPlans();
    return { plans };
  }

  @Get('plans/:id')
  @Public()
  @ApiOperation({ summary: 'Get plan details by ID (public)' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponse({ status: 200, description: 'Plan details' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async findPlanById(@Param('id') id: string) {
    const plan = await this.subscriptionsService.findPlanById(id);
    return { plan };
  }

  // =====================
  // USER SUBSCRIPTION ENDPOINTS
  // =====================

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to a plan' })
  @ApiResponse({ status: 201, description: 'Successfully subscribed' })
  @ApiResponse({ status: 409, description: 'Already subscribed' })
  async subscribe(
    @CurrentUser('id') userId: string,
    @Body() dto: SubscribeDto,
  ) {
    const subscription = await this.subscriptionsService.subscribe(userId, dto);
    return { message: 'Successfully subscribed', subscription };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user subscription' })
  @ApiResponse({ status: 200, description: 'Current subscription details' })
  async getMySubscription(@CurrentUser('id') userId: string) {
    const { subscription, plan } = await this.subscriptionsService.getIdentitySubscriptionWithPlan(userId);
    return { subscription, plan };
  }

  @Post('change-plan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change subscription plan (upgrade/downgrade)' })
  @ApiResponse({ status: 200, description: 'Plan changed successfully' })
  @ApiResponse({ status: 404, description: 'No active subscription' })
  async changePlan(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePlanDto,
  ) {
    const subscription = await this.subscriptionsService.changePlan(userId, dto);
    return { message: 'Plan changed successfully', subscription };
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  @ApiResponse({ status: 404, description: 'No active subscription' })
  async cancelSubscription(
    @CurrentUser('id') userId: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    const subscription = await this.subscriptionsService.cancelSubscription(userId, dto);
    return { message: 'Subscription cancelled', subscription };
  }

  @Patch('auto-renewal')
  @ApiOperation({ summary: 'Toggle auto-renewal' })
  @ApiResponse({ status: 200, description: 'Auto-renewal toggled' })
  async toggleAutoRenewal(
    @CurrentUser('id') userId: string,
    @Body() body: { autoRenewal: boolean },
  ) {
    const subscription = await this.subscriptionsService.toggleAutoRenewal(userId, body.autoRenewal);
    return { message: 'Auto-renewal updated', subscription };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get subscription history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Subscription history' })
  async getSubscriptionHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.subscriptionsService.getSubscriptionHistory(userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return result;
  }

  // =====================
  // ADMIN ENDPOINTS
  // =====================

  @Get('admin/plans')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List all plans (including inactive) - Admin' })
  @ApiResponse({ status: 200, description: 'All plans' })
  async findAllPlansAdmin() {
    const plans = await this.subscriptionsService.findAllPlansAdmin();
    return { plans };
  }

  @Post('admin/plans')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create a new subscription plan - Super Admin' })
  @ApiResponse({ status: 201, description: 'Plan created successfully' })
  @ApiResponse({ status: 409, description: 'Plan type already exists' })
  async createPlan(@Body() dto: CreatePlanDto) {
    const plan = await this.subscriptionsService.createPlan(dto);
    return { message: 'Plan created successfully', plan };
  }

  @Patch('admin/plans/:id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update a subscription plan - Admin' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponse({ status: 200, description: 'Plan updated successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    const plan = await this.subscriptionsService.updatePlan(id, dto);
    return { message: 'Plan updated successfully', plan };
  }

  @Delete('admin/plans/:id')
  @Roles('super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (deactivate) a subscription plan - Super Admin' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponse({ status: 200, description: 'Plan deleted successfully' })
  @ApiResponse({ status: 403, description: 'Cannot delete basic plan' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async deletePlan(@Param('id') id: string) {
    await this.subscriptionsService.deletePlan(id);
    return { message: 'Plan deleted successfully' };
  }

  @Get('admin/subscriptions')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List all user subscriptions - Admin' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'planId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'All subscriptions' })
  async listAllSubscriptions(
    @Query('status') status?: string,
    @Query('planId') planId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.subscriptionsService.listAllSubscriptions({
      status,
      planId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return result;
  }

  @Patch('admin/subscriptions/:id/status')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update subscription status - Admin' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({ status: 200, description: 'Subscription status updated' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async updateSubscriptionStatus(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionStatusDto,
  ) {
    const subscription = await this.subscriptionsService.updateSubscriptionStatus(id, dto);
    return { message: 'Subscription status updated', subscription };
  }

  @Get('admin/stats')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get subscription statistics - Admin' })
  @ApiResponse({ status: 200, description: 'Subscription statistics' })
  async getSubscriptionStats() {
    const stats = await this.subscriptionsService.getSubscriptionStats();
    return { stats };
  }
}
