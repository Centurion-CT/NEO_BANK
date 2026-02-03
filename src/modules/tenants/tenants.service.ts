import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { TenantsRepository } from './tenants.repository';
import { CreateTenantDto, UpdateTenantDto } from './dto';
import { Tenant } from '@database/schemas/tenants.schema';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(private readonly tenantsRepository: TenantsRepository) {}

  /**
   * Create a new tenant
   */
  async createTenant(dto: CreateTenantDto): Promise<Tenant> {
    const tenant = await this.tenantsRepository.create({
      tenantType: dto.tenantType,
      legalName: dto.legalName,
      ownerIdentityId: dto.ownerIdentityId,
      status: 'ACTIVE',
    });

    this.logger.log(`Tenant created: ${tenant.id} (${tenant.legalName})`);
    return tenant;
  }

  /**
   * Update a tenant
   */
  async updateTenant(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const existing = await this.tenantsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    const updated = await this.tenantsRepository.update(id, {
      ...(dto.legalName && { legalName: dto.legalName }),
      ...(dto.ownerIdentityId && { ownerIdentityId: dto.ownerIdentityId }),
      ...(dto.status && { status: dto.status }),
    });

    this.logger.log(`Tenant updated: ${id}`);
    return updated;
  }

  /**
   * Find tenant by ID
   */
  async findTenantById(id: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findById(id);
    if (!tenant) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }
    return tenant;
  }

  /**
   * Find tenants by owner identity
   */
  async findTenantsByOwner(ownerIdentityId: string): Promise<Tenant[]> {
    return this.tenantsRepository.findByOwner(ownerIdentityId);
  }

  /**
   * Find all tenants
   */
  async findAllTenants(): Promise<Tenant[]> {
    return this.tenantsRepository.findAll();
  }

  /**
   * Find all active tenants
   */
  async findActiveTenants(): Promise<Tenant[]> {
    return this.tenantsRepository.findAllActive();
  }

  /**
   * Find tenants by type
   */
  async findTenantsByType(
    tenantType: 'BUSINESS_BANKING' | 'SUBSCRIPTION_WORKSPACE' | 'PARTNER',
  ): Promise<Tenant[]> {
    return this.tenantsRepository.findByType(tenantType);
  }

  /**
   * Suspend a tenant
   */
  async suspendTenant(id: string): Promise<Tenant> {
    const existing = await this.tenantsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    if (existing.status === 'SUSPENDED') {
      throw new BadRequestException({
        code: 'TENANT_ALREADY_SUSPENDED',
        message: 'Tenant is already suspended',
      });
    }

    const updated = await this.tenantsRepository.updateStatus(id, 'SUSPENDED');
    this.logger.log(`Tenant suspended: ${id}`);
    return updated;
  }

  /**
   * Activate a tenant
   */
  async activateTenant(id: string): Promise<Tenant> {
    const existing = await this.tenantsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    if (existing.status === 'ACTIVE') {
      throw new BadRequestException({
        code: 'TENANT_ALREADY_ACTIVE',
        message: 'Tenant is already active',
      });
    }

    const updated = await this.tenantsRepository.updateStatus(id, 'ACTIVE');
    this.logger.log(`Tenant activated: ${id}`);
    return updated;
  }

  /**
   * Check if tenant exists
   */
  async tenantExists(id: string): Promise<boolean> {
    return this.tenantsRepository.exists(id);
  }

  /**
   * Delete a tenant (use with caution)
   */
  async deleteTenant(id: string): Promise<void> {
    const existing = await this.tenantsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    await this.tenantsRepository.delete(id);
    this.logger.log(`Tenant deleted: ${id}`);
  }
}
