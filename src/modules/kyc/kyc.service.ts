import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { KycRepository } from './kyc.repository';
import { IdentityService } from '@modules/identity/identity.service';
import { QoreidService, VerificationParams } from '@modules/qoreid/qoreid.service';
import { KycDocument } from '@database/schemas';

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
   */
  async getKycStatus(identityId: string): Promise<{
    currentTier: string;
    documentsSubmitted: number;
    documentsVerified: number;
    documentsPending: number;
    documentsRejected: number;
    tierProgress: Record<string, boolean>;
    nextTierRequirements: string[];
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

    return {
      currentTier,
      documentsSubmitted: documents.length,
      documentsVerified: verifiedDocs.length,
      documentsPending: documents.filter((d) => d.status === 'pending').length,
      documentsRejected: documents.filter((d) => d.status === 'rejected').length,
      tierProgress,
      nextTierRequirements,
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
