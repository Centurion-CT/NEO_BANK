import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto } from './dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * Create a new tenant
   * Requires: admin or super_admin role
   */
  @Post()
  @Roles('admin', 'super_admin')
  async createTenant(@Body() dto: CreateTenantDto) {
    const tenant = await this.tenantsService.createTenant(dto);
    return {
      message: 'Tenant created successfully',
      tenant,
    };
  }

  /**
   * Get all tenants
   * Requires: admin or super_admin role
   */
  @Get()
  @Roles('admin', 'super_admin')
  async getAllTenants(
    @Query('type') type?: 'BUSINESS_BANKING' | 'SUBSCRIPTION_WORKSPACE' | 'PARTNER',
    @Query('status') status?: 'active' | 'all',
  ) {
    let tenants;
    if (type) {
      tenants = await this.tenantsService.findTenantsByType(type);
    } else if (status === 'active') {
      tenants = await this.tenantsService.findActiveTenants();
    } else {
      tenants = await this.tenantsService.findAllTenants();
    }
    return { tenants };
  }

  /**
   * Get tenant by ID
   * Requires: admin or super_admin role
   */
  @Get(':id')
  @Roles('admin', 'super_admin')
  async getTenantById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findTenantById(id);
  }

  /**
   * Get tenants by owner
   * Requires: admin or super_admin role
   */
  @Get('owner/:ownerId')
  @Roles('admin', 'super_admin')
  async getTenantsByOwner(@Param('ownerId', ParseUUIDPipe) ownerId: string) {
    return this.tenantsService.findTenantsByOwner(ownerId);
  }

  /**
   * Update tenant
   * Requires: admin or super_admin role
   */
  @Patch(':id')
  @Roles('admin', 'super_admin')
  async updateTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    const tenant = await this.tenantsService.updateTenant(id, dto);
    return {
      message: 'Tenant updated successfully',
      tenant,
    };
  }

  /**
   * Suspend tenant
   * Requires: admin or super_admin role
   */
  @Post(':id/suspend')
  @Roles('admin', 'super_admin')
  async suspendTenant(@Param('id', ParseUUIDPipe) id: string) {
    const tenant = await this.tenantsService.suspendTenant(id);
    return {
      message: 'Tenant suspended successfully',
      tenant,
    };
  }

  /**
   * Activate tenant
   * Requires: admin or super_admin role
   */
  @Post(':id/activate')
  @Roles('admin', 'super_admin')
  async activateTenant(@Param('id', ParseUUIDPipe) id: string) {
    const tenant = await this.tenantsService.activateTenant(id);
    return {
      message: 'Tenant activated successfully',
      tenant,
    };
  }

  /**
   * Delete tenant
   * Requires: super_admin role
   */
  @Delete(':id')
  @Roles('super_admin')
  async deleteTenant(@Param('id', ParseUUIDPipe) id: string) {
    await this.tenantsService.deleteTenant(id);
    return {
      message: 'Tenant deleted successfully',
    };
  }
}
