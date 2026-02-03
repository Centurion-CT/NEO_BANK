import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { IdentityService } from '@modules/identity/identity.service';
import { PermissionsService } from '@modules/permissions/permissions.service';
import { KycService } from '@modules/kyc/kyc.service';
import { SupportService } from '@modules/support/support.service';
import { SessionsService } from '@modules/sessions/sessions.service';
import { AuditService } from '@modules/audit/audit.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly identityService: IdentityService,
    private readonly permissionsService: PermissionsService,
    private readonly kycService: KycService,
    private readonly supportService: SupportService,
    private readonly sessionsService: SessionsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Get system-wide statistics
   */
  async getSystemStats() {
    const [
      totalIdentities,
      activeIdentities,
      suspendedIdentities,
      pendingKYC,
      verifiedKYC,
      rejectedKYC,
      openSupport,
      sessionStats,
    ] = await Promise.all([
      this.identityService.count(),
      this.identityService.countByStatus('active'),
      this.identityService.countByStatus('suspended'),
      this.kycService.countDocumentsByStatus('pending'),
      this.kycService.countDocumentsByStatus('verified'),
      this.kycService.countDocumentsByStatus('rejected'),
      this.supportService.countByStatus('open'),
      this.sessionsService.findAllSessions(1, 0), // Just to get counts
    ]);

    return {
      totalUsers: totalIdentities,
      activeUsers: activeIdentities,
      suspendedUsers: suspendedIdentities,
      pendingKYC,
      verifiedKYC,
      rejectedKYC,
      openSupport,
      activeSessions: sessionStats.active,
      totalSessions: sessionStats.total,
    };
  }

  /**
   * List identities with pagination
   */
  async listUsers(limit = 20, offset = 0) {
    const [identities, total] = await Promise.all([
      this.identityService.findAll(limit, offset),
      this.identityService.count(),
    ]);

    // Get full identity data with profiles
    const data = await Promise.all(
      identities.map(async (identity) => {
        const fullIdentity = await this.identityService.getFullIdentity(identity.id);
        if (!fullIdentity) return null;
        const { personProfile, principals, kycProfile } = fullIdentity;
        const emailPrincipal = principals.find(p => p.principalType === 'email');
        const phonePrincipal = principals.find(p => p.principalType === 'phone');
        return {
          id: identity.id,
          email: emailPrincipal?.principalValue,
          phone: phonePrincipal?.principalValue,
          firstName: personProfile?.firstName,
          lastName: personProfile?.lastName,
          status: identity.status,
          tier: kycProfile?.kycTier || 'tier_0',
          createdAt: identity.createdAt,
        };
      }),
    );

    return { data: data.filter(Boolean), total };
  }

  /**
   * Get a single identity by ID with full details and stats
   */
  async getUser(identityId: string) {
    const fullIdentity = await this.identityService.getFullIdentity(identityId);
    if (!fullIdentity) {
      throw new NotFoundException({
        code: 'IDENTITY_NOT_FOUND',
        message: 'Identity not found',
      });
    }
    const { identity, personProfile, principals, kycProfile } = fullIdentity;
    const emailPrincipal = principals.find(p => p.principalType === 'email');
    const phonePrincipal = principals.find(p => p.principalType === 'phone');

    // Get roles
    const identityRoles = await this.permissionsService.getIdentityRoles(identityId);
    const roleTypes = identityRoles.map(r => r.type);
    const primaryRole = roleTypes.length > 0 ? roleTypes[0] : 'user';

    // Get session count
    const activeSessionCount = await this.sessionsService.getSessionCount(identityId);

    // Check for MFA (TOTP secret)
    const totpSecret = await this.identityService.getAuthSecret(identityId, 'totp');

    return {
      id: identity.id,
      email: emailPrincipal?.principalValue || '',
      phone: phonePrincipal?.principalValue || null,
      firstName: personProfile?.firstName || '',
      lastName: personProfile?.lastName || '',
      middleName: personProfile?.middleName || null,
      dateOfBirth: personProfile?.dateOfBirth?.toISOString() || null,
      status: identity.status,
      type: identity.identityType,
      tier: kycProfile?.kycTier || 'tier_0',
      role: primaryRole,
      roles: roleTypes.length > 0 ? roleTypes : ['user'],
      emailVerified: emailPrincipal?.isVerified || false,
      phoneVerified: phonePrincipal?.isVerified || false,
      mfaEnabled: !!totpSecret,
      profilePictureUrl: personProfile?.profilePictureUrl || null,
      createdAt: identity.createdAt.toISOString(),
      updatedAt: identity.updatedAt.toISOString(),
      // Stats
      activeSessionCount,
      accountCount: 0, // TODO: Add when accounts module is integrated
      transactionCount: 0, // TODO: Add when transactions module is integrated
    };
  }

  /**
   * Update identity date of birth
   */
  async updateUserDob(identityId: string, dateOfBirth: string) {
    const identity = await this.identityService.findById(identityId);
    if (!identity) {
      throw new NotFoundException({
        code: 'IDENTITY_NOT_FOUND',
        message: 'Identity not found',
      });
    }
    const profile = await this.identityService.updatePersonProfile(identityId, {
      dateOfBirth: new Date(dateOfBirth),
    });
    return { id: identityId, dateOfBirth: profile.dateOfBirth };
  }

  /**
   * Update identity status
   */
  async updateUserStatus(identityId: string, status: string, adminId?: string) {
    const identity = await this.identityService.findById(identityId);
    if (!identity) {
      throw new NotFoundException({
        code: 'IDENTITY_NOT_FOUND',
        message: 'Identity not found',
      });
    }
    this.logger.log(`Admin updating identity ${identityId} status to ${status}`);
    return this.identityService.updateStatus(
      identityId,
      status as 'shell' | 'pending_verification' | 'active' | 'suspended' | 'closed' | 'rejected',
      adminId,
      'Admin status update',
    );
  }

  /**
   * Get KYC review queue
   */
  async getKycQueue(limit = 20, offset = 0) {
    const [data, pending, verified, rejected] = await Promise.all([
      this.kycService.findAllDocuments(limit, offset),
      this.kycService.countDocumentsByStatus('pending'),
      this.kycService.countDocumentsByStatus('verified'),
      this.kycService.countDocumentsByStatus('rejected'),
    ]);
    return { data, total: pending + verified + rejected, pending, verified, rejected };
  }

  /**
   * Review a KYC document
   */
  async reviewKycDocument(
    docId: string,
    status: string,
    reviewNotes: string | undefined,
    adminId: string,
  ) {
    this.logger.log(`Admin ${adminId} reviewing KYC doc ${docId} → ${status}`);
    return this.kycService.reviewDocument(docId, status, reviewNotes, adminId);
  }

  /**
   * List support requests
   */
  async listSupportRequests(limit = 20, offset = 0) {
    return this.supportService.findAllRequests(limit, offset);
  }

  /**
   * List all sessions with stats
   */
  async listSessions(limit = 20, offset = 0) {
    return this.sessionsService.findAllSessions(limit, offset);
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: string) {
    this.logger.log(`Admin terminating session ${sessionId}`);
    return this.sessionsService.revokeSessionAdmin(sessionId);
  }

  /**
   * Terminate all sessions for a user
   */
  async terminateAllUserSessions(userId: string) {
    this.logger.log(`Admin terminating all sessions for user ${userId}`);
    return this.sessionsService.revokeAllSessionsAdmin(userId);
  }

  /**
   * Get audit logs with pagination and filters
   */
  async listAuditLogs(options: {
    limit: number;
    offset: number;
    action?: string;
    status?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    return this.auditService.findAll(options);
  }

  /**
   * Get audit log stats
   */
  async getAuditStats() {
    return this.auditService.getStats();
  }

  /**
   * Get business profile for an identity
   */
  async getBusinessProfile(identityId: string) {
    const fullIdentity = await this.identityService.getFullIdentity(identityId);
    if (!fullIdentity) {
      throw new NotFoundException({
        code: 'IDENTITY_NOT_FOUND',
        message: 'Identity not found',
      });
    }

    if (fullIdentity.identity.identityType !== 'legal_entity') {
      throw new NotFoundException({
        code: 'NOT_BUSINESS_ACCOUNT',
        message: 'This is not a business account',
      });
    }

    const { businessProfile } = fullIdentity;
    if (!businessProfile) {
      throw new NotFoundException({
        code: 'BUSINESS_PROFILE_NOT_FOUND',
        message: 'Business profile not found',
      });
    }

    return {
      id: businessProfile.id,
      identityId: businessProfile.identityId,
      legalName: businessProfile.legalName,
      tradingName: businessProfile.tradingName,
      businessType: businessProfile.businessType,
      registrationNumber: businessProfile.registrationNumber,
      taxIdentificationNumber: businessProfile.taxIdentificationNumber,
      registrationDate: businessProfile.registrationDate,
      registrationCountry: businessProfile.registrationCountry,
      registeredAddress: businessProfile.registeredAddress,
      operatingAddress: businessProfile.operatingAddress,
      businessEmail: businessProfile.businessEmail,
      businessPhone: businessProfile.businessPhone,
      website: businessProfile.website,
      industryCode: businessProfile.industryCode,
      industryDescription: businessProfile.industryDescription,
      createdAt: businessProfile.createdAt,
      updatedAt: businessProfile.updatedAt,
    };
  }

  /**
   * Get business principals/directors for an identity
   */
  async getBusinessPrincipals(identityId: string) {
    const fullIdentity = await this.identityService.getFullIdentity(identityId);
    if (!fullIdentity) {
      throw new NotFoundException({
        code: 'IDENTITY_NOT_FOUND',
        message: 'Identity not found',
      });
    }

    if (fullIdentity.identity.identityType !== 'legal_entity') {
      throw new NotFoundException({
        code: 'NOT_BUSINESS_ACCOUNT',
        message: 'This is not a business account',
      });
    }

    // Get business relationships (principals/directors)
    const relationships = await this.identityService.getBusinessRelationships(identityId);

    // For each relationship, get the person profile
    const principals = await Promise.all(
      relationships.map(async (rel) => {
        const personIdentity = await this.identityService.getFullIdentity(rel.personIdentityId);
        const personProfile = personIdentity?.personProfile;

        return {
          id: rel.id,
          personIdentityId: rel.personIdentityId,
          name: personProfile
            ? `${personProfile.firstName || ''} ${personProfile.lastName || ''}`.trim()
            : 'Unknown',
          role: rel.role,
          ownershipPercentage: rel.ownershipPercentage,
          positionTitle: rel.positionTitle,
          startDate: rel.startDate,
          endDate: rel.endDate,
          isVerified: rel.isVerified,
          verifiedAt: rel.verifiedAt,
          createdAt: rel.createdAt,
        };
      }),
    );

    return {
      businessId: identityId,
      principals,
      totalCount: principals.length,
    };
  }

  /**
   * Create a new admin user
   */
  async createAdmin(dto: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    loginMode?: 'pin' | 'password';
    pin?: string;
    password?: string;
  }) {
    const existing = await this.identityService.findByEmail(dto.email.toLowerCase());
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_EXISTS',
        message: 'An account with this email already exists',
      });
    }

    // Determine login mode and validate credentials
    const loginMode = dto.loginMode || (dto.password ? 'password' : 'pin');
    const credential = loginMode === 'password' ? dto.password : dto.pin;

    if (!credential) {
      throw new ConflictException({
        code: 'MISSING_CREDENTIAL',
        message: loginMode === 'password' ? 'Password is required' : 'PIN is required',
      });
    }

    const credentialHash = await argon2.hash(credential, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Create identity with profile and principals
    const { identity, profile } = await this.identityService.createIdentityWithProfile({
      identityType: 'natural_person',
      profile: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        preferredLoginMode: loginMode,
      },
      principals: [
        { type: 'email', value: dto.email.toLowerCase(), isPrimary: true },
        { type: 'phone', value: dto.phone },
      ],
    });

    // Set auth secret (PIN or password)
    await this.identityService.setAuthSecret(identity.id, loginMode, credentialHash);

    // Activate identity
    await this.identityService.updateStatus(identity.id, 'active');

    // Assign admin role via RBAC
    const adminRole = await this.permissionsService.findRoleByType('admin');
    if (adminRole) {
      await this.permissionsService.assignRoleToIdentity(identity.id, adminRole.id, identity.id);
    }

    this.logger.log(`Admin identity created: ${dto.email} (login mode: ${loginMode})`);

    return {
      id: identity.id,
      email: dto.email.toLowerCase(),
      firstName: profile.firstName,
      lastName: profile.lastName,
      role: 'admin',
      loginMode,
    };
  }
}
