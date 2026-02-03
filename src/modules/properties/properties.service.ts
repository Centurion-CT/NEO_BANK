import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PropertiesRepository } from './properties.repository';
import { CreatePropertyDto, UpdatePropertyDto } from './dto';
import { Property, IdentityProperty } from '@database/schemas/properties.schema';

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(private readonly propertiesRepository: PropertiesRepository) {}

  // =========================================================================
  // PROPERTIES
  // =========================================================================

  /**
   * Create a new property
   */
  async createProperty(dto: CreatePropertyDto): Promise<Property> {
    // Check if property code already exists
    const existingCode = await this.propertiesRepository.codeExists(dto.propertyCode);
    if (existingCode) {
      throw new ConflictException({
        code: 'PROPERTY_CODE_EXISTS',
        message: 'A property with this code already exists',
      });
    }

    // Validate subtype matches type
    const physicalSubtypes = ['BRANCH', 'AGENT_LOCATION', 'OUTLET'];
    const virtualSubtypes = ['MOBILE_APP', 'WEB_APP', 'USSD_CHANNEL', 'PARTNER_CHANNEL', 'INTERNAL_SYSTEM'];

    if (dto.propertyType === 'PHYSICAL' && !physicalSubtypes.includes(dto.propertySubtype)) {
      throw new BadRequestException({
        code: 'INVALID_SUBTYPE',
        message: `Subtype ${dto.propertySubtype} is not valid for PHYSICAL property type`,
      });
    }

    if (dto.propertyType === 'VIRTUAL' && !virtualSubtypes.includes(dto.propertySubtype)) {
      throw new BadRequestException({
        code: 'INVALID_SUBTYPE',
        message: `Subtype ${dto.propertySubtype} is not valid for VIRTUAL property type`,
      });
    }

    // Virtual channels should not allow agent access by default
    const allowsAgentAccess = dto.allowsAgentAccess ?? (dto.propertyType === 'PHYSICAL');

    const property = await this.propertiesRepository.create({
      propertyType: dto.propertyType,
      propertySubtype: dto.propertySubtype,
      propertyCode: dto.propertyCode,
      name: dto.name,
      tenantId: dto.tenantId,
      status: 'ACTIVE',
      isAssignable: dto.isAssignable ?? true,
      allowsAgentAccess,
      metadata: dto.metadata,
    });

    this.logger.log(`Property created: ${property.id} (${property.propertyCode})`);
    return property;
  }

  /**
   * Update a property
   */
  async updateProperty(id: string, dto: UpdatePropertyDto): Promise<Property> {
    const existing = await this.propertiesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property not found',
      });
    }

    const updated = await this.propertiesRepository.update(id, {
      ...(dto.name && { name: dto.name }),
      ...(dto.tenantId !== undefined && { tenantId: dto.tenantId }),
      ...(dto.status && { status: dto.status }),
      ...(dto.isAssignable !== undefined && { isAssignable: dto.isAssignable }),
      ...(dto.allowsAgentAccess !== undefined && { allowsAgentAccess: dto.allowsAgentAccess }),
      ...(dto.metadata && { metadata: dto.metadata }),
    });

    this.logger.log(`Property updated: ${id}`);
    return updated;
  }

  /**
   * Find property by ID
   */
  async findPropertyById(id: string): Promise<Property> {
    const property = await this.propertiesRepository.findById(id);
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property not found',
      });
    }
    return property;
  }

  /**
   * Find property by code
   */
  async findPropertyByCode(code: string): Promise<Property> {
    const property = await this.propertiesRepository.findByCode(code);
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property not found',
      });
    }
    return property;
  }

  /**
   * Find properties by tenant
   */
  async findPropertiesByTenant(tenantId: string): Promise<Property[]> {
    return this.propertiesRepository.findByTenant(tenantId);
  }

  /**
   * Find properties by type
   */
  async findPropertiesByType(propertyType: 'PHYSICAL' | 'VIRTUAL'): Promise<Property[]> {
    return this.propertiesRepository.findByType(propertyType);
  }

  /**
   * Find properties by subtype
   */
  async findPropertiesBySubtype(
    propertySubtype:
      | 'BRANCH'
      | 'AGENT_LOCATION'
      | 'OUTLET'
      | 'MOBILE_APP'
      | 'WEB_APP'
      | 'USSD_CHANNEL'
      | 'PARTNER_CHANNEL'
      | 'INTERNAL_SYSTEM',
  ): Promise<Property[]> {
    return this.propertiesRepository.findBySubtype(propertySubtype);
  }

  /**
   * Find all properties
   */
  async findAllProperties(): Promise<Property[]> {
    return this.propertiesRepository.findAll();
  }

  /**
   * Find all active properties
   */
  async findActiveProperties(): Promise<Property[]> {
    return this.propertiesRepository.findAllActive();
  }

  /**
   * Find assignable properties
   */
  async findAssignableProperties(): Promise<Property[]> {
    return this.propertiesRepository.findAssignable();
  }

  /**
   * Find properties that allow agent access
   */
  async findAgentAccessibleProperties(): Promise<Property[]> {
    return this.propertiesRepository.findAgentAccessible();
  }

  /**
   * Update property status
   */
  async updatePropertyStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
  ): Promise<Property> {
    const existing = await this.propertiesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property not found',
      });
    }

    const updated = await this.propertiesRepository.updateStatus(id, status);
    this.logger.log(`Property ${id} status updated to ${status}`);
    return updated;
  }

  /**
   * Check if property exists
   */
  async propertyExists(id: string): Promise<boolean> {
    return this.propertiesRepository.exists(id);
  }

  /**
   * Delete a property (use with caution)
   */
  async deleteProperty(id: string): Promise<void> {
    const existing = await this.propertiesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property not found',
      });
    }

    await this.propertiesRepository.delete(id);
    this.logger.log(`Property deleted: ${id}`);
  }

  // =========================================================================
  // IDENTITY PROPERTIES
  // =========================================================================

  /**
   * Assign a property to an identity
   */
  async assignPropertyToIdentity(
    identityId: string,
    propertyId: string,
    relationshipType: 'ONBOARDED_AT' | 'PRIMARY_PROPERTY' | 'SERVICED_BY',
  ): Promise<IdentityProperty> {
    // Check if property exists
    const property = await this.propertiesRepository.findById(propertyId);
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property not found',
      });
    }

    // Check if relationship already exists
    const existing = await this.propertiesRepository.findIdentityProperty(
      identityId,
      propertyId,
      relationshipType,
    );
    if (existing && existing.active) {
      throw new ConflictException({
        code: 'RELATIONSHIP_EXISTS',
        message: 'This identity-property relationship already exists',
      });
    }

    // If setting as PRIMARY_PROPERTY, deactivate existing primary
    if (relationshipType === 'PRIMARY_PROPERTY') {
      const existingPrimary = await this.propertiesRepository.findIdentityPrimaryProperty(identityId);
      if (existingPrimary) {
        await this.propertiesRepository.updateIdentityProperty(existingPrimary.id, {
          active: false,
        });
      }
    }

    const relationship = await this.propertiesRepository.createIdentityProperty({
      identityId,
      propertyId,
      relationshipType,
      active: true,
      assignedAt: new Date(),
    });

    this.logger.log(
      `Property ${propertyId} assigned to identity ${identityId} as ${relationshipType}`,
    );
    return relationship;
  }

  /**
   * Remove property from identity
   */
  async removePropertyFromIdentity(
    identityId: string,
    propertyId: string,
  ): Promise<void> {
    await this.propertiesRepository.deactivateIdentityProperty(identityId, propertyId);
    this.logger.log(`Property ${propertyId} removed from identity ${identityId}`);
  }

  /**
   * Get all properties for an identity
   */
  async getIdentityProperties(identityId: string): Promise<IdentityProperty[]> {
    return this.propertiesRepository.findIdentityProperties(identityId);
  }

  /**
   * Get primary property for an identity
   */
  async getIdentityPrimaryProperty(identityId: string): Promise<Property | null> {
    const relationship = await this.propertiesRepository.findIdentityPrimaryProperty(identityId);
    if (!relationship) {
      return null;
    }
    return this.propertiesRepository.findById(relationship.propertyId);
  }

  /**
   * Get all identities at a property
   */
  async getIdentitiesAtProperty(propertyId: string): Promise<IdentityProperty[]> {
    return this.propertiesRepository.findIdentitiesAtProperty(propertyId);
  }
}
