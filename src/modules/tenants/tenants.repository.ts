import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import { tenants, Tenant, NewTenant } from '@database/schemas/tenants.schema';

@Injectable()
export class TenantsRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new tenant
   */
  async create(data: NewTenant): Promise<Tenant> {
    const [tenant] = await this.db.insert(tenants).values(data).returning();
    return tenant;
  }

  /**
   * Find tenant by ID
   */
  async findById(id: string): Promise<Tenant | null> {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);
    return tenant || null;
  }

  /**
   * Find tenants by owner identity ID
   */
  async findByOwner(ownerIdentityId: string): Promise<Tenant[]> {
    return this.db
      .select()
      .from(tenants)
      .where(eq(tenants.ownerIdentityId, ownerIdentityId))
      .orderBy(desc(tenants.createdAt));
  }

  /**
   * Find all tenants
   */
  async findAll(): Promise<Tenant[]> {
    return this.db
      .select()
      .from(tenants)
      .orderBy(desc(tenants.createdAt));
  }

  /**
   * Find all active tenants
   */
  async findAllActive(): Promise<Tenant[]> {
    return this.db
      .select()
      .from(tenants)
      .where(eq(tenants.status, 'ACTIVE'))
      .orderBy(desc(tenants.createdAt));
  }

  /**
   * Find tenants by type
   */
  async findByType(
    tenantType: 'BUSINESS_BANKING' | 'SUBSCRIPTION_WORKSPACE' | 'PARTNER',
  ): Promise<Tenant[]> {
    return this.db
      .select()
      .from(tenants)
      .where(eq(tenants.tenantType, tenantType))
      .orderBy(desc(tenants.createdAt));
  }

  /**
   * Update tenant
   */
  async update(
    id: string,
    data: Partial<Omit<NewTenant, 'id' | 'createdAt'>>,
  ): Promise<Tenant> {
    const [updated] = await this.db
      .update(tenants)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning();
    return updated;
  }

  /**
   * Update tenant status
   */
  async updateStatus(
    id: string,
    status: 'ACTIVE' | 'SUSPENDED',
  ): Promise<Tenant> {
    const [updated] = await this.db
      .update(tenants)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning();
    return updated;
  }

  /**
   * Delete tenant (hard delete - use with caution)
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(tenants).where(eq(tenants.id, id));
  }

  /**
   * Check if tenant exists
   */
  async exists(id: string): Promise<boolean> {
    const [result] = await this.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);
    return !!result;
  }
}
