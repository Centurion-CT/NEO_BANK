import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { KycRepository } from './kyc.repository';
import { IdentityService } from '@modules/identity/identity.service';
import { QoreidService, VerificationParams } from '@modules/qoreid/qoreid.service';
import { KycDocument, KycProfile } from '@database/schemas';

/**
 * KYC Profile Status types
 */
export type KycProfileStatus =
  | 'not_started'
  | 'in_progress'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'suspended';

/**
 * Valid KYC status transitions
 *
 * State Machine:
 * NOT_STARTED → IN_PROGRESS (start)
 * IN_PROGRESS → PENDING_REVIEW (submit)
 * PENDING_REVIEW → IN_PROGRESS (request_update - back to editing)
 * PENDING_REVIEW → APPROVED (approve)
 * PENDING_REVIEW → REJECTED (reject)
 * REJECTED → IN_PROGRESS (resubmit)
 * EXPIRED → IN_PROGRESS (renew)
 */
const KYC_STATUS_TRANSITIONS: Record<KycProfileStatus, KycProfileStatus[]> = {
  'not_started': ['in_progress'],
  'in_progress': ['pending_review'],
  'pending_review': ['in_progress', 'approved', 'rejected'],
  'approved': ['expired', 'suspended'],
  'rejected': ['in_progress'], // Can retry submission
  'expired': ['in_progress'], // Can renew KYC
  'suspended': ['in_progress', 'approved'], // Admin can reinstate
};

export interface UploadDocumentDto {
  documentType: string;
  documentNumber?: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  expiryDate?: Date;
}

export interface DigitalVerificationDto {
  documentType: 'nin' | 'bvn' | 'drivers_license' | 'passport' | 'voters_card';
  documentNumber: string;
  firstname: string;
  lastname: string;
  middlename?: string;
  dob?: string;
  phone?: string;
  email?: string;
  gender?: string;
}

export interface VerificationResult {
  success: boolean;
  verified: boolean;
  matchPercentage: number;
  verificationId?: number;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * KYC Service
 *
 * Business logic for KYC operations.
 * Handles document verification and tier upgrades.
 * Integrates with Qoreid for digital identity verification.
 *
 * SECURITY: All document uploads must be validated
 * and stored securely with encryption.
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  // Document types required for each tier
  private readonly tierRequirements: Record<string, string[]> = {
    basic: [], // Tier 1 - no documents needed (email/phone verification only)
    verified: ['bvn', 'government_id', 'utility_bill'], // Tier 2
    premium: ['bvn', 'government_id', 'utility_bill', 'address_proof', 'selfie'], // Tier 3 (Individual)
    business: ['bvn', 'cac_certificate', 'memart', 'business_utility_bill'], // Tier 3 (Business)
  };

  constructor(
    private readonly kycRepository: KycRepository,
    private readonly identityService: IdentityService,
    private readonly qoreidService: QoreidService,
  ) {}

  // ============================================================================
  // KYC State Machine
  // ============================================================================

  /**
   * Check if a status transition is valid
   */
  isValidTransition(
    currentStatus: KycProfileStatus,
    targetStatus: KycProfileStatus,
  ): boolean {
    const validTargets = KYC_STATUS_TRANSITIONS[currentStatus] || [];
    return validTargets.includes(targetStatus);
  }

