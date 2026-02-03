import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, desc, count, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import {
  Identity,
  NewIdentity,
  identities,
  PersonProfile,
  NewPersonProfile,
  personProfiles,
  BusinessProfile,
  NewBusinessProfile,
  businessProfiles,
  BusinessRelationship,
  NewBusinessRelationship,
  businessRelationships,
  AuthPrincipal,
  NewAuthPrincipal,
  authPrincipals,
  AuthSecret,
  NewAuthSecret,
  authSecrets,
  KycProfile,
  NewKycProfile,
  kycProfiles,
  IdentityStatusHistory,
  NewIdentityStatusHistory,
  identityStatusHistory,
  IdentityEvent,
  NewIdentityEvent,
  identityEvents,
} from '@database/schemas';

/**
 * Identity Repository
 *
 * Data access layer for identity-related tables.
 * Follows Repository Pattern for clean separation.
 */
@Injectable()
export class IdentityRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ==================== IDENTITIES ====================

  /**
   * Create a new identity
   */
  async createIdentity(data: Omit<NewIdentity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Identity> {
    const [identity] = await this.db.insert(identities).values(data).returning();
    return identity;
  }

  /**
   * Find identity by ID
   */
  async findIdentityById(id: string): Promise<Identity | null> {
    const [identity] = await this.db
      .select()
      .from(identities)
      .where(eq(identities.id, id))
      .limit(1);
    return identity || null;
  }


  /**
   * Update identity
   */
  async updateIdentity(id: string, data: Partial<Identity>): Promise<Identity> {
    const [identity] = await this.db
      .update(identities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(identities.id, id))
      .returning();
    return identity;
  }

  /**
   * Find all identities with pagination
   */
  async findAllIdentities(limit: number, offset: number): Promise<Identity[]> {
    return this.db
      .select()
      .from(identities)
      .orderBy(desc(identities.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count identities
   */
  async countIdentities(): Promise<number> {
    const [result] = await this.db.select({ count: count() }).from(identities);
    return result?.count ?? 0;
  }

  /**
   * Count identities by status
   */
  async countIdentitiesByStatus(status: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(identities)
      .where(eq(identities.status, status as any));
    return result?.count ?? 0;
  }

  // ==================== PERSON PROFILES ====================

  /**
   * Create person profile
   */
  async createPersonProfile(
    data: Omit<NewPersonProfile, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<PersonProfile> {
    const [profile] = await this.db.insert(personProfiles).values(data).returning();
    return profile;
  }

  /**
   * Find person profile by identity ID
   */
  async findPersonProfileByIdentityId(identityId: string): Promise<PersonProfile | null> {
    const [profile] = await this.db
      .select()
      .from(personProfiles)
      .where(eq(personProfiles.identityId, identityId))
      .limit(1);
    return profile || null;
  }

  /**
   * Update person profile
   */
  async updatePersonProfile(identityId: string, data: Partial<PersonProfile>): Promise<PersonProfile> {
    const [profile] = await this.db
      .update(personProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(personProfiles.identityId, identityId))
      .returning();
    return profile;
  }

  // ==================== BUSINESS PROFILES ====================

  /**
   * Create business profile
   */
  async createBusinessProfile(
    data: Omit<NewBusinessProfile, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BusinessProfile> {
    const [profile] = await this.db.insert(businessProfiles).values(data).returning();
    return profile;
  }

  /**
   * Find business profile by identity ID
   */
  async findBusinessProfileByIdentityId(identityId: string): Promise<BusinessProfile | null> {
    const [profile] = await this.db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.identityId, identityId))
      .limit(1);
    return profile || null;
  }

  /**
   * Update business profile
   */
  async updateBusinessProfile(identityId: string, data: Partial<BusinessProfile>): Promise<BusinessProfile> {
    const [profile] = await this.db
      .update(businessProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(businessProfiles.identityId, identityId))
      .returning();
    return profile;
  }

  // ==================== BUSINESS RELATIONSHIPS ====================

  /**
   * Create business relationship (director/principal)
   */
  async createBusinessRelationship(
    data: Omit<NewBusinessRelationship, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BusinessRelationship> {
    const [relationship] = await this.db.insert(businessRelationships).values(data).returning();
    return relationship;
  }

  /**
   * Find business relationships by business identity ID
   */
  async findBusinessRelationshipsByBusinessId(businessIdentityId: string): Promise<BusinessRelationship[]> {
    return this.db
      .select()
      .from(businessRelationships)
      .where(
        and(
          eq(businessRelationships.businessIdentityId, businessIdentityId),
          isNull(businessRelationships.endDate),
        ),
      )
      .orderBy(desc(businessRelationships.createdAt));
  }

  /**
   * Count business relationships for a business
   */
  async countBusinessRelationships(businessIdentityId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(businessRelationships)
      .where(
        and(
          eq(businessRelationships.businessIdentityId, businessIdentityId),
          isNull(businessRelationships.endDate),
        ),
      );
    return result?.count ?? 0;
  }

  /**
   * Find business relationship by ID
   */
  async findBusinessRelationshipById(id: string): Promise<BusinessRelationship | null> {
    const [relationship] = await this.db
      .select()
      .from(businessRelationships)
      .where(eq(businessRelationships.id, id))
      .limit(1);
    return relationship || null;
  }

  /**
   * Update business relationship
   */
  async updateBusinessRelationship(
    id: string,
    data: Partial<Pick<BusinessRelationship, 'role' | 'ownershipPercentage' | 'positionTitle'>>,
  ): Promise<BusinessRelationship | null> {
    const [relationship] = await this.db
      .update(businessRelationships)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(businessRelationships.id, id))
      .returning();
    return relationship || null;
  }

  /**
   * Delete business relationship
   */
  async deleteBusinessRelationship(id: string): Promise<boolean> {
    const result = await this.db
      .delete(businessRelationships)
      .where(eq(businessRelationships.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== AUTH PRINCIPALS ====================

  /**
   * Create auth principal
   */
  async createAuthPrincipal(
    data: Omit<NewAuthPrincipal, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AuthPrincipal> {
    const [principal] = await this.db.insert(authPrincipals).values(data).returning();
    return principal;
  }

  /**
   * Find auth principal by type and value
   */
  async findAuthPrincipalByValue(
    principalType: 'phone' | 'email' | 'username',
    principalValue: string,
  ): Promise<AuthPrincipal | null> {
    const [principal] = await this.db
      .select()
      .from(authPrincipals)
      .where(
        and(
          eq(authPrincipals.principalType, principalType),
          eq(authPrincipals.principalValue, principalValue),
          eq(authPrincipals.isActive, true),
        ),
      )
      .limit(1);
    return principal || null;
  }

  /**
   * Find all auth principals for an identity
   */
  async findAuthPrincipalsByIdentityId(identityId: string): Promise<AuthPrincipal[]> {
    return this.db
      .select()
      .from(authPrincipals)
      .where(and(eq(authPrincipals.identityId, identityId), eq(authPrincipals.isActive, true)));
  }

  /**
   * Update auth principal
   */
  async updateAuthPrincipal(id: string, data: Partial<AuthPrincipal>): Promise<AuthPrincipal> {
    const [principal] = await this.db
      .update(authPrincipals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(authPrincipals.id, id))
      .returning();
    return principal;
  }

  // ==================== AUTH SECRETS ====================

  /**
   * Create auth secret
   */
  async createAuthSecret(
    data: Omit<NewAuthSecret, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AuthSecret> {
    const [secret] = await this.db.insert(authSecrets).values(data).returning();
    return secret;
  }

  /**
   * Find auth secret by identity and type
   */
  async findAuthSecretByIdentityAndType(
    identityId: string,
    secretType: 'pin' | 'transaction_pin' | 'password' | 'totp',
  ): Promise<AuthSecret | null> {
    const [secret] = await this.db
      .select()
      .from(authSecrets)
      .where(and(eq(authSecrets.identityId, identityId), eq(authSecrets.secretType, secretType)))
      .limit(1);
    return secret || null;
  }

  /**
   * Update auth secret
   */
  async updateAuthSecret(id: string, data: Partial<AuthSecret>): Promise<AuthSecret> {
    const [secret] = await this.db
      .update(authSecrets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(authSecrets.id, id))
      .returning();
    return secret;
  }

  /**
   * Increment failed attempts for a secret
   */
  async incrementSecretFailedAttempts(id: string): Promise<number> {
    const [secret] = await this.db
      .update(authSecrets)
      .set({
        failedAttempts: sql`${authSecrets.failedAttempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(authSecrets.id, id))
      .returning();
    return secret.failedAttempts;
  }

  /**
   * Reset failed attempts for a secret
   */
  async resetSecretFailedAttempts(id: string): Promise<void> {
    await this.db
      .update(authSecrets)
      .set({
        failedAttempts: 0,
        lockedUntil: null,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(authSecrets.id, id));
  }

  /**
   * Delete auth secret by identity and type
   */
  async deleteAuthSecret(
    identityId: string,
    secretType: 'pin' | 'transaction_pin' | 'password' | 'totp',
  ): Promise<boolean> {
    const result = await this.db
      .delete(authSecrets)
      .where(and(eq(authSecrets.identityId, identityId), eq(authSecrets.secretType, secretType)));
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== KYC PROFILES ====================

  /**
   * Create KYC profile
   */
  async createKycProfile(
    data: Omit<NewKycProfile, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<KycProfile> {
    const [profile] = await this.db.insert(kycProfiles).values(data).returning();
    return profile;
  }

  /**
   * Find KYC profile by identity ID
   */
  async findKycProfileByIdentityId(identityId: string): Promise<KycProfile | null> {
    const [profile] = await this.db
      .select()
      .from(kycProfiles)
      .where(eq(kycProfiles.identityId, identityId))
      .limit(1);
    return profile || null;
  }

  /**
   * Update KYC profile
   */
  async updateKycProfile(identityId: string, data: Partial<KycProfile>): Promise<KycProfile> {
    const [profile] = await this.db
      .update(kycProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(kycProfiles.identityId, identityId))
      .returning();
    return profile;
  }

  // ==================== STATUS HISTORY ====================

  /**
   * Create identity status history record
   */
  async createStatusHistory(
    data: Omit<NewIdentityStatusHistory, 'id' | 'createdAt'>,
  ): Promise<IdentityStatusHistory> {
    const [history] = await this.db.insert(identityStatusHistory).values(data).returning();
    return history;
  }

  /**
   * Find status history for an identity
   */
  async findStatusHistoryByIdentityId(identityId: string): Promise<IdentityStatusHistory[]> {
    return this.db
      .select()
      .from(identityStatusHistory)
      .where(eq(identityStatusHistory.identityId, identityId))
      .orderBy(desc(identityStatusHistory.createdAt));
  }

  // ==================== IDENTITY EVENTS ====================

  /**
   * Create identity event
   */
  async createIdentityEvent(
    data: Omit<NewIdentityEvent, 'id' | 'createdAt'>,
  ): Promise<IdentityEvent> {
    const [event] = await this.db.insert(identityEvents).values(data).returning();
    return event;
  }

  /**
   * Find identity events for an identity
   */
  async findIdentityEventsByIdentityId(
    identityId: string,
    limit: number = 100,
  ): Promise<IdentityEvent[]> {
    return this.db
      .select()
      .from(identityEvents)
      .where(eq(identityEvents.identityId, identityId))
      .orderBy(desc(identityEvents.createdAt))
      .limit(limit);
  }

  // ==================== COMPOUND QUERIES ====================

  /**
   * Find identity by email (through auth_principals)
   */
  async findIdentityByEmail(email: string): Promise<Identity | null> {
    const results = await this.db
      .select({ identity: identities })
      .from(identities)
      .innerJoin(authPrincipals, eq(identities.id, authPrincipals.identityId))
      .where(
        and(
          eq(authPrincipals.principalType, 'email'),
          eq(authPrincipals.principalValue, email.toLowerCase()),
          eq(authPrincipals.isActive, true),
        ),
      )
      .limit(1);
    return results[0]?.identity || null;
  }

  /**
   * Find identity by phone (through auth_principals)
   */
  async findIdentityByPhone(phone: string): Promise<Identity | null> {
    const results = await this.db
      .select({ identity: identities })
      .from(identities)
      .innerJoin(authPrincipals, eq(identities.id, authPrincipals.identityId))
      .where(
        and(
          eq(authPrincipals.principalType, 'phone'),
          eq(authPrincipals.principalValue, phone),
          eq(authPrincipals.isActive, true),
        ),
      )
      .limit(1);
    return results[0]?.identity || null;
  }

  /**
   * Get full identity with profile and principals
   */
  async getFullIdentity(
    identityId: string,
  ): Promise<{
    identity: Identity;
    personProfile: PersonProfile | null;
    businessProfile: BusinessProfile | null;
    businessRelationships: BusinessRelationship[];
    principals: AuthPrincipal[];
    kycProfile: KycProfile | null;
  } | null> {
    const identity = await this.findIdentityById(identityId);
    if (!identity) return null;

    const [personProfile, businessProfile, businessRelationshipsList, principals, kycProfile] = await Promise.all([
      this.findPersonProfileByIdentityId(identityId),
      this.findBusinessProfileByIdentityId(identityId),
      identity.identityType === 'legal_entity'
        ? this.findBusinessRelationshipsByBusinessId(identityId)
        : Promise.resolve([]),
      this.findAuthPrincipalsByIdentityId(identityId),
      this.findKycProfileByIdentityId(identityId),
    ]);

    return {
      identity,
      personProfile,
      businessProfile,
      businessRelationships: businessRelationshipsList,
      principals,
      kycProfile
    };
  }
}
