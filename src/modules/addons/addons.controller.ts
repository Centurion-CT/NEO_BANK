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
import { AddonsService } from './addons.service';
import {
  CreateAddonDto,
  UpdateAddonDto,
  CreateAddonPlanDto,
  UpdateAddonPlanDto,
  SubscribeAddonDto,
  ChangeAddonPlanDto,
  CancelAddonSubscriptionDto,
  UpdateAddonSubscriptionStatusDto,
} from './dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('Addons')
@Controller('addons')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AddonsController {
  constructor(private readonly addonsService: AddonsService) {}

  // =====================
  // PUBLIC STATIC ROUTES (must come before parameterized routes)
  // =====================

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all available addons (public)' })
  @ApiResponse({ status: 200, description: 'List of available addons' })
  async findAllAddons() {
    const addons = await this.addonsService.findAllAddons();
    return { addons };
  }

  @Get('slug/:slug')
  @Public()
  @ApiOperation({ summary: 'Get addon details by slug (public)' })
  @ApiParam({ name: 'slug', description: 'Addon slug' })
  @ApiResponse({ status: 200, description: 'Addon details' })
  @ApiResponse({ status: 404, description: 'Addon not found' })
  async findAddonBySlug(@Param('slug') slug: string) {
    const addon = await this.addonsService.findAddonBySlug(slug);
    return { addon };
  }

  @Get('plans/:id')
  @Public()
  @ApiOperation({ summary: 'Get addon plan details by ID (public)' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponse({ status: 200, description: 'Plan details' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async findAddonPlanById(@Param('id') id: string) {
    const plan = await this.addonsService.findAddonPlanById(id);
    return { plan };
  }

  // =====================
  // ADMIN ENDPOINTS (must come before parameterized routes)
  // =====================

  @Get('admin/list')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List all addons (including inactive) - Admin' })
  @ApiResponse({ status: 200, description: 'All addons' })
  async findAllAddonsAdmin() {
    const addons = await this.addonsService.findAllAddonsAdmin();
    return { addons };
  }

  @Get('admin/plans')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List all addon plans - Admin' })
  @ApiResponse({ status: 200, description: 'All addon plans' })
  async findAllAddonPlansAdmin() {
    const plans = await this.addonsService.findAllAddonPlansAdmin();
    return { plans };
  }

  @Get('admin/subscriptions')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List all addon subscriptions - Admin' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'addonId', required: false })
  @ApiQuery({ name: 'planId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'All addon subscriptions' })
  async listAllAddonSubscriptions(
    @Query('status') status?: string,
    @Query('addonId') addonId?: string,
    @Query('planId') planId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.addonsService.getAllAddonSubscriptions({
      status,
      addonId,
      planId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return result;
  }

  @Get('admin/stats')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get addon statistics - Admin' })
  @ApiResponse({ status: 200, description: 'Addon statistics' })
  async getAddonStats() {
    const stats = await this.addonsService.getAddonStats();
    return { stats };
  }

  @Get('admin/addons/:addonId/plans')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List all plans for an addon (including inactive) - Admin' })
  @ApiParam({ name: 'addonId', description: 'Addon ID' })
  @ApiResponse({ status: 200, description: 'All addon plans' })
  async findAddonPlansAdmin(@Param('addonId') addonId: string) {
    const plans = await this.addonsService.findAddonPlansAdmin(addonId);
    return { plans };
  }

  @Post('admin/addons')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create a new addon - Super Admin' })
  @ApiResponse({ status: 201, description: 'Addon created successfully' })
  @ApiResponse({ status: 409, description: 'Addon slug already exists' })
  async createAddon(@Body() dto: CreateAddonDto) {
    const addon = await this.addonsService.createAddon(dto);
    return { message: 'Addon created successfully', addon };
  }

  @Patch('admin/addons/:id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update an addon - Admin' })
  @ApiParam({ name: 'id', description: 'Addon ID' })
  @ApiResponse({ status: 200, description: 'Addon updated successfully' })
  @ApiResponse({ status: 404, description: 'Addon not found' })
  async updateAddon(@Param('id') id: string, @Body() dto: UpdateAddonDto) {
    const addon = await this.addonsService.updateAddon(id, dto);
    return { message: 'Addon updated successfully', addon };
  }

  @Delete('admin/addons/:id')
  @Roles('super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (deactivate) an addon - Super Admin' })
  @ApiParam({ name: 'id', description: 'Addon ID' })
  @ApiResponse({ status: 200, description: 'Addon deleted successfully' })
  @ApiResponse({ status: 404, description: 'Addon not found' })
  async deleteAddon(@Param('id') id: string) {
    await this.addonsService.deleteAddon(id);
    return { message: 'Addon deleted successfully' };
  }

  @Post('admin/plans')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create a new addon plan - Super Admin' })
  @ApiResponse({ status: 201, description: 'Plan created successfully' })
  @ApiResponse({ status: 404, description: 'Addon not found' })
  async createAddonPlan(@Body() dto: CreateAddonPlanDto) {
    const plan = await this.addonsService.createAddonPlan(dto);
    return { message: 'Addon plan created successfully', plan };
  }

  @Patch('admin/plans/:id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update an addon plan - Admin' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponse({ status: 200, description: 'Plan updated successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async updateAddonPlan(@Param('id') id: string, @Body() dto: UpdateAddonPlanDto) {
    const plan = await this.addonsService.updateAddonPlan(id, dto);
    return { message: 'Addon plan updated successfully', plan };
  }

  @Delete('admin/plans/:id')
  @Roles('super_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (deactivate) an addon plan - Super Admin' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponse({ status: 200, description: 'Plan deleted successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async deleteAddonPlan(@Param('id') id: string) {
    await this.addonsService.deleteAddonPlan(id);
    return { message: 'Addon plan deleted successfully' };
  }

  @Patch('admin/subscriptions/:id/status')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update addon subscription status - Admin' })
  @ApiParam({ name: 'id', description: 'Subscription ID' })
  @ApiResponse({ status: 200, description: 'Subscription status updated' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async updateAddonSubscriptionStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAddonSubscriptionStatusDto,
  ) {
    const subscription = await this.addonsService.updateAddonSubscriptionStatus(id, dto);
    return { message: 'Addon subscription status updated', subscription };
  }

  // =====================
  // USER ENDPOINTS (must come before parameterized routes)
  // =====================

  @Get('me/subscriptions')
  @ApiOperation({ summary: 'Get all user addon subscriptions' })
  @ApiResponse({ status: 200, description: 'User addon subscriptions' })
  async getMyAddonSubscriptions(@CurrentUser('id') userId: string) {
    const subscriptions = await this.addonsService.getIdentityAddonSubscriptions(userId);
    return { subscriptions };
  }

  @Get('me/status')
  @ApiOperation({ summary: 'Get all addons with subscription status for current user' })
  @ApiResponse({ status: 200, description: 'Addons with subscription status' })
  async getAddonsWithStatus(@CurrentUser('id') userId: string) {
    const addons = await this.addonsService.getAddonsWithSubscriptionStatus(userId);
    return { addons };
  }

  @Get('me/history')
  @ApiOperation({ summary: 'Get addon subscription history' })
  @ApiQuery({ name: 'addonId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Addon subscription history' })
  async getAddonSubscriptionHistory(
    @CurrentUser('id') userId: string,
    @Query('addonId') addonId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.addonsService.getAddonSubscriptionHistory(userId, {
      addonId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return result;
  }

  // =====================
  // PARAMETERIZED ROUTES (must come last to avoid catching static routes)
  // =====================

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get addon details by ID (public)' })
  @ApiParam({ name: 'id', description: 'Addon ID' })
  @ApiResponse({ status: 200, description: 'Addon details' })
  @ApiResponse({ status: 404, description: 'Addon not found' })
  async findAddonById(@Param('id') id: string) {
    const addon = await this.addonsService.findAddonById(id);
    return { addon };
  }

  @Get(':addonId/plans')
  @Public()
  @ApiOperation({ summary: 'List all plans for an addon (public)' })
  @ApiParam({ name: 'addonId', description: 'Addon ID' })
  @ApiResponse({ status: 200, description: 'List of addon plans' })
  @ApiResponse({ status: 404, description: 'Addon not found' })
  async findAddonPlans(@Param('addonId') addonId: string) {
    const plans = await this.addonsService.findAddonPlans(addonId);
    return { plans };
  }

  @Get(':addonId/subscription')
  @ApiOperation({ summary: 'Get user subscription for specific addon' })
  @ApiParam({ name: 'addonId', description: 'Addon ID' })
  @ApiResponse({ status: 200, description: 'Addon subscription details' })
  async getAddonSubscription(
    @CurrentUser('id') userId: string,
    @Param('addonId') addonId: string,
  ) {
    const subscription = await this.addonsService.getAddonSubscription(userId, addonId);
    return { subscription };
  }

  @Post(':addonId/subscribe')
  @ApiOperation({ summary: 'Subscribe to an addon' })
  @ApiParam({ name: 'addonId', description: 'Addon ID' })
  @ApiResponse({ status: 201, description: 'Successfully subscribed' })
  @ApiResponse({ status: 409, description: 'Already subscribed' })
  async subscribeToAddon(
    @CurrentUser('id') userId: string,
    @Param('addonId') addonId: string,
    @Body() dto: SubscribeAddonDto,
  ) {
    const subscription = await this.addonsService.subscribeToAddon(userId, addonId, dto);
    return { message: 'Successfully subscribed to addon', subscription };
  }

  @Post(':addonId/change-plan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change addon subscription plan' })
  @ApiParam({ name: 'addonId', description: 'Addon ID' })
  @ApiResponse({ status: 200, description: 'Plan changed successfully' })
  @ApiResponse({ status: 404, description: 'No active subscription' })
  async changeAddonPlan(
    @CurrentUser('id') userId: string,
    @Param('addonId') addonId: string,
    @Body() dto: ChangeAddonPlanDto,
  ) {
    const subscription = await this.addonsService.changeAddonPlan(userId, addonId, dto);
    return { message: 'Addon plan changed successfully', subscription };
  }

  @Post(':addonId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel addon subscription' })
  @ApiParam({ name: 'addonId', description: 'Addon ID' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  @ApiResponse({ status: 404, description: 'No active subscription' })
  async cancelAddonSubscription(
    @CurrentUser('id') userId: string,
    @Param('addonId') addonId: string,
    @Body() dto: CancelAddonSubscriptionDto,
  ) {
    const subscription = await this.addonsService.cancelAddonSubscription(userId, addonId, dto);
    return { message: 'Addon subscription cancelled', subscription };
  }

  @Patch(':addonId/auto-renewal')
  @ApiOperation({ summary: 'Toggle addon auto-renewal' })
  @ApiParam({ name: 'addonId', description: 'Addon ID' })
  @ApiResponse({ status: 200, description: 'Auto-renewal toggled' })
  async toggleAddonAutoRenewal(
    @CurrentUser('id') userId: string,
    @Param('addonId') addonId: string,
  ) {
    const subscription = await this.addonsService.toggleAddonAutoRenewal(userId, addonId);
    return { message: 'Auto-renewal updated', subscription };
  }
}
