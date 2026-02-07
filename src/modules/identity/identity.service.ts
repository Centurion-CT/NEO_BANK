import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityRepository } from './identity.repository';
import {
  Identity,
  NewIdentity,
  PersonProfile,
  NewPersonProfile,
  BusinessProfile,
  BusinessRelationship,
  AuthPrincipal,
  AuthSecret,
  KycProfile,
} from '@database/schemas';
import { FeatureFlagsConfig } from '@config/feature-flags.config';

/**
 * Identity Service
 *
 * Business logic for identity operations.
 * Manages the full identity lifecycle including:
 * - Identity creation and management
 * - Person/business profiles
 * - Authentication principals and secrets
 * - KYC profiles
 * - Event logging
 */
@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);
  private readonly featureFlags: FeatureFlagsConfig;

  constructor(
    private readonly identityRepository: IdentityRepository,
    private readonly configService: ConfigService,
  ) {
    this.featureFlags = this.configService.get<FeatureFlagsConfig>('featureFlags') || {
      useNewIdentityTables: false,
      dualWriteEnabled: false,
      readFromNewTables: false,
      useNewAuthFlow: false,
      enableIdentityEventLogging: false,
    };
  }

  // ==================== IDENTITY MANAGEMENT ====================

  /**
   * Create a new identity with person profile
   */
  async createIdentityWithProfile(data: {
    identityType?: 'natural_person' | 'legal_entity';
    profile: {
      firstName: string;
      lastName: string;
      middleName?: string;
      dateOfBirth?: Date;
      nationality?: string;
      preferredLoginMode?: 'pin' | 'password';
    };
    principals: Array<{
      type: 'phone' | 'email' | 'username';
      value: string;
      isPrimary?: boolean;
    }>;
  }): Promise<{ identity: Identity; profile: PersonProfile; principals: AuthPrincipal[] }> {
    // Create identity
    const identity = await this.identityRepository.createIdentity({
      identityType: data.identityType || 'natural_person',
      status: 'shell',
      riskLevel: 'low',
    });

    // Create person profile
    const profile = await this.identityRepository.createPersonProfile({
      identityId: identity.id,
      firstName: data.profile.firstName,
      lastName: data.profile.lastName,
      middleName: data.profile.middleName,
      dateOfBirth: data.profile.dateOfBirth,
      nationality: data.profile.nationality || 'NG',
      preferredLoginMode: data.profile.preferredLoginMode || 'password',
    });

    // Create auth principals
    const principals: AuthPrincipal[] = [];
    for (const principalData of data.principals) {
      // Check for existing principal
      const existing = await this.identityRepository.findAuthPrincipalByValue(
        principalData.type,
        principalData.value.toLowerCase(),
      );
      if (existing) {
        throw new ConflictException({
          code: 'PRINCIPAL_EXISTS',
          message: `${principalData.type} already registered`,
        });
      }

      const principal = await this.identityRepository.createAuthPrincipal({
        identityId: identity.id,
        principalType: principalData.type,
        principalValue: principalData.value.toLowerCase(),
        isPrimary: principalData.isPrimary || false,
        isVerified: false,
        isActive: true,
      });
      principals.push(principal);
    }

    // Create KYC profile
    await this.identityRepository.createKycProfile({
      identityId: identity.id,
      kycTier: 'tier_0',
      status: 'not_started',
    });

    // Log event if enabled
    if (this.featureFlags.enableIdentityEventLogging) {
      await this.identityRepository.createIdentityEvent({
        identityId: identity.id,
        eventType: 'created',
        description: 'Identity created',
      });
    }

    return { identity, profile, principals };
  }

  /**
   * Find identity by ID
   */
  async findById(id: string): Promise<Identity | null> {
    return this.identityRepository.findIdentityById(id);
  }


  /**
   * Find identity by email
   */
  async findByEmail(email: string): Promise<Identity | null> {
    return this.identityRepository.findIdentityByEmail(email);
  }

  /**
   * Find identity by phone
   */
  async findByPhone(phone: string): Promise<Identity | null> {
    return this.identityRepository.findIdentityByPhone(phone);
  }

  /**
   * Get full identity with all related data
   */
  async getFullIdentity(identityId: string) {
    return this.identityRepository.getFullIdentity(identityId);
  }

  /**
   * Get person profile by identity ID
   */
  async getPersonProfile(identityId: string) {
    return this.identityRepository.findPersonProfileByIdentityId(identityId);
  }

  /**
   * Find all identities with pagination
   */
  async findAll(limit: number, offset: number): Promise<Identity[]> {
    return this.identityRepository.findAllIdentities(limit, offset);
  }

  /**
   * Count all identities
   */
  async count(): Promise<number> {
    return this.identityRepository.countIdentities();
  }

  /**
   * Count identities by status
   */
  async countByStatus(status: string): Promise<number> {
    return this.identityRepository.countIdentitiesByStatus(status);
  }

  /**
   * Update identity status with history tracking
   */
  async updateStatus(
    identityId: string,
    newStatus: 'shell' | 'pending_verification' | 'active' | 'suspended' | 'closed' | 'rejected',
    changedBy?: string,
    reason?: string,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<Identity> {
    const identity = await this.identityRepository.findIdentityById(identityId);
    if (!identity) {
      throw new NotFoundException({
        code: 'IDENTITY_NOT_FOUND',
        message: 'Identity not found',
      });
    }

    const oldStatus = identity.status;

    // Update identity
    const updatedIdentity = await this.identityRepository.updateIdentity(identityId, {
      status: newStatus,
    });

    // Record status history
    await this.identityRepository.createStatusHistory({
      identityId,
      oldStatus,
      newStatus,
      changedBy,
      reason,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    // Log event if enabled
    if (this.featureFlags.enableIdentityEventLogging) {
      await this.identityRepository.createIdentityEvent({
        identityId,
        eventType: 'status_changed',
        actorIdentityId: changedBy,
        description: `Status changed from ${oldStatus} to ${newStatus}`,
        oldValue: JSON.stringify({ status: oldStatus }),
        newValue: JSON.stringify({ status: newStatus }),
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });
    }

    return updatedIdentity;
  }

  // ==================== PROFILE MANAGEMENT ====================

  /**
   * Ensure a person profile exists for an identity (creates one for business accounts if needed)
   */
  private async ensurePersonProfileExists(identityId: string): Promise<PersonProfile> {
    const existingProfile = await this.identityRepository.findPersonProfileByIdentityId(identityId);
    if (existingProfile) {
      return existingProfile;
    }

    // Check if this is a business account
    const identity = await this.identityRepository.findIdentityById(identityId);
    if (!identity) {
      throw new NotFoundException({
        code: 'IDENTITY_NOT_FOUND',
        message: 'Identity not found',
      });
    }

    if (identity.identityType === 'legal_entity') {
      // Business account - create a person profile for storing preferences
      const businessProfile = await this.identityRepository.findBusinessProfileByIdentityId(identityId);
      const contactName = businessProfile?.legalName || 'Business';

      return this.identityRepository.createPersonProfile({
        identityId,
        firstName: contactName,
        lastName: 'Account',
        preferredTheme: 'system',
        preferredLanguage: 'en',
        preferredCurrency: 'NGN',
        preferredLoginMode: 'password',
      });
    }

    // Individual account without profile - this shouldn't happen
    throw new NotFoundException({
      code: 'PROFILE_NOT_FOUND',
      message: 'Person profile not found',
    });
  }

  /**
   * Update person profile
   */
  async updatePersonProfile(
    identityId: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      middleName: string;
      dateOfBirth: Date;
      nationality: string;
      address: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
      profilePictureUrl: string;
      preferredLanguage: string;
      preferredCurrency: string;
      preferredTheme: string;
      preferredLoginMode: 'pin' | 'password';
      allowWebLogin: boolean;
      allowMobileLogin: boolean;
      allowUssdLogin: boolean;
    }>,
  ): Promise<PersonProfile> {
    // Ensure profile exists (creates one for business accounts if needed)
    await this.ensurePersonProfileExists(identityId);

    return this.identityRepository.updatePersonProfile(identityId, data);
  }

  /**
   * Create a person profile for a business account (for storing preferences)
   */
  async createPersonProfileForBusiness(
    identityId: string,
    data: {
      firstName: string;
      lastName: string;
      preferredTheme?: string;
      preferredLanguage?: string;
      preferredCurrency?: string;
      preferredLoginMode?: 'pin' | 'password';
    },
  ): Promise<PersonProfile> {
    // Check if profile already exists
    const existingProfile = await this.identityRepository.findPersonProfileByIdentityId(identityId);
    if (existingProfile) {
      // Update existing profile instead
      return this.identityRepository.updatePersonProfile(identityId, data);
    }

    // Create new person profile for business account
    return this.identityRepository.createPersonProfile({
      identityId,
      firstName: data.firstName,
      lastName: data.lastName,
      preferredTheme: data.preferredTheme || 'system',
      preferredLanguage: data.preferredLanguage || 'en',
      preferredCurrency: data.preferredCurrency || 'NGN',
      preferredLoginMode: data.preferredLoginMode || 'password',
    });
  }

  /**
   * Get login channel preferences
   */
  async getChannelPreferences(identityId: string): Promise<{
    allowWebLogin: boolean;
    allowMobileLogin: boolean;
    allowUssdLogin: boolean;
  }> {
    const profile = await this.identityRepository.findPersonProfileByIdentityId(identityId);
    if (!profile) {
      // Return defaults if no profile (e.g., business accounts)
      return {
        allowWebLogin: true,
        allowMobileLogin: true,
        allowUssdLogin: true,
      };
    }

    return {
      allowWebLogin: profile.allowWebLogin ?? true,
      allowMobileLogin: profile.allowMobileLogin ?? true,
      allowUssdLogin: profile.allowUssdLogin ?? true,
    };
  }

  /**
   * Update login channel preferences
   */
  async updateChannelPreferences(
    identityId: string,
    data: {
      allowWebLogin?: boolean;
      allowMobileLogin?: boolean;
      allowUssdLogin?: boolean;
    },
  ): Promise<{
    allowWebLogin: boolean;
    allowMobileLogin: boolean;
    allowUssdLogin: boolean;
  }> {
    // Ensure profile exists (creates one for business accounts if needed)
    const profile = await this.ensurePersonProfileExists(identityId);

    // Ensure at least one channel remains enabled
    const newPrefs = {
      allowWebLogin: data.allowWebLogin ?? profile.allowWebLogin ?? true,
      allowMobileLogin: data.allowMobileLogin ?? profile.allowMobileLogin ?? true,
      allowUssdLogin: data.allowUssdLogin ?? profile.allowUssdLogin ?? true,
    };

    if (!newPrefs.allowWebLogin && !newPrefs.allowMobileLogin && !newPrefs.allowUssdLogin) {
      throw new BadRequestException({
        code: 'INVALID_CHANNEL_PREFERENCES',
        message: 'At least one login channel must be enabled',
      });
    }

    await this.identityRepository.updatePersonProfile(identityId, newPrefs);

    return newPrefs;
  }

  /**
   * Get geo tagging preferences
   */
  async getGeoTaggingPreferences(identityId: string): Promise<{
    geoTaggingEnabled: boolean;
  }> {
    const profile = await this.identityRepository.findPersonProfileByIdentityId(identityId);
    if (!profile) {
      // Return default if no profile (e.g., business accounts)
      return {
        geoTaggingEnabled: false,
      };
    }

    return {
      geoTaggingEnabled: profile.geoTaggingEnabled ?? false,
    };
  }

  /**
   * Update geo tagging preferences
   */
  async updateGeoTaggingPreferences(
    identityId: string,
    enabled: boolean,
  ): Promise<{
    geoTaggingEnabled: boolean;
  }> {
    // Ensure profile exists (creates one for business accounts if needed)
    await this.ensurePersonProfileExists(identityId);

    await this.identityRepository.updatePersonProfile(identityId, {
      geoTaggingEnabled: enabled,
    });

    return {
      geoTaggingEnabled: enabled,
    };
  }

  // ==================== MFA METHOD MANAGEMENT ====================

  /**
   * Get MFA method preference
   * Stored on the identity to support all account types (individual, business, admin)
   */
  async getMfaMethod(identityId: string): Promise<'email' | 'sms' | 'totp' | null> {
    const identity = await this.identityRepository.findIdentityById(identityId);
    if (!identity) {
      return null;
    }
    return identity.mfaMethod || null;
  }

  /**
   * Set MFA method preference
   * Stored on the identity to support all account types (individual, business, admin)
   */
  async setMfaMethod(
    identityId: string,
    method: 'email' | 'sms' | 'totp' | null,
  ): Promise<void> {
    const identity = await this.identityRepository.findIdentityById(identityId);
    if (!identity) {
      throw new NotFoundException({
        code: 'IDENTITY_NOT_FOUND',
        message: 'Identity not found',
      });
    }

    await this.identityRepository.updateIdentity(identityId, {
      mfaMethod: method,
    });
  }

  // ==================== AUTH PRINCIPAL MANAGEMENT ====================

  /**
   * Add auth principal to identity
   */
  async addAuthPrincipal(
    identityId: string,
    principalType: 'phone' | 'email' | 'username',
    principalValue: string,
    isPrimary: boolean = false,
  ): Promise<AuthPrincipal> {
    // Verify identity exists
    const identity = await this.identityRepository.findIdentityById(identityId);
    if (!identity) {
      throw new NotFoundException({
        code: 'IDENTITY_NOT_FOUND',
        message: 'Identity not found',
      });
    }

    // Check for existing principal
    const existing = await this.identityRepository.findAuthPrincipalByValue(
      principalType,
      principalValue.toLowerCase(),
    );
    if (existing) {
      throw new ConflictException({
        code: 'PRINCIPAL_EXISTS',
        message: `${principalType} already registered`,
      });
    }

    return this.identityRepository.createAuthPrincipal({
      identityId,
      principalType,
      principalValue: principalValue.toLowerCase(),
      isPrimary,
      isVerified: false,
      isActive: true,
    });
  }

  /**
   * Verify auth principal
   */
  async verifyPrincipal(principalId: string): Promise<AuthPrincipal> {
    return this.identityRepository.updateAuthPrincipal(principalId, {
      isVerified: true,
      verifiedAt: new Date(),
    });
  }

  /**
   * Find auth principal by value
   */
  async findPrincipalByValue(
    principalType: 'phone' | 'email' | 'username',
    principalValue: string,
  ): Promise<AuthPrincipal | null> {
    return this.identityRepository.findAuthPrincipalByValue(
      principalType,
      principalValue.toLowerCase(),
    );
  }

  // ==================== AUTH SECRET MANAGEMENT ====================

  /**
   * Create or update auth secret
   */
  async setAuthSecret(
    identityId: string,
    secretType: 'pin' | 'transaction_pin' | 'password' | 'totp',
    secretHash: string,
  ): Promise<AuthSecret> {
    // Check for existing secret
    const existing = await this.identityRepository.findAuthSecretByIdentityAndType(
      identityId,
      secretType,
    );

    if (existing) {
      return this.identityRepository.updateAuthSecret(existing.id, {
        secretHash,
        failedAttempts: 0,
        lockedUntil: null,
        version: existing.version + 1,
      });
    }

    return this.identityRepository.createAuthSecret({
      identityId,
      secretType,
      secretHash,
      failedAttempts: 0,
    });
  }

  /**
   * Get auth secret for verification
   */
  async getAuthSecret(
    identityId: string,
    secretType: 'pin' | 'transaction_pin' | 'password' | 'totp',
  ): Promise<AuthSecret | null> {
    return this.identityRepository.findAuthSecretByIdentityAndType(identityId, secretType);
  }

  /**
   * Increment failed attempts for a secret
   */
  async incrementSecretFailedAttempts(secretId: string): Promise<number> {
    return this.identityRepository.incrementSecretFailedAttempts(secretId);
  }

  /**
   * Reset failed attempts and update last used
   */
  async resetSecretFailedAttempts(secretId: string): Promise<void> {
    return this.identityRepository.resetSecretFailedAttempts(secretId);
  }

  /**
   * Lock a secret until specified time
   */
  async lockSecret(secretId: string, until: Date): Promise<void> {
    await this.identityRepository.updateAuthSecret(secretId, {
      lockedUntil: until,
    });
  }

  /**
   * Reset failed attempts and unlock a secret
   */
  async resetSecretAttempts(secretId: string): Promise<void> {
    await this.identityRepository.resetSecretFailedAttempts(secretId);
  }

  /**
   * Delete auth secret (e.g., when disabling MFA)
   */
  async deleteAuthSecret(
    identityId: string,
    secretType: 'pin' | 'transaction_pin' | 'password' | 'totp',
  ): Promise<boolean> {
    return this.identityRepository.deleteAuthSecret(identityId, secretType);
  }

  // ==================== KYC MANAGEMENT ====================

  /**
   * Update KYC profile
   */
  async updateKycProfile(
    identityId: string,
    data: Partial<{
      kycTier: 'tier_0' | 'tier_1' | 'tier_2' | 'tier_3';
      status:
        | 'not_started'
        | 'in_progress'
        | 'pending_review'
        | 'approved'
        | 'rejected'
        | 'expired'
        | 'suspended';
      bvnEncrypted: string;
      ninEncrypted: string;
      reviewedBy: string;
      reviewNotes: string;
      rejectionReason: string;
      rejectionCount: string;
      verificationStartedAt: Date;
      verificationCompletedAt: Date;
      lastReviewedAt: Date;
      nextReviewDue: Date;
      expiresAt: Date;
      riskScore: string;
      riskFactors: string;
    }>,
  ): Promise<KycProfile> {
    return this.identityRepository.updateKycProfile(identityId, data);
  }

  /**
   * Get KYC profile for identity
   */
  async getKycProfile(identityId: string): Promise<KycProfile | null> {
    return this.identityRepository.findKycProfileByIdentityId(identityId);
  }

  // ==================== EVENT LOGGING ====================

  /**
   * Log identity event
   */
  async logEvent(
    identityId: string,
    eventType: string,
    data?: {
      actorIdentityId?: string;
      actorRole?: string;
      description?: string;
      oldValue?: any;
      newValue?: any;
      ipAddress?: string;
      userAgent?: string;
      metadata?: any;
    },
  ): Promise<void> {
    if (!this.featureFlags.enableIdentityEventLogging) {
      return;
    }

    await this.identityRepository.createIdentityEvent({
      identityId,
      eventType: eventType as any,
      actorIdentityId: data?.actorIdentityId,
      actorRole: data?.actorRole,
      description: data?.description,
      oldValue: data?.oldValue ? JSON.stringify(data.oldValue) : undefined,
      newValue: data?.newValue ? JSON.stringify(data.newValue) : undefined,
      ipAddress: data?.ipAddress,
      userAgent: data?.userAgent,
      metadata: data?.metadata ? JSON.stringify(data.metadata) : undefined,
    });
  }

  /**
   * Get identity event history
   */
  async getEventHistory(identityId: string, limit: number = 100) {
    return this.identityRepository.findIdentityEventsByIdentityId(identityId, limit);
  }

  /**
   * Get status history for identity
   */
  async getStatusHistory(identityId: string) {
    return this.identityRepository.findStatusHistoryByIdentityId(identityId);
  }

  // ==================== BUSINESS PROFILE MANAGEMENT ====================

  /**
   * Create a new business identity with profile
   */
  async createBusinessIdentityWithProfile(data: {
    profile: {
      legalName: string;
      businessType: 'limited_liability' | 'enterprise' | 'sole_proprietorship' | 'partnership' | 'private_limited' | 'public_limited' | 'nonprofit' | 'ngo' | 'cooperative' | 'government' | 'other';
      registrationNumber?: string;
    };
    principals: Array<{
      type: 'phone' | 'email' | 'username';
      value: string;
      isPrimary?: boolean;
    }>;
  }): Promise<{ identity: Identity; businessProfile: BusinessProfile; principals: AuthPrincipal[] }> {
    // Create identity as legal entity
    const identity = await this.identityRepository.createIdentity({
      identityType: 'legal_entity',
      status: 'shell',
      riskLevel: 'low',
    });

    // Create business profile
    const businessProfile = await this.identityRepository.createBusinessProfile({
      identityId: identity.id,
      legalName: data.profile.legalName,
      businessType: data.profile.businessType,
      registrationNumber: data.profile.registrationNumber,
    });

    // Create auth principals
    const principals: AuthPrincipal[] = [];
    for (const principalData of data.principals) {
      // Check for existing principal
      const existing = await this.identityRepository.findAuthPrincipalByValue(
        principalData.type,
        principalData.value.toLowerCase(),
      );
      if (existing) {
        throw new ConflictException({
          code: 'PRINCIPAL_EXISTS',
          message: `${principalData.type} already registered`,
        });
      }

      const principal = await this.identityRepository.createAuthPrincipal({
        identityId: identity.id,
        principalType: principalData.type,
        principalValue: principalData.value.toLowerCase(),
        isPrimary: principalData.isPrimary || false,
        isVerified: false,
        isActive: true,
      });
      principals.push(principal);
    }

    // Create KYC profile
    await this.identityRepository.createKycProfile({
      identityId: identity.id,
      kycTier: 'tier_0',
      status: 'not_started',
    });

    // Log event if enabled
    if (this.featureFlags.enableIdentityEventLogging) {
      await this.identityRepository.createIdentityEvent({
        identityId: identity.id,
        eventType: 'created',
        description: 'Business identity created',
      });
    }

    return { identity, businessProfile, principals };
  }

  /**
   * Get business profile for identity
   */
  async getBusinessProfile(identityId: string): Promise<BusinessProfile | null> {
    return this.identityRepository.findBusinessProfileByIdentityId(identityId);
  }

  /**
   * Check if registration number already exists
   */
  async checkRegistrationNumberExists(registrationNumber: string): Promise<boolean> {
    const profile = await this.identityRepository.findBusinessProfileByRegistrationNumber(registrationNumber);
    return !!profile;
  }

  /**
   * Update business profile
   */
  async updateBusinessProfile(
    identityId: string,
    data: Partial<{
      legalName: string;
      tradingName: string;
      businessType: 'sole_proprietorship' | 'partnership' | 'private_limited' | 'public_limited' | 'limited_liability' | 'enterprise' | 'nonprofit' | 'ngo' | 'cooperative' | 'government' | 'other';
      registrationNumber: string;
      taxIdentificationNumber: string;
      registeredAddress: string;
      operatingAddress: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
      businessEmail: string;
      businessPhone: string;
      website: string;
      industryCode: string;
      industryDescription: string;
    }>,
  ): Promise<BusinessProfile> {
    const profile = await this.identityRepository.findBusinessProfileByIdentityId(identityId);
    if (!profile) {
      throw new NotFoundException({
        code: 'PROFILE_NOT_FOUND',
        message: 'Business profile not found',
      });
    }

    return this.identityRepository.updateBusinessProfile(identityId, data);
  }

  // ==================== BUSINESS RELATIONSHIPS ====================

  /**
   * Add a principal/director to a business
   */
  async addBusinessRelationship(
    businessIdentityId: string,
    data: {
      name: string;
      role: 'owner' | 'director' | 'signatory' | 'admin' | 'operator' | 'staff';
      ownershipPercentage?: number;
      positionTitle?: string;
    },
  ): Promise<BusinessRelationship> {
    this.logger.log(`Adding business relationship: businessId=${businessIdentityId}, name=${data.name}, role=${data.role}`);

    // Verify the business identity exists and is a legal entity
    const identity = await this.identityRepository.findIdentityById(businessIdentityId);
    if (!identity) {
      throw new NotFoundException({
        code: 'IDENTITY_NOT_FOUND',
        message: 'Business identity not found',
      });
    }
    if (identity.identityType !== 'legal_entity') {
      throw new ConflictException({
        code: 'NOT_A_BUSINESS',
        message: 'Identity is not a business',
      });
    }

    // Create a shell person identity for the director/principal
    // In a real system, you might want to link to existing person identities
    const personIdentity = await this.identityRepository.createIdentity({
      identityType: 'natural_person',
      status: 'shell',
      riskLevel: 'low',
    });
    this.logger.log(`Created person identity: ${personIdentity.id} for business relationship`);

    // Create a minimal person profile for the director
    const personProfile = await this.identityRepository.createPersonProfile({
      identityId: personIdentity.id,
      firstName: data.name.split(' ')[0] || data.name,
      lastName: data.name.split(' ').slice(1).join(' ') || '',
    });
    this.logger.log(`Created person profile: ${personProfile.id} for person identity ${personIdentity.id}`);

    // Create the business relationship
    const relationship = await this.identityRepository.createBusinessRelationship({
      businessIdentityId,
      personIdentityId: personIdentity.id,
      role: data.role,
      ownershipPercentage: data.ownershipPercentage,
      positionTitle: data.positionTitle,
      startDate: new Date(),
    });
    this.logger.log(`Created business relationship: ${relationship.id} linking business ${businessIdentityId} to person ${personIdentity.id}`);

    // Log event if enabled
    if (this.featureFlags.enableIdentityEventLogging) {
      await this.identityRepository.createIdentityEvent({
        identityId: businessIdentityId,
        eventType: 'relationship_added',
        description: `Added ${data.role}: ${data.name}`,
      });
    }

    return relationship;
  }

  /**
   * Get business relationships (directors/principals)
   */
  async getBusinessRelationships(businessIdentityId: string): Promise<BusinessRelationship[]> {
    return this.identityRepository.findBusinessRelationshipsByBusinessId(businessIdentityId);
  }

  /**
   * Count business relationships
   */
  async countBusinessRelationships(businessIdentityId: string): Promise<number> {
    return this.identityRepository.countBusinessRelationships(businessIdentityId);
  }

  /**
   * Check if business has required principals
   */
  async hasRequiredPrincipals(businessIdentityId: string): Promise<boolean> {
    const count = await this.countBusinessRelationships(businessIdentityId);
    return count >= 1; // Require at least one director/principal
  }

  /**
   * Find business relationship by ID
   */
  async findBusinessRelationshipById(relationshipId: string) {
    return this.identityRepository.findBusinessRelationshipById(relationshipId);
  }

  /**
   * Update business relationship
   */
  async updateBusinessRelationship(
    relationshipId: string,
    data: {
      role?: 'owner' | 'director' | 'signatory' | 'admin' | 'operator' | 'staff';
      ownershipPercentage?: number;
      positionTitle?: string;
    },
  ) {
    return this.identityRepository.updateBusinessRelationship(relationshipId, data);
  }

  /**
   * Remove business relationship
   */
  async removeBusinessRelationship(relationshipId: string): Promise<boolean> {
    return this.identityRepository.deleteBusinessRelationship(relationshipId);
  }

  // ==================== MFA BACKUP CODES ====================

  /**
   * Generate MFA backup codes for an identity
   * Returns the plain text codes (only shown once)
   */
  async generateBackupCodes(identityId: string): Promise<string[]> {
    // Delete existing backup codes
    await this.identityRepository.deleteBackupCodes(identityId);

    // Generate 10 new backup codes
    const codes: string[] = [];
    const hashedCodes: { identityId: string; codeHash: string }[] = [];
    const crypto = await import('crypto');
    const argon2 = await import('argon2');

    for (let i = 0; i < 10; i++) {
      // Generate a random 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);

      // Hash the code for storage
      const codeHash = await argon2.hash(code, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      hashedCodes.push({
        identityId,
        codeHash,
      });
    }

    // Store hashed codes
    await this.identityRepository.createBackupCodes(hashedCodes);

    return codes;
  }

  /**
   * Verify a backup code
   * Returns true if valid and marks the code as used
   */
  async verifyBackupCode(identityId: string, code: string): Promise<boolean> {
    const argon2 = await import('argon2');
    const unusedCodes = await this.identityRepository.findUnusedBackupCodes(identityId);

    for (const storedCode of unusedCodes) {
      try {
        if (await argon2.verify(storedCode.codeHash, code.toUpperCase())) {
          // Mark the code as used
          await this.identityRepository.markBackupCodeUsed(storedCode.id);
          return true;
        }
      } catch {
        // Continue to next code
      }
    }

    return false;
  }

  /**
   * Get count of remaining backup codes
   */
  async getRemainingBackupCodeCount(identityId: string): Promise<number> {
    return this.identityRepository.countUnusedBackupCodes(identityId);
  }

  /**
   * Check if identity has backup codes
   */
  async hasBackupCodes(identityId: string): Promise<boolean> {
    const count = await this.identityRepository.countUnusedBackupCodes(identityId);
    return count > 0;
  }

  /**
   * Delete all backup codes for an identity
   */
  async deleteBackupCodes(identityId: string): Promise<void> {
    await this.identityRepository.deleteBackupCodes(identityId);
  }
}
