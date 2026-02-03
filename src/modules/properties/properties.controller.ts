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
import { PropertiesService } from './properties.service';
import {
  CreatePropertyDto,
  UpdatePropertyDto,
  AssignPropertyToIdentityDto,
} from './dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@Controller('properties')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  // =========================================================================
  // PROPERTIES CRUD
  // =========================================================================

  /**
   * Create a new property
   * Requires: admin or super_admin role
   */
  @Post()
  @Roles('admin', 'super_admin')
  async createProperty(@Body() dto: CreatePropertyDto) {
    const property = await this.propertiesService.createProperty(dto);
    return {
      message: 'Property created successfully',
      property,
    };
  }

  /**
   * Get all properties
   * Requires: admin or super_admin role
   */
  @Get()
  @Roles('admin', 'super_admin')
  async getAllProperties(
    @Query('type') type?: 'PHYSICAL' | 'VIRTUAL',
    @Query('subtype') subtype?: string,
    @Query('status') status?: 'active' | 'all',
    @Query('tenantId') tenantId?: string,
  ) {
    let properties;
    if (tenantId) {
      properties = await this.propertiesService.findPropertiesByTenant(tenantId);
    } else if (type) {
      properties = await this.propertiesService.findPropertiesByType(type);
    } else if (subtype) {
      properties = await this.propertiesService.findPropertiesBySubtype(
        subtype as
          | 'BRANCH'
          | 'AGENT_LOCATION'
          | 'OUTLET'
          | 'MOBILE_APP'
          | 'WEB_APP'
          | 'USSD_CHANNEL'
          | 'PARTNER_CHANNEL'
          | 'INTERNAL_SYSTEM',
      );
    } else if (status === 'active') {
      properties = await this.propertiesService.findActiveProperties();
    } else {
      properties = await this.propertiesService.findAllProperties();
    }
    return { properties };
  }

  /**
   * Get assignable properties (for dropdowns)
   * Requires: admin, super_admin, or support_agent role
   */
  @Get('assignable')
  @Roles('admin', 'super_admin', 'support_agent')
  async getAssignableProperties() {
    return this.propertiesService.findAssignableProperties();
  }

  /**
   * Get agent-accessible properties
   * Requires: admin or super_admin role
   */
  @Get('agent-accessible')
  @Roles('admin', 'super_admin')
  async getAgentAccessibleProperties() {
    return this.propertiesService.findAgentAccessibleProperties();
  }

  /**
   * Get property by ID
   * Requires: admin or super_admin role
   */
  @Get(':id')
  @Roles('admin', 'super_admin')
  async getPropertyById(@Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.findPropertyById(id);
  }

  /**
   * Get property by code
   * Requires: admin or super_admin role
   */
  @Get('code/:code')
  @Roles('admin', 'super_admin')
  async getPropertyByCode(@Param('code') code: string) {
    return this.propertiesService.findPropertyByCode(code);
  }

  /**
   * Update property
   * Requires: admin or super_admin role
   */
  @Patch(':id')
  @Roles('admin', 'super_admin')
  async updateProperty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    const property = await this.propertiesService.updateProperty(id, dto);
    return {
      message: 'Property updated successfully',
      property,
    };
  }

  /**
   * Update property status
   * Requires: admin or super_admin role
   */
  @Post(':id/status')
  @Roles('admin', 'super_admin')
  async updatePropertyStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
  ) {
    const property = await this.propertiesService.updatePropertyStatus(id, status);
    return {
      message: `Property status updated to ${status}`,
      property,
    };
  }

  /**
   * Delete property
   * Requires: super_admin role
   */
  @Delete(':id')
  @Roles('super_admin')
  async deleteProperty(@Param('id', ParseUUIDPipe) id: string) {
    await this.propertiesService.deleteProperty(id);
    return {
      message: 'Property deleted successfully',
    };
  }

  // =========================================================================
  // IDENTITY PROPERTIES
  // =========================================================================

  /**
   * Assign property to identity
   * Requires: admin or super_admin role
   */
  @Post('assign')
  @Roles('admin', 'super_admin')
  async assignPropertyToIdentity(@Body() dto: AssignPropertyToIdentityDto) {
    const relationship = await this.propertiesService.assignPropertyToIdentity(
      dto.identityId,
      dto.propertyId,
      dto.relationshipType,
    );
    return {
      message: 'Property assigned to identity successfully',
      relationship,
    };
  }

  /**
   * Remove property from identity
   * Requires: admin or super_admin role
   */
  @Delete('identity/:identityId/property/:propertyId')
  @Roles('admin', 'super_admin')
  async removePropertyFromIdentity(
    @Param('identityId', ParseUUIDPipe) identityId: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ) {
    await this.propertiesService.removePropertyFromIdentity(identityId, propertyId);
    return {
      message: 'Property removed from identity successfully',
    };
  }

  /**
   * Get properties for an identity
   * Requires: admin or super_admin role
   */
  @Get('identity/:identityId')
  @Roles('admin', 'super_admin')
  async getIdentityProperties(
    @Param('identityId', ParseUUIDPipe) identityId: string,
  ) {
    return this.propertiesService.getIdentityProperties(identityId);
  }

  /**
   * Get primary property for an identity
   * Requires: admin or super_admin role
   */
  @Get('identity/:identityId/primary')
  @Roles('admin', 'super_admin')
  async getIdentityPrimaryProperty(
    @Param('identityId', ParseUUIDPipe) identityId: string,
  ) {
    return this.propertiesService.getIdentityPrimaryProperty(identityId);
  }

  /**
   * Get identities at a property
   * Requires: admin or super_admin role
   */
  @Get(':id/identities')
  @Roles('admin', 'super_admin')
  async getIdentitiesAtProperty(@Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.getIdentitiesAtProperty(id);
  }
}
