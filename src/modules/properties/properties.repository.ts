import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import {
  properties,
  identityProperties,
  Property,
  NewProperty,
  IdentityProperty,
  NewIdentityProperty,
} from '@database/schemas/properties.schema';

@Injectable()
export class PropertiesRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // =========================================================================
  // PROPERTIES
  // =========================================================================

  /**
   * Create a new property
   */
  async create(data: NewProperty): Promise<Property> {
    const [property] = await this.db.insert(properties).values(data).returning();
    return property;
  }

  /**
   * Find property by ID
   */
  async findById(id: string): Promise<Property | null> {
    const [property] = await this.db
      .select()
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1);
    return property || null;
  }

  /**
   * Find property by code
   */
  async findByCode(code: string): Promise<Property | null> {
    const [property] = await this.db
      .select()
      .from(properties)
      .where(eq(properties.propertyCode, code))
      .limit(1);
    return property || null;
  }

  /**
   * Find properties by tenant
   */
  async findByTenant(tenantId: string): Promise<Property[]> {
    return this.db
      .select()
      .from(properties)
      .where(eq(properties.tenantId, tenantId))
      .orderBy(desc(properties.createdAt));
  }

  /**
   * Find properties by type
   */
  async findByType(propertyType: 'PHYSICAL' | 'VIRTUAL'): Promise<Property[]> {
    return this.db
      .select()
      .from(properties)
      .where(eq(properties.propertyType, propertyType))
      .orderBy(desc(properties.createdAt));
  }

  /**
   * Find properties by subtype
   */
  async findBySubtype(
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
    return this.db
      .select()
      .from(properties)
      .where(eq(properties.propertySubtype, propertySubtype))
      .orderBy(desc(properties.createdAt));
  }

  /**
   * Find all properties
   */
  async findAll(): Promise<Property[]> {
    return this.db
      .select()
      .from(properties)
      .orderBy(desc(properties.createdAt));
  }

  /**
   * Find all active properties
   */
  async findAllActive(): Promise<Property[]> {
    return this.db
      .select()
      .from(properties)
      .where(eq(properties.status, 'ACTIVE'))
      .orderBy(desc(properties.createdAt));
  }

  /**
   * Find assignable properties (where users can be onboarded)
   */
  async findAssignable(): Promise<Property[]> {
    return this.db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.status, 'ACTIVE'),
          eq(properties.isAssignable, true),
        ),
      )
      .orderBy(desc(properties.createdAt));
  }

  /**
   * Find properties that allow agent access
   */
  async findAgentAccessible(): Promise<Property[]> {
    return this.db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.status, 'ACTIVE'),
          eq(properties.allowsAgentAccess, true),
        ),
      )
      .orderBy(desc(properties.createdAt));
  }

  /**
   * Update property
   */
  async update(
    id: string,
    data: Partial<Omit<NewProperty, 'id' | 'createdAt' | 'propertyCode'>>,
  ): Promise<Property> {
    const [updated] = await this.db
      .update(properties)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, id))
      .returning();
    return updated;
  }

  /**
   * Update property status
   */
  async updateStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
  ): Promise<Property> {
    const [updated] = await this.db
      .update(properties)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, id))
      .returning();
    return updated;
  }

  /**
   * Delete property (hard delete - use with caution)
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(properties).where(eq(properties.id, id));
  }

  /**
   * Check if property exists
   */
  async exists(id: string): Promise<boolean> {
    const [result] = await this.db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1);
    return !!result;
  }

  /**
   * Check if property code exists
   */
  async codeExists(code: string): Promise<boolean> {
    const [result] = await this.db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.propertyCode, code))
      .limit(1);
    return !!result;
  }

  // =========================================================================
  // IDENTITY PROPERTIES
  // =========================================================================

  /**
   * Create identity-property relationship
   */
  async createIdentityProperty(data: NewIdentityProperty): Promise<IdentityProperty> {
    const [relationship] = await this.db
      .insert(identityProperties)
      .values(data)
      .returning();
    return relationship;
  }

  /**
   * Find identity-property relationship
   */
  async findIdentityProperty(
    identityId: string,
    propertyId: string,
    relationshipType?: 'ONBOARDED_AT' | 'PRIMARY_PROPERTY' | 'SERVICED_BY',
  ): Promise<IdentityProperty | null> {
    const conditions = [
      eq(identityProperties.identityId, identityId),
      eq(identityProperties.propertyId, propertyId),
    ];

    if (relationshipType) {
      conditions.push(eq(identityProperties.relationshipType, relationshipType));
    }

    const [relationship] = await this.db
      .select()
      .from(identityProperties)
      .where(and(...conditions))
      .limit(1);
    return relationship || null;
  }

  /**
   * Find all properties for an identity
   */
  async findIdentityProperties(identityId: string): Promise<IdentityProperty[]> {
    return this.db
      .select()
      .from(identityProperties)
      .where(
        and(
          eq(identityProperties.identityId, identityId),
          eq(identityProperties.active, true),
        ),
      );
  }

  /**
   * Find primary property for an identity
   */
  async findIdentityPrimaryProperty(identityId: string): Promise<IdentityProperty | null> {
    const [relationship] = await this.db
      .select()
      .from(identityProperties)
      .where(
        and(
          eq(identityProperties.identityId, identityId),
          eq(identityProperties.relationshipType, 'PRIMARY_PROPERTY'),
          eq(identityProperties.active, true),
        ),
      )
      .limit(1);
    return relationship || null;
  }

  /**
   * Find all identities at a property
   */
  async findIdentitiesAtProperty(propertyId: string): Promise<IdentityProperty[]> {
    return this.db
      .select()
      .from(identityProperties)
      .where(
        and(
          eq(identityProperties.propertyId, propertyId),
          eq(identityProperties.active, true),
        ),
      );
  }

  /**
   * Update identity-property relationship
   */
  async updateIdentityProperty(
    id: string,
    data: Partial<Pick<IdentityProperty, 'active'>>,
  ): Promise<IdentityProperty> {
    const [updated] = await this.db
      .update(identityProperties)
      .set(data)
      .where(eq(identityProperties.id, id))
      .returning();
    return updated;
  }

  /**
   * Deactivate identity-property relationship
   */
  async deactivateIdentityProperty(
    identityId: string,
    propertyId: string,
  ): Promise<void> {
    await this.db
      .update(identityProperties)
      .set({ active: false })
      .where(
        and(
          eq(identityProperties.identityId, identityId),
          eq(identityProperties.propertyId, propertyId),
        ),
      );
  }

  /**
   * Delete identity-property relationship (hard delete)
   */
  async deleteIdentityProperty(id: string): Promise<void> {
    await this.db.delete(identityProperties).where(eq(identityProperties.id, id));
  }
}
