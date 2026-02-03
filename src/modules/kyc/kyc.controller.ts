import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

import { KycService } from './kyc.service';
import { BunnyStorageService } from '@common/services/bunny-storage.service';
import { IdentityService } from '@modules/identity/identity.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { RequestTierUpgradeDto } from './dto/request-tier-upgrade.dto';
import { VerifyIdentityDto } from './dto/verify-identity.dto';

/**
 * KYC Controller
 * Identity verification and document management endpoints
 */
@ApiTags('KYC')
@Controller('kyc')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class KycController {
  constructor(
    private readonly kycService: KycService,
    private readonly bunnyStorageService: BunnyStorageService,
    private readonly identityService: IdentityService,
  ) {}

  /**
   * Get KYC status
   */
  @Get('status')
  @ApiOperation({
    summary: 'Get KYC status',
    description: 'Returns KYC verification status and tier progress',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC status retrieved successfully',
  })
  async getKycStatus(@CurrentUser('id') userId: string) {
    return this.kycService.getKycStatus(userId);
  }

  /**
   * Get all documents
   */
  @Get('documents')
  @ApiOperation({
    summary: 'Get all documents',
    description: 'Returns all KYC documents for the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Documents retrieved successfully',
  })
  async getDocuments(@CurrentUser('id') userId: string) {
    const documents = await this.kycService.getDocuments(userId);
    return documents.map((doc) => ({
      id: doc.id,
      documentType: doc.documentType,
      status: doc.status,
      fileName: doc.fileName,
      createdAt: doc.createdAt,
      verifiedAt: doc.verifiedAt,
      reviewNotes: doc.status === 'rejected' ? doc.reviewNotes : undefined,
    }));
  }

  /**
   * Get document details
   */
  @Get('documents/:id')
  @ApiOperation({
    summary: 'Get document details',
    description: 'Returns details for a specific document',
  })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Document retrieved successfully',
  })
  async getDocument(
    @CurrentUser('id') userId: string,
    @Param('id') documentId: string,
  ) {
    const doc = await this.kycService.getDocument(documentId, userId);
    return {
      id: doc.id,
      documentType: doc.documentType,
      documentNumber: doc.documentNumber ? '****' + doc.documentNumber.slice(-4) : null,
      status: doc.status,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      expiryDate: doc.expiryDate,
      createdAt: doc.createdAt,
      verifiedAt: doc.verifiedAt,
      reviewNotes: doc.status === 'rejected' ? doc.reviewNotes : undefined,
    };
  }

  /**
   * Upload document (JSON body with pre-uploaded file URL)
   */
  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload document',
    description: 'Upload a KYC document for verification',
  })
  @ApiResponse({
    status: 201,
    description: 'Document uploaded successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid document',
  })
  async uploadDocument(
    @CurrentUser('id') userId: string,
    @Body() uploadDto: UploadDocumentDto,
  ) {
    const document = await this.kycService.uploadDocument(userId, {
      documentType: uploadDto.documentType,
      documentNumber: uploadDto.documentNumber,
      fileUrl: uploadDto.fileUrl,
      fileName: uploadDto.fileName,
      fileSize: uploadDto.fileSize,
      mimeType: uploadDto.mimeType,
      expiryDate: uploadDto.expiryDate ? new Date(uploadDto.expiryDate) : undefined,
    });

    return {
      id: document.id,
      documentType: document.documentType,
      status: document.status,
      message: 'Document uploaded successfully. Verification in progress.',
    };
  }

  /**
   * Upload document file (multipart form-data)
   * Uploads file to Bunny CDN and creates KYC document record
   */
  @Post('documents/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException({
              code: 'INVALID_FILE_TYPE',
              message: 'Allowed file types: JPEG, PNG, WEBP, PDF',
            }),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload document file',
    description: 'Upload a KYC document file to cloud storage and create record',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: {
          type: 'string',
          enum: [
            'government_id',
            'utility_bill',
            'selfie',
            'passport',
            'drivers_license',
            'address_proof',
            // Business document types
            'cac_certificate',
            'memart',
            'business_utility_bill',
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or document type' })
  async uploadDocumentFile(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'A file must be provided',
      });
    }

    const validTypes = [
      'government_id',
      'utility_bill',
      'selfie',
      'passport',
      'drivers_license',
      'address_proof',
      // Business document types
      'cac_certificate',
      'memart',
      'business_utility_bill',
    ];
    if (!documentType || !validTypes.includes(documentType)) {
      throw new BadRequestException({
        code: 'INVALID_DOCUMENT_TYPE',
        message: `documentType must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Determine file extension from mimetype
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };
    const ext = extMap[file.mimetype] || 'bin';
    const timestamp = Date.now();
    const storagePath = `kyc/${userId}/${documentType}-${timestamp}.${ext}`;

    // Upload to Bunny CDN
    const cdnUrl = await this.bunnyStorageService.uploadFile(
      file.buffer,
      storagePath,
      file.mimetype,
    );

    // Create KYC document record
    const document = await this.kycService.uploadDocument(userId, {
      documentType,
      fileUrl: cdnUrl,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    });

    return {
      id: document.id,
      documentType: document.documentType,
      status: document.status,
      fileUrl: cdnUrl,
      message: 'Document uploaded successfully. Verification in progress.',
    };
  }

  /**
   * Verify identity digitally (BVN / NIN via Qoreid)
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify identity',
    description: 'Verify BVN or NIN digitally via Qoreid. Missing name/DOB fields are filled from the user profile.',
  })
  @ApiResponse({ status: 200, description: 'Verification result returned' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async verifyIdentity(
    @CurrentUser('id') identityId: string,
    @Body() dto: VerifyIdentityDto,
  ) {
    // Look up identity profile to fill missing fields
    const fullIdentity = await this.identityService.getFullIdentity(identityId);
    const personProfile = fullIdentity?.personProfile;

    const firstname = dto.firstname || personProfile?.firstName || '';
    const lastname = dto.lastname || personProfile?.lastName || '';
    const dob = dto.dob || (personProfile?.dateOfBirth ? personProfile.dateOfBirth.toISOString().split('T')[0] : undefined);

    if (!firstname || !lastname) {
      throw new BadRequestException({
        code: 'MISSING_NAME',
        message: 'First name and last name are required for verification. Please update your profile.',
      });
    }

    return this.kycService.verifyIdentity(identityId, {
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
      firstname,
      lastname,
      dob,
    });
  }

  /**
   * Request tier upgrade
   */
  @Post('upgrade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request tier upgrade',
    description: 'Request upgrade to a higher account tier',
  })
  @ApiResponse({
    status: 200,
    description: 'Tier upgraded successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Requirements not met',
  })
  async requestTierUpgrade(
    @CurrentUser('id') userId: string,
    @Body() upgradeDto: RequestTierUpgradeDto,
  ) {
    await this.kycService.requestTierUpgrade(userId, upgradeDto.targetTier);
    return {
      success: true,
      message: `Successfully upgraded to ${upgradeDto.targetTier}`,
    };
  }
}
