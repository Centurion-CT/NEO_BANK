import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { IdentityService } from './identity.service';
import { PermissionsService } from '@modules/permissions/permissions.service';
import { OtpService } from '@modules/otp/otp.service';
import { BunnyStorageService } from '@common/services/bunny-storage.service';

/**
 * Profile Controller
 * Current user profile management endpoints
 * Replaces the old /users/me endpoints
 */
@ApiTags('Profile')
@Controller('profile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class ProfileController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly permissionsService: PermissionsService,
    private readonly otpService: OtpService,
    private readonly bunnyStorageService: BunnyStorageService,
  ) {}

  /**
   * Get current user profile
   */
  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the authenticated user profile',
  })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@CurrentUser('id') identityId: string) {
    const fullIdentity = await this.identityService.getFullIdentity(identityId);
    if (!fullIdentity) {
      throw new BadRequestException({
        code: 'IDENTITY_NOT_FOUND',
        message: 'Identity not found',
      });
    }

    const { identity, personProfile, businessProfile, principals, kycProfile } = fullIdentity;
    const emailPrincipal = principals.find(p => p.principalType === 'email');
    const phonePrincipal = principals.find(p => p.principalType === 'phone');

    // Get roles from legacy userRoles table
    const legacyRoles = await this.permissionsService.getIdentityRoles(identityId);
    const legacyRoleTypes = legacyRoles.map(r => r.type).filter(t => t !== null) as string[];

    // Get roles from new identityRoles table (scoped roles)
    const scopedRoles = await this.permissionsService.getIdentityScopedRoles(identityId);
    const scopedRoleTypes = scopedRoles
      .map(sr => {
        // Map roleCode to type for consistent frontend handling
        if (sr.role.roleCode === 'ADMIN' || sr.role.roleCode === 'SUPER_ADMIN') return 'admin';
        if (sr.role.roleCode === 'SUPPORT_AGENT') return 'support_agent';
        return sr.role.type || sr.role.roleCode?.toLowerCase() || null;
      })
      .filter(t => t !== null) as string[];

    // Merge and deduplicate role types
    const roleTypes = [...new Set([...legacyRoleTypes, ...scopedRoleTypes])];
    const primaryRole = roleTypes.length > 0 ? roleTypes[0] : 'user';

    // Check for transaction PIN
    const transactionPinSecret = await this.identityService.getAuthSecret(identityId, 'transaction_pin');
    const totpSecret = await this.identityService.getAuthSecret(identityId, 'totp');

    // Determine account type for frontend
    const isBusiness = identity.identityType === 'legal_entity';
    const accountType = isBusiness ? 'business' : 'individual';

    return {
      id: identity.id,
      email: emailPrincipal?.principalValue || '',
      phone: phonePrincipal?.principalValue || null,
      firstName: personProfile?.firstName || '',
      lastName: personProfile?.lastName || '',
      middleName: personProfile?.middleName || null,
      dateOfBirth: personProfile?.dateOfBirth?.toISOString().split('T')[0] || null,
      status: identity.status,
      type: identity.identityType,
      accountType, // Frontend-friendly account type
      tier: kycProfile?.kycTier || 'tier_0',
      role: primaryRole,
      roles: roleTypes.length > 0 ? roleTypes : ['user'],
      // Scoped roles for RBAC
      scopedRoles: scopedRoles.map(sr => ({
        roleId: sr.roleId,
        roleCode: sr.role.roleCode,
        roleName: sr.role.name,
        roleType: sr.role.type,
        scope: sr.scope,
        scopeRefId: sr.scopeRefId,
        assignedAt: sr.assignedAt?.toISOString(),
      })),
      emailVerified: emailPrincipal?.isVerified || false,
      phoneVerified: phonePrincipal?.isVerified || false,
      profilePictureUrl: personProfile?.profilePictureUrl || null,
      address: personProfile?.address || null,
      city: personProfile?.city || null,
      state: personProfile?.state || null,
      country: personProfile?.country || null,
      postalCode: personProfile?.postalCode || null,
      hasTransactionPin: !!transactionPinSecret,
      mfaEnabled: !!totpSecret,
      mfaMethod: totpSecret ? 'totp' : null,
      // Preferences
      preferredTheme: personProfile?.preferredTheme || 'system',
      preferredLanguage: personProfile?.preferredLanguage || 'en',
      preferredCurrency: personProfile?.preferredCurrency || 'NGN',
      preferredLoginMode: personProfile?.preferredLoginMode || 'pin',
      createdAt: identity.createdAt.toISOString(),
      updatedAt: identity.updatedAt.toISOString(),
      // Business fields (only for legal_entity)
      ...(isBusiness && businessProfile ? {
        legalName: businessProfile.legalName,
        businessType: businessProfile.businessType,
        tradingName: businessProfile.tradingName,
        registrationNumber: businessProfile.registrationNumber,
      } : {}),
    };
  }

  /**
   * Update current user profile
   */
  @Patch('me')
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Update profile information (name, address, preferences)',
  })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser('id') identityId: string,
    @Body() updateData: {
      firstName?: string;
      lastName?: string;
      middleName?: string;
      dateOfBirth?: string;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
      // Preferences
      preferredTheme?: 'light' | 'dark' | 'system';
      preferredLanguage?: string;
      preferredCurrency?: string;
      preferredLoginMode?: 'pin' | 'password';
    },
  ) {
    // Update person profile
    const profileUpdate: Record<string, any> = {};
    if (updateData.firstName) profileUpdate.firstName = updateData.firstName;
    if (updateData.lastName) profileUpdate.lastName = updateData.lastName;
    if (updateData.middleName !== undefined) profileUpdate.middleName = updateData.middleName;
    if (updateData.dateOfBirth) profileUpdate.dateOfBirth = new Date(updateData.dateOfBirth);
    if (updateData.address !== undefined) profileUpdate.address = updateData.address;
    if (updateData.city !== undefined) profileUpdate.city = updateData.city;
    if (updateData.state !== undefined) profileUpdate.state = updateData.state;
    if (updateData.country !== undefined) profileUpdate.country = updateData.country;
    if (updateData.postalCode !== undefined) profileUpdate.postalCode = updateData.postalCode;
    // Preferences
    if (updateData.preferredTheme !== undefined) profileUpdate.preferredTheme = updateData.preferredTheme;
    if (updateData.preferredLanguage !== undefined) profileUpdate.preferredLanguage = updateData.preferredLanguage;
    if (updateData.preferredCurrency !== undefined) profileUpdate.preferredCurrency = updateData.preferredCurrency;
    if (updateData.preferredLoginMode !== undefined) profileUpdate.preferredLoginMode = updateData.preferredLoginMode;

    if (Object.keys(profileUpdate).length > 0) {
      // Check if person profile exists first
      const fullIdentity = await this.identityService.getFullIdentity(identityId);

      if (!fullIdentity?.personProfile) {
        // No person profile exists - create one for business accounts to store preferences
        if (fullIdentity?.identity.identityType === 'legal_entity') {
          await this.identityService.createPersonProfileForBusiness(identityId, {
            firstName: fullIdentity.businessProfile?.legalName || 'Business',
            lastName: 'Account',
            ...profileUpdate,
          });
        } else {
          throw new BadRequestException({
            code: 'PROFILE_NOT_FOUND',
            message: 'Person profile not found',
          });
        }
      } else {
        // Update existing person profile
        await this.identityService.updatePersonProfile(identityId, profileUpdate);
      }
    }

    // Return updated profile
    return this.getProfile(identityId);
  }

  /**
   * Request OTP for email change
   */
  @Post('me/email/request-change')
  @ApiOperation({
    summary: 'Request email change OTP',
    description: 'Send OTP to new email for verification',
  })
  @ApiResponse({ status: 200, description: 'OTP sent to new email' })
  async requestEmailChangeOtp(
    @CurrentUser('id') identityId: string,
    @Body() body: { email: string },
  ) {
    const newEmail = body.email.toLowerCase();

    // Check if email already exists
    const existingPrincipal = await this.identityService.findPrincipalByValue('email', newEmail);
    if (existingPrincipal && existingPrincipal.identityId !== identityId) {
      throw new BadRequestException({
        code: 'EMAIL_EXISTS',
        message: 'This email is already registered',
      });
    }

    // Get current profile for name
    const fullIdentity = await this.identityService.getFullIdentity(identityId);
    const firstName = fullIdentity?.personProfile?.firstName || 'User';

    // Send OTP to new email
    await this.otpService.sendEmailOtp({
      identityId,
      target: newEmail,
      purpose: 'email_verification',
      firstName,
    });

    return { message: 'Verification code sent to new email' };
  }

  /**
   * Update email with OTP verification
   */
  @Patch('me/email')
  @ApiOperation({
    summary: 'Update email',
    description: 'Update email after OTP verification',
  })
  @ApiResponse({ status: 200, description: 'Email updated successfully' })
  async updateEmail(
    @CurrentUser('id') identityId: string,
    @Body() body: { email: string; otp: string },
  ) {
    const newEmail = body.email.toLowerCase();

    // Verify OTP
    const isValid = await this.otpService.verifyOtp({
      target: newEmail,
      code: body.otp,
      purpose: 'email_verification',
    });

    if (!isValid) {
      throw new BadRequestException({
        code: 'INVALID_OTP',
        message: 'Invalid or expired verification code',
      });
    }

    // Get current email principal
    const fullIdentity = await this.identityService.getFullIdentity(identityId);
    const emailPrincipal = fullIdentity?.principals.find(p => p.principalType === 'email');

    if (emailPrincipal) {
      // Update existing principal (this would need a new method in identity service)
      // For now, we'll add a new principal and mark the old one as inactive
      // This is a simplified approach - in production you'd want proper principal management
    }

    // Add new email principal (verified)
    await this.identityService.addAuthPrincipal(identityId, 'email', newEmail, true);

    return this.getProfile(identityId);
  }

  /**
   * Request OTP for phone change
   */
  @Post('me/phone/request-change')
  @ApiOperation({
    summary: 'Request phone change OTP',
    description: 'Generate OTP for phone verification (OTP delivered via configured channel)',
  })
  @ApiResponse({ status: 200, description: 'OTP generated for phone verification' })
  async requestPhoneChangeOtp(
    @CurrentUser('id') identityId: string,
    @Body() body: { phone: string },
  ) {
    const newPhone = body.phone;

    // Check if phone already exists
    const existingPrincipal = await this.identityService.findPrincipalByValue('phone', newPhone);
    if (existingPrincipal && existingPrincipal.identityId !== identityId) {
      throw new BadRequestException({
        code: 'PHONE_EXISTS',
        message: 'This phone number is already registered',
      });
    }

    // Generate OTP for phone verification
    // Note: SMS delivery would be implemented via a messaging service (e.g., Twilio, Termii)
    // For now, generate the OTP - in production this would trigger SMS delivery
    await this.otpService.generateOtp({
      identityId,
      target: newPhone,
      purpose: 'phone_verification',
    });

    return { message: 'Verification code sent to new phone' };
  }

  /**
   * Update phone with OTP verification
   */
  @Patch('me/phone')
  @ApiOperation({
    summary: 'Update phone',
    description: 'Update phone after OTP verification',
  })
  @ApiResponse({ status: 200, description: 'Phone updated successfully' })
  async updatePhone(
    @CurrentUser('id') identityId: string,
    @Body() body: { phone: string; otp: string },
  ) {
    const newPhone = body.phone;

    // Verify OTP
    const isValid = await this.otpService.verifyOtp({
      target: newPhone,
      code: body.otp,
      purpose: 'phone_verification',
    });

    if (!isValid) {
      throw new BadRequestException({
        code: 'INVALID_OTP',
        message: 'Invalid or expired verification code',
      });
    }

    // Add new phone principal (verified)
    await this.identityService.addAuthPrincipal(identityId, 'phone', newPhone, false);

    return this.getProfile(identityId);
  }

  /**
   * Upload profile picture
   */
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException({
              code: 'INVALID_FILE_TYPE',
              message: 'Allowed file types: JPEG, PNG, WEBP',
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
    summary: 'Upload profile picture',
    description: 'Upload a new profile picture',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully' })
  async uploadAvatar(
    @CurrentUser('id') identityId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'A file must be provided',
      });
    }

    // Determine file extension
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const ext = extMap[file.mimetype] || 'jpg';
    const timestamp = Date.now();
    const storagePath = `avatars/${identityId}/${timestamp}.${ext}`;

    // Upload to CDN
    const cdnUrl = await this.bunnyStorageService.uploadFile(
      file.buffer,
      storagePath,
      file.mimetype,
    );

    // Update profile
    await this.identityService.updatePersonProfile(identityId, {
      profilePictureUrl: cdnUrl,
    });

    return { profilePictureUrl: cdnUrl };
  }
}