  /**
   * Transition KYC profile status with validation
   * @throws ConflictException if transition is invalid
   */
  async transitionKycStatus(
    identityId: string,
    targetStatus: KycProfileStatus,
    reviewerId?: string,
    reviewNotes?: string,
  ): Promise<KycProfile> {
    const kycProfile = await this.identityService.getKycProfile(identityId);

    if (!kycProfile) {
      throw new NotFoundException({
        code: 'KYC_PROFILE_NOT_FOUND',
        message: 'KYC profile not found for this identity',
      });
    }

    const currentStatus = kycProfile.status as KycProfileStatus;

    if (!this.isValidTransition(currentStatus, targetStatus)) {
      throw new ConflictException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Cannot transition from ${currentStatus} to ${targetStatus}`,
        currentStatus,
        targetStatus,
        validTransitions: KYC_STATUS_TRANSITIONS[currentStatus] || [],
      });
    }

    // Build update data with explicit types to match service signature
    const updateData: {
      status?: KycProfileStatus;
      verificationStartedAt?: Date;
      lastReviewedAt?: Date;
      verificationCompletedAt?: Date;
      reviewedBy?: string;
      reviewNotes?: string;
      rejectionCount?: string;
    } = {
      status: targetStatus,
    };

    // Add timestamps based on transition
    if (targetStatus === 'in_progress' && currentStatus === 'not_started') {
      updateData.verificationStartedAt = new Date();
    }

    if (targetStatus === 'pending_review') {
      // Profile submitted for review - timestamp captured via updatedAt
    }

    if (targetStatus === 'approved' || targetStatus === 'rejected') {
      updateData.lastReviewedAt = new Date();
      updateData.verificationCompletedAt = new Date();
      if (reviewerId) {
        updateData.reviewedBy = reviewerId;
      }
      if (reviewNotes) {
        updateData.reviewNotes = reviewNotes;
      }
    }

    if (targetStatus === 'rejected') {
      // Increment rejection count
      const currentCount = parseInt(kycProfile.rejectionCount || '0', 10);
      updateData.rejectionCount = String(currentCount + 1);
    }

    return this.identityService.updateKycProfile(identityId, updateData);
  }

  /**
   * Start KYC process for an identity
   * Transition: NOT_STARTED → IN_PROGRESS
   */
  async startKyc(identityId: string): Promise<KycProfile> {
    this.logger.log(`Starting KYC for identity ${identityId}`);
    return this.transitionKycStatus(identityId, 'in_progress');
  }

  /**
   * Submit personal KYC for review
   * Transition: IN_PROGRESS → PENDING_REVIEW
   *
   * Validates:
   * - Required documents are uploaded
   * - Profile is in editable state
   */
  async submitPersonalKyc(identityId: string): Promise<KycProfile> {
    this.logger.log(`Submitting personal KYC for identity ${identityId}`);

    // Validate required documents are present
    const documents = await this.kycRepository.findByIdentityId(identityId);
    const requiredTypes = ['government_id']; // At minimum, need govt ID

    const uploadedTypes = new Set(documents.map((d) => d.documentType));
    const missingDocs = requiredTypes.filter((t) => !uploadedTypes.has(t));

    if (missingDocs.length > 0) {
      throw new BadRequestException({
        code: 'MISSING_REQUIRED_DOCUMENTS',
        message: 'Required documents not uploaded',
        missingDocuments: missingDocs,
      });
    }

    // Check for any pending or rejected docs that should block submission
    const pendingOrRejected = documents.filter(
      (d) => d.status === 'pending' || d.status === 'rejected',
    );

    if (pendingOrRejected.some((d) => d.status === 'rejected')) {
      throw new BadRequestException({
        code: 'REJECTED_DOCUMENTS_EXIST',
        message: 'Please re-upload rejected documents before submitting',
      });
    }

    return this.transitionKycStatus(identityId, 'pending_review');
  }

  /**
   * Submit business KYC for review
   * Transition: IN_PROGRESS → PENDING_REVIEW
   *
   * Validates:
   * - Board resolution document present
   * - CAC certificate present
   * - At least one business relationship exists
   */
  async submitBusinessKyc(
    identityId: string,
    tenantId: string,
  ): Promise<{ kycProfile: KycProfile; message: string }> {
    this.logger.log(`Submitting business KYC for tenant ${tenantId}`);

    // Get the full identity with business profile
    const fullIdentity = await this.identityService.getFullIdentity(identityId);

    if (!fullIdentity || fullIdentity.identity.identityType !== 'legal_entity') {
      throw new BadRequestException({
        code: 'NOT_BUSINESS_IDENTITY',
        message: 'This identity is not a business account',
      });
    }

    // Validate required documents
    const documents = await this.kycRepository.findByIdentityId(identityId);
    const requiredTypes = ['cac_certificate', 'board_resolution'];

    const uploadedTypes = new Set(documents.map((d) => d.documentType));
    const missingDocs = requiredTypes.filter((t) => !uploadedTypes.has(t));

    if (missingDocs.length > 0) {
      throw new BadRequestException({
        code: 'MISSING_REQUIRED_DOCUMENTS',
        message: 'Required business documents not uploaded',
        missingDocuments: missingDocs,
      });
    }

    // Validate at least one business relationship exists
    const relationshipsCount =
      await this.identityService.countBusinessRelationships(identityId);

    if (relationshipsCount === 0) {
      throw new BadRequestException({
        code: 'NO_BUSINESS_RELATIONSHIPS',
        message:
          'At least one business relationship (owner/director) must be added before submission',
      });
    }

    // Transition KYC profile status
    const kycProfile = await this.transitionKycStatus(
      identityId,
      'pending_review',
    );

    return {
      kycProfile,
      message: 'Business KYC submitted successfully. It will be reviewed by our compliance team.',
    };
  }

  /**
   * Admin action: Request updates from user
   * Transition: PENDING_REVIEW → IN_PROGRESS
   */
  async requestKycUpdate(
    identityId: string,
    reviewerId: string,
    reason: string,
  ): Promise<KycProfile> {
    this.logger.log(`Requesting KYC update for identity ${identityId}`);
    return this.transitionKycStatus(
      identityId,
      'in_progress',
      reviewerId,
      `Update requested: ${reason}`,
    );
  }

  /**
   * Admin action: Reject KYC
   * Transition: PENDING_REVIEW → REJECTED
   */
  async rejectKyc(
    identityId: string,
    reviewerId: string,
    reason: string,
  ): Promise<KycProfile> {
    this.logger.log(`Rejecting KYC for identity ${identityId}`);

    const kycProfile = await this.transitionKycStatus(
      identityId,
      'rejected',
      reviewerId,
      reason,
    );

    // Update rejection reason separately
    return this.identityService.updateKycProfile(identityId, {
      rejectionReason: reason,
    });
  }

  /**
   * Admin action: Approve KYC
   * Transition: PENDING_REVIEW → APPROVED
   */
  async approveKyc(
    identityId: string,
    reviewerId: string,
    notes?: string,
  ): Promise<KycProfile> {
    this.logger.log(`Approving KYC for identity ${identityId}`);
    return this.transitionKycStatus(
      identityId,
      'approved',
      reviewerId,
      notes || 'KYC approved',
    );
  }

  // ============================================================================
  // Digital Identity Verification (via Qoreid)
  // ============================================================================

  /**
   * Verify identity document digitally via Qoreid
   */
  async verifyIdentity(
    identityId: string,
    dto: DigitalVerificationDto,
  ): Promise<VerificationResult> {
    this.logger.log(`Digital verification for identity ${identityId}: ${dto.documentType}`);

    const params: VerificationParams = {
      firstname: dto.firstname,
      lastname: dto.lastname,
      middlename: dto.middlename,
      dob: dto.dob,
      phone: dto.phone,
      email: dto.email,
      gender: dto.gender,
    };

    try {
      let response;

      switch (dto.documentType) {
        case 'nin':
          response = await this.qoreidService.verifyNIN(dto.documentNumber, params);
          break;
        case 'bvn':
          response = await this.qoreidService.verifyBVNBasic(dto.documentNumber, params);
          break;
        case 'drivers_license':
          response = await this.qoreidService.verifyDriversLicense(dto.documentNumber, params);
          break;
        case 'passport':
          response = await this.qoreidService.verifyPassport(dto.documentNumber, params);
          break;
        case 'voters_card':
          response = await this.qoreidService.verifyVotersCard(dto.documentNumber, params);
          break;
        default:
          throw new BadRequestException({
            code: 'INVALID_DOCUMENT_TYPE',
            message: `Document type ${dto.documentType} is not supported for digital verification`,
          });
      }

      const isVerified = this.qoreidService.isVerificationSuccessful(response);
      const matchPercentage = this.qoreidService.getMatchPercentage(response);

      // Create KYC document record
      await this.kycRepository.create({
        identityId,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        status: isVerified ? 'verified' : 'rejected',
        fileUrl: '', // No file for digital verification
        fileName: `${dto.documentType}_digital_verification`,
        fileSize: 0,
        mimeType: 'application/json',
        verifiedAt: isVerified ? new Date() : undefined,
        reviewNotes: isVerified
          ? `Digitally verified via Qoreid. Match: ${matchPercentage}%`
          : `Verification failed. Match: ${matchPercentage}%`,
      });

      this.logger.log(
        `Verification result for identity ${identityId}: ${isVerified ? 'VERIFIED' : 'FAILED'} (${matchPercentage}%)`,
      );

      return {
        success: true,
        verified: isVerified,
        matchPercentage,
        verificationId: response.id,
        data: {
          status: response.status,
          summary: response.summary,
        },
      };
    } catch (error) {
      this.logger.error(`Verification failed for identity ${identityId}`, error.message);

      console.log("error", error)

      return {
        success: false,
        verified: false,
        matchPercentage: 0,
        error: error.message || 'Verification failed',
      };
    }
  }

  /**
   * Verify BVN with boolean match (cheaper option)
   */
  async verifyBVNMatch(
    identityId: string,
    bvn: string,
    params: VerificationParams,
  ): Promise<VerificationResult> {
    this.logger.log(`BVN match verification for identity ${identityId}`);

    try {
      const response = await this.qoreidService.verifyBVNMatch(bvn, params);
      const isVerified = this.qoreidService.isVerificationSuccessful(response);
      const matchPercentage = this.qoreidService.getMatchPercentage(response);

      // Update or create KYC record
      await this.kycRepository.create({
        identityId,
        documentType: 'bvn',
        documentNumber: bvn,
        status: isVerified ? 'verified' : 'rejected',
        fileUrl: '',
        fileName: 'bvn_match_verification',
        fileSize: 0,
        mimeType: 'application/json',
        verifiedAt: isVerified ? new Date() : undefined,
        reviewNotes: `BVN Match: ${matchPercentage}%`,
      });

      return {
        success: true,
        verified: isVerified,
        matchPercentage,
        verificationId: response.id,
      };
    } catch (error) {
      this.logger.error(`BVN match verification failed for identity ${identityId}`, error.message);
      return {
        success: false,
        verified: false,
        matchPercentage: 0,
        error: error.message,
      };
    }
  }

  /**
   * Verify NIN using phone number
   */
  async verifyNINWithPhone(
    identityId: string,
    phone: string,
    params: VerificationParams,
  ): Promise<VerificationResult> {
    this.logger.log(`NIN phone verification for identity ${identityId}`);

    try {
      const response = await this.qoreidService.verifyNINWithPhone(phone, params);
      const isVerified = this.qoreidService.isVerificationSuccessful(response);
      const matchPercentage = this.qoreidService.getMatchPercentage(response);

      await this.kycRepository.create({
        identityId,
        documentType: 'nin',
        documentNumber: response.nin?.nin || '',
        status: isVerified ? 'verified' : 'rejected',
        fileUrl: '',
        fileName: 'nin_phone_verification',
        fileSize: 0,
        mimeType: 'application/json',
        verifiedAt: isVerified ? new Date() : undefined,
        reviewNotes: `NIN verified via phone. Match: ${matchPercentage}%`,
      });

      return {
        success: true,
        verified: isVerified,
        matchPercentage,
        verificationId: response.id,
        data: {
          nin: response.nin?.nin ? `****${response.nin.nin.slice(-4)}` : null,
        },
      };
    } catch (error) {
      this.logger.error(`NIN phone verification failed for identity ${identityId}`, error.message);
      return {
        success: false,
        verified: false,
        matchPercentage: 0,
        error: error.message,
      };
    }
  }

  /**
   * Verify bank account (NUBAN)
   */
  async verifyBankAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<{
    success: boolean;
    accountName?: string;
    error?: string;
  }> {
    try {
      const response = await this.qoreidService.verifyBankAccount(accountNumber, bankCode);
      return {
        success: true,
        accountName: response.accountName,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // Admin Methods
  // ============================================================================

  /**
   * Find all KYC documents with pagination (admin)
   */
  async findAllDocuments(limit: number, offset: number): Promise<KycDocument[]> {
    return this.kycRepository.findAll(limit, offset);
  }

  /**
   * Count documents by status (admin)
   */
  async countDocumentsByStatus(status: string): Promise<number> {
    return this.kycRepository.countByStatus(status);
  }

  /**
   * Review a KYC document (admin)
   */
  async reviewDocument(
    docId: string,
    status: string,
    reviewNotes: string | undefined,
    adminId: string,
  ): Promise<KycDocument> {
    return this.kycRepository.updateStatus(docId, status, reviewNotes, adminId);
  }

  // ============================================================================
  // Document Upload & Management
  // ============================================================================

  /**
   * Upload a new KYC document
   */
  async uploadDocument(
    identityId: string,
    dto: UploadDocumentDto,
  ): Promise<KycDocument> {
    // Validate file type
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];

    if (!allowedMimeTypes.includes(dto.mimeType)) {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'Invalid file type. Allowed: JPEG, PNG, WEBP, PDF',
      });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (dto.fileSize > maxSize) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds 10MB limit',
      });
    }

    return this.kycRepository.create({
      identityId,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
      fileUrl: dto.fileUrl,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType,
      expiryDate: dto.expiryDate,
      status: 'pending',
    });
  }

  /**
   * Get all documents for an identity
   */
  async getDocuments(identityId: string): Promise<KycDocument[]> {
    return this.kycRepository.findByIdentityId(identityId);
  }

  /**
   * Get document by ID with ownership verification
   */
  async getDocument(id: string, identityId: string): Promise<KycDocument> {
    const document = await this.kycRepository.findById(id);

    if (!document) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: 'Document not found',
      });
    }

    if (document.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'DOCUMENT_ACCESS_DENIED',
        message: 'Access denied to this document',
      });
    }

    return document;
  }

  // ============================================================================
  // KYC Status & Tier Management
  // ============================================================================

  /**
   * Get KYC status summary for an identity
   * Includes profile status for state machine tracking (GAP-009)
   */
  async getKycStatus(identityId: string): Promise<{
    currentTier: string;
    documentsSubmitted: number;
    documentsVerified: number;
    documentsPending: number;
    documentsRejected: number;
    tierProgress: Record<string, boolean>;
    nextTierRequirements: string[];
    profileStatus: KycProfileStatus;
    rejectionReason?: string;
  }> {
    const kycProfile = await this.identityService.getKycProfile(identityId);
    const documents = await this.kycRepository.findByIdentityId(identityId);

    const verifiedDocs = documents.filter((d) => d.status === 'verified');
    const verifiedTypes = new Set(verifiedDocs.map((d) => d.documentType));

    // Map KYC tiers to legacy tier names for compatibility
    const tierMap: Record<string, string> = {
      'tier_0': 'basic',
      'tier_1': 'basic',
      'tier_2': 'verified',
      'tier_3': 'premium',
    };
    const currentTier = kycProfile ? tierMap[kycProfile.kycTier] || 'basic' : 'basic';
    const nextTier = currentTier === 'basic' ? 'verified' : currentTier === 'verified' ? 'premium' : null;

    const tierProgress: Record<string, boolean> = {};
    const nextTierRequirements: string[] = [];

    if (nextTier) {
      const required = this.tierRequirements[nextTier];
      for (const docType of required) {
        tierProgress[docType] = verifiedTypes.has(docType);
        if (!verifiedTypes.has(docType)) {
          nextTierRequirements.push(docType);
        }
      }
    }

    // Profile status from state machine
    const profileStatus = (kycProfile?.status as KycProfileStatus) || 'not_started';

    return {
      currentTier,
      documentsSubmitted: documents.length,
      documentsVerified: verifiedDocs.length,
      documentsPending: documents.filter((d) => d.status === 'pending').length,
      documentsRejected: documents.filter((d) => d.status === 'rejected').length,
      tierProgress,
      nextTierRequirements,
      profileStatus,
      rejectionReason: kycProfile?.rejectionReason || undefined,
    };
  }

  /**
   * Check if identity can upgrade to a specific tier
   */
  async canUpgradeToTier(identityId: string, targetTier: string): Promise<boolean> {
    const documents = await this.kycRepository.findByIdentityId(identityId);
    const verifiedDocs = documents.filter((d) => d.status === 'verified');
    const verifiedTypes = new Set(verifiedDocs.map((d) => d.documentType));

    const required = this.tierRequirements[targetTier] || [];
    return required.every((docType) => verifiedTypes.has(docType));
  }

  /**
   * Request tier upgrade
   */
  async requestTierUpgrade(identityId: string, targetTier: string): Promise<void> {
    const canUpgrade = await this.canUpgradeToTier(identityId, targetTier);

    if (!canUpgrade) {
      throw new BadRequestException({
        code: 'TIER_REQUIREMENTS_NOT_MET',
        message: 'Required documents not verified for this tier',
      });
    }

    // For business tier, also check principals requirement
    if (targetTier === 'business') {
      const fullIdentity = await this.identityService.getFullIdentity(identityId);

      if (!fullIdentity || fullIdentity.identity.identityType !== 'legal_entity') {
        throw new BadRequestException({
          code: 'NOT_BUSINESS_ACCOUNT',
          message: 'Business tier upgrade is only available for business accounts',
        });
      }

      // Check business type and required principals
      const businessType = fullIdentity.businessProfile?.businessType;
      const requiredPrincipals = businessType === 'enterprise' ? 2 : 1;
      const principalsCount = await this.identityService.countBusinessRelationships(identityId);

      if (principalsCount < requiredPrincipals) {
        throw new BadRequestException({
          code: 'PRINCIPALS_REQUIRED',
          message: `Business requires at least ${requiredPrincipals} principal(s). Currently have ${principalsCount}.`,
        });
      }
    }

    // Map legacy tier names to KYC tier
    const tierMap: Record<string, 'tier_0' | 'tier_1' | 'tier_2' | 'tier_3'> = {
      'basic': 'tier_1',
      'verified': 'tier_2',
      'premium': 'tier_3',
      'business': 'tier_3',
    };
    const kycTier = tierMap[targetTier] || 'tier_1';

    // Update KYC profile tier
    await this.identityService.updateKycProfile(identityId, { kycTier });
  }
}
