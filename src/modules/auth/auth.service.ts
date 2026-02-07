import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { eq, lt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import {
  pendingBusinessRegistrations,
  PendingBusinessRegistration,
  PendingBusinessRegistrationData,
} from '@database/schemas';

import { encrypt, decrypt } from '@common/utils/encryption.util';
import { IdentityService } from '@modules/identity/identity.service';
import { PermissionsService } from '@modules/permissions/permissions.service';
import { TenantsService } from '@modules/tenants/tenants.service';
import { PropertiesService } from '@modules/properties/properties.service';
import { OtpService, OtpPurpose } from '@modules/otp/otp.service';
import { SessionsService, SessionInfo } from '@modules/sessions/sessions.service';
import { MailService } from '@modules/mail/mail.service';
import { DevicesService } from '@modules/devices/devices.service';
import { RegisterDto, AddBusinessPrincipalDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePinDto } from './dto/change-pin.dto';
import {
  SetTransactionPinDto,
  ChangeTransactionPinDto,
} from './dto/transaction-pin.dto';
import { ForgotPinDto, ResetPinDto } from './dto/forgot-pin.dto';

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  deviceName?: string;
  deviceFingerprint?: string;
  deviceType?: 'web' | 'ios' | 'android' | 'desktop' | 'unknown';
  deviceModel?: string;
  osName?: string;
  osVersion?: string;
  channel?: 'web' | 'mobile_android' | 'mobile_ios' | 'ussd' | 'api';
}

interface TokenPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh' | 'mfa_challenge';
  sessionId?: string;
}

/**
 * Authentication Service
 *
 * Uses the new identity/authentication compliance model:
 * - Identities: Root identity object
 * - PersonProfiles: User profile data
 * - AuthPrincipals: Login identifiers (email, phone)
 * - AuthSecrets: Credentials (PIN, transaction PIN, TOTP)
 *
 * SECURITY IMPLEMENTATION:
 * - PIN hashing with Argon2id (memory-hard algorithm)
 * - JWT with short expiration (15m access, 7d refresh)
 * - Account lockout after failed attempts
 * - Session tracking and revocation
 * - Comprehensive audit logging
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly identityService: IdentityService,
    private readonly permissionsService: PermissionsService,
    private readonly tenantsService: TenantsService,
    private readonly propertiesService: PropertiesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly sessionsService: SessionsService,
    private readonly mailService: MailService,
    private readonly devicesService: DevicesService,
  ) {}

  // ============================================================================
  // REGISTRATION & LOGIN
  // ============================================================================

  /**
   * Send OTP to email for registration verification
   * Must be called before registration to verify email ownership
   */
  async sendRegistrationOtp(email: string) {
    const normalizedEmail = email.toLowerCase();

    // Check if email already exists
    const existingEmail = await this.identityService.findPrincipalByValue('email', normalizedEmail);
    if (existingEmail) {
      throw new ConflictException({
        code: 'EMAIL_EXISTS',
        message: 'An account with this email already exists',
      });
    }

    // Send OTP
    await this.otpService.sendEmailOtp({
      target: normalizedEmail,
      purpose: 'email_verification',
    });

    this.logger.log(`Registration OTP sent to ${this.maskTarget(normalizedEmail)}`);

    return {
      message: `Verification code sent to ${this.maskTarget(normalizedEmail)}`,
    };
  }

  /**
   * Register a new user (individual or business)
   * Requires email OTP verification
   */
  async register(registerDto: RegisterDto, context: RequestContext) {
    const email = registerDto.email.toLowerCase();
    const phone = registerDto.phone;

    // Verify email OTP first
    try {
      await this.otpService.verifyOtp({
        target: email,
        purpose: 'email_verification',
        code: registerDto.emailOtp,
      });
    } catch {
      throw new BadRequestException({
        code: 'INVALID_OTP',
        message: 'Invalid or expired verification code',
      });
    }

    // Check if email already exists (double-check after OTP verification)
    const existingEmail = await this.identityService.findPrincipalByValue('email', email);
    if (existingEmail) {
      throw new ConflictException({
        code: 'EMAIL_EXISTS',
        message: 'An account with this email already exists',
      });
    }

    // Check if phone already exists
    const existingPhone = await this.identityService.findPrincipalByValue('phone', phone);
    if (existingPhone) {
      throw new ConflictException({
        code: 'PHONE_EXISTS',
        message: 'An account with this phone number already exists',
      });
    }

    // Hash password with Argon2id
    const passwordHash = await this.hashPin(registerDto.password);

    let identity: any;
    let principals: any[];
    let userResponse: any;

    if (registerDto.accountType === 'business') {
      // Business registration
      const registrationNumber = registerDto.businessType === 'limited_liability'
        ? registerDto.rcNumber
        : registerDto.registrationNumber;

      const result = await this.identityService.createBusinessIdentityWithProfile({
        profile: {
          legalName: registerDto.legalName!,
          businessType: registerDto.businessType!,
          registrationNumber,
        },
        principals: [
          { type: 'email', value: email, isPrimary: true },
          { type: 'phone', value: phone, isPrimary: true },
        ],
      });

      identity = result.identity;
      principals = result.principals;

      const emailPrincipal = principals.find(p => p.principalType === 'email');
      const phonePrincipal = principals.find(p => p.principalType === 'phone');

      // Mark email as verified since OTP was verified during registration
      if (emailPrincipal) {
        await this.identityService.verifyPrincipal(emailPrincipal.id);
      }

      userResponse = {
        id: identity.id,
        email: email,
        phone: phone,
        accountType: 'business',
        legalName: registerDto.legalName,
        businessType: registerDto.businessType,
        status: identity.status,
        tier: 'basic',
        emailVerified: true, // Email verified via OTP during registration
        phoneVerified: phonePrincipal?.isVerified || false,
        role: 'user',
        requiresOnboarding: true, // Business accounts need to add principals
        onboardingStep: 'add_principal',
      };

      // Send business welcome email
      this.mailService.sendWelcomeEmail(email, {
        firstName: registerDto.legalName!,
        lastName: '',
      }).catch(() => {
        this.logger.warn(`Failed to send welcome email to ${email}`);
      });

      this.logger.log(`Business registered: ${registerDto.legalName} (${email}) from ${context.ipAddress}`);

    } else {
      // Individual registration
      const result = await this.identityService.createIdentityWithProfile({
        identityType: 'natural_person',
        profile: {
          firstName: registerDto.firstName!,
          lastName: registerDto.lastName!,
          preferredLoginMode: 'password',
        },
        principals: [
          { type: 'email', value: email, isPrimary: true },
          { type: 'phone', value: phone, isPrimary: true },
        ],
      });

      identity = result.identity;
      principals = result.principals;

      const emailPrincipal = principals.find(p => p.principalType === 'email');
      const phonePrincipal = principals.find(p => p.principalType === 'phone');

      // Mark email as verified since OTP was verified during registration
      if (emailPrincipal) {
        await this.identityService.verifyPrincipal(emailPrincipal.id);
      }

      userResponse = {
        id: identity.id,
        email: email,
        phone: phone,
        accountType: 'individual',
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        status: identity.status,
        tier: 'basic',
        emailVerified: true, // Email verified via OTP during registration
        phoneVerified: phonePrincipal?.isVerified || false,
        role: 'user',
        requiresOnboarding: false,
      };

      // Send welcome email
      this.mailService.sendWelcomeEmail(email, {
        firstName: registerDto.firstName!,
        lastName: registerDto.lastName!,
      }).catch(() => {
        this.logger.warn(`Failed to send welcome email to ${email}`);
      });

      this.logger.log(`User registered: ${email} from ${context.ipAddress}`);
    }

    // Store password in auth_secrets
    await this.identityService.setAuthSecret(identity.id, 'password', passwordHash);

    // ================================================================
    // ASSIGN ROLES AND PROPERTIES
    // ================================================================
    await this.assignRolesAndPropertiesToNewUser(
      identity.id,
      registerDto.accountType === 'business',
      registerDto.legalName,
      context.channel,
    );

    // Generate tokens
    const tokens = await this.generateTokens(identity.id, email);

    // Create session
    const session = await this.sessionsService.createSession({
      identityId: identity.id,
      refreshToken: tokens.refreshToken,
      deviceId: context.deviceId,
      deviceName: context.deviceName,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress || 'unknown',
    });

    // Log identity event
    await this.identityService.logEvent(identity.id, 'created', {
      description: registerDto.accountType === 'business' ? 'Business registered' : 'User registered',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      user: userResponse,
      ...tokens,
      sessionId: session.id,
    };
  }

  /**
   * Login with email/phone and PIN or Password
   */
  async login(loginDto: LoginDto, context: RequestContext) {
    const { identifier, pin, password } = loginDto;
    const isEmail = identifier.includes('@');

    // Require at least one credential
    if (!pin && !password) {
      throw new BadRequestException({
        code: 'CREDENTIALS_REQUIRED',
        message: 'Either PIN or password is required',
      });
    }

    // Find principal by email or phone
    const principal = isEmail
      ? await this.identityService.findPrincipalByValue('email', identifier.toLowerCase())
      : await this.identityService.findPrincipalByValue('phone', identifier);

    if (!principal) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    // Get identity
    const identity = await this.identityService.findById(principal.identityId);
    if (!identity) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    // Determine which credential type to use
    const secretType = pin ? 'pin' : 'password';
    const credential = pin || password;

    // Get the appropriate secret
    const secret = await this.identityService.getAuthSecret(identity.id, secretType);
    if (!secret) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    // Check if account is locked
    if (secret.lockedUntil && new Date(secret.lockedUntil) > new Date()) {
      const remainingMinutes = Math.ceil(
        (new Date(secret.lockedUntil).getTime() - Date.now()) / 60000,
      );

      // Log failed attempt
      await this.identityService.logEvent(identity.id, 'login_failure', {
        description: 'Login attempt while account locked',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        message: `Account is temporarily locked. Please try again in ${remainingMinutes} minutes.`,
      });
    }

    // Verify credential
    const isValidCredential = await this.verifyPin(credential!, secret.secretHash);
    if (!isValidCredential) {
      await this.handleFailedLogin(identity.id, secret.id, context);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    // Reset failed attempts on successful login
    await this.identityService.resetSecretFailedAttempts(secret.id);

    // Check device binding (if user has a bound device, only allow login from that device)
    if (context.deviceFingerprint) {
      const deviceValidation = await this.devicesService.validateDeviceForLogin(
        identity.id,
        context.deviceFingerprint,
        context.deviceType || 'unknown',
      );

      if (!deviceValidation.allowed) {
        await this.identityService.logEvent(identity.id, 'login_failure', {
          description: 'Login blocked: device binding restriction',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          metadata: { reason: deviceValidation.reason },
        });

        throw new UnauthorizedException({
          code: 'DEVICE_BINDING_VIOLATION',
          message: deviceValidation.reason || 'Login not allowed from this device',
        });
      }

      // Register/update device on successful login
      await this.devicesService.registerDevice({
        identityId: identity.id,
        deviceFingerprint: context.deviceFingerprint,
        deviceType: context.deviceType || 'unknown',
        deviceName: context.deviceName,
        deviceModel: context.deviceModel,
        osName: context.osName,
        osVersion: context.osVersion,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      });
    }

    // Get full identity data
    const fullIdentity = await this.identityService.getFullIdentity(identity.id);
    const personProfile = fullIdentity?.personProfile;
    const kycProfile = fullIdentity?.kycProfile;
    const allPrincipals = fullIdentity?.principals || [];

    const emailPrincipal = allPrincipals.find(p => p.principalType === 'email');
    const phonePrincipal = allPrincipals.find(p => p.principalType === 'phone');
    const email = emailPrincipal?.principalValue || identifier;

    // Check for MFA - get the enabled method from profile
    const mfaMethod = await this.identityService.getMfaMethod(identity.id);

    if (mfaMethod) {
      const mfaToken = await this.jwtService.signAsync(
        { sub: identity.id, email, type: 'mfa_challenge', mfaMethod },
        {
          secret: this.configService.get<string>('jwt.accessSecret'),
          expiresIn: '5m',
        },
      );

      // For email/SMS MFA, send OTP automatically
      let maskedTarget: string | undefined;
      if (mfaMethod === 'email') {
        if (emailPrincipal) {
          await this.otpService.sendEmailOtp({
            identityId: identity.id,
            target: emailPrincipal.principalValue,
            purpose: 'login_mfa',
            firstName: personProfile?.firstName,
          });
          maskedTarget = this.maskTarget(emailPrincipal.principalValue);
          this.logger.log(`MFA email OTP sent to ${maskedTarget}`);
        }
      } else if (mfaMethod === 'sms') {
        if (phonePrincipal) {
          // For SMS, we'd use an SMS service. Using email for now as fallback.
          await this.otpService.sendEmailOtp({
            identityId: identity.id,
            target: phonePrincipal.principalValue,
            purpose: 'login_mfa',
            firstName: personProfile?.firstName,
          });
          maskedTarget = this.maskTarget(phonePrincipal.principalValue);
          this.logger.log(`MFA SMS OTP sent to ${maskedTarget}`);
        }
      }

      this.logger.log(`MFA challenge issued for user ${email} via ${mfaMethod}`);

      return {
        requiresMfa: true,
        mfaToken,
        mfaMethod,
        maskedTarget,
      };
    }

    // Generate tokens
    const tokens = await this.generateTokens(identity.id, email);

    // Create session
    const session = await this.sessionsService.createSession({
      identityId: identity.id,
      refreshToken: tokens.refreshToken,
      deviceId: context.deviceId,
      deviceName: context.deviceName,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress || 'unknown',
    });

    // Log successful login
    await this.identityService.logEvent(identity.id, 'login_success', {
      description: 'User logged in',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    this.logger.log(`User logged in: ${email} from ${context.ipAddress}`);

    // Check for transaction PIN
    const transactionPinSecret = await this.identityService.getAuthSecret(identity.id, 'transaction_pin');

    // Get scoped roles (new RBAC)
    const scopedRoles = await this.getScopedRolesForResponse(identity.id);

    // Get user roles from RBAC system (legacy)
    const identityRoles = await this.permissionsService.getIdentityRoles(identity.id);
    const roleTypes = identityRoles.map(r => r.type).filter(Boolean);

    // Merge role types from both legacy and scoped roles
    const scopedRoleTypes = scopedRoles
      .map(sr => {
        // Map roleCode to legacy type for backward compatibility
        if (sr.roleCode === 'ADMIN' || sr.roleCode === 'SUPER_ADMIN') return 'admin';
        if (sr.roleCode === 'SUPPORT_AGENT') return 'support_agent';
        return sr.roleCode?.toLowerCase() || null;
      })
      .filter((t): t is string => t !== null);

    const allRoleTypes = [...new Set([...roleTypes, ...scopedRoleTypes])];

    // Default to 'user' if no roles assigned
    const primaryRole = allRoleTypes.length > 0 ? allRoleTypes[0] : 'user';
    const allRoles = allRoleTypes.length > 0 ? allRoleTypes : ['user'];

    // Determine account type based on identity type
    const isBusinessAccount = identity.identityType === 'legal_entity';
    const accountType = isBusinessAccount ? 'business' : 'individual';
    const businessProfile = fullIdentity?.businessProfile;

    // Check if business account requires onboarding (no principals added yet)
    let requiresOnboarding = false;
    let onboardingStep: string | undefined;
    if (isBusinessAccount) {
      const hasPrincipals = await this.identityService.hasRequiredPrincipals(identity.id);
      requiresOnboarding = !hasPrincipals;
      onboardingStep = hasPrincipals ? undefined : 'add_principal';
    }

    return {
      user: {
        id: identity.id,
        email: email,
        phone: phonePrincipal?.principalValue,
        firstName: personProfile?.firstName || '',
        lastName: personProfile?.lastName || '',
        status: identity.status,
        tier: kycProfile?.kycTier || 'tier_0',
        emailVerified: emailPrincipal?.isVerified || false,
        phoneVerified: phonePrincipal?.isVerified || false,
        hasTransactionPin: !!transactionPinSecret,
        mfaEnabled: false, // If we reach here, MFA is not enabled (would have returned MFA challenge earlier)
        role: primaryRole,
        roles: allRoles,
        scopedRoles, // New scoped RBAC
        // Account type and business fields
        accountType,
        ...(isBusinessAccount && {
          legalName: businessProfile?.legalName,
          businessType: businessProfile?.businessType,
          requiresOnboarding,
          onboardingStep,
        }),
      },
      ...tokens,
      sessionId: session.id,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException({
          code: 'INVALID_TOKEN',
          message: 'Invalid token type',
        });
      }

      // Validate session
      const session = await this.sessionsService.validateSession(refreshToken);
      if (!session) {
        throw new UnauthorizedException({
          code: 'SESSION_EXPIRED',
          message: 'Session expired or revoked',
        });
      }

      const identity = await this.identityService.findById(payload.sub);
      if (!identity) {
        throw new UnauthorizedException({
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      // Get email from principals
      const fullIdentity = await this.identityService.getFullIdentity(identity.id);
      const emailPrincipal = fullIdentity?.principals.find(p => p.principalType === 'email');
      const email = emailPrincipal?.principalValue || payload.email;

      // Generate new tokens
      const tokens = await this.generateTokens(identity.id, email, session.id);

      // Rotate the session token
      await this.sessionsService.rotateToken(session.id, tokens.refreshToken);

      return {
        ...tokens,
        sessionId: session.id,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
      });
    }
  }

  /**
   * Logout - revoke session
   */
  async logout(userId: string, sessionId?: string) {
    if (sessionId) {
      await this.sessionsService.revokeSession(sessionId, userId);
    }

    await this.identityService.logEvent(userId, 'logout', {
      description: 'User logged out',
    });

    this.logger.log(`User ${userId} logged out`);
    return { message: 'Logged out successfully' };
  }

  // ============================================================================
  // OTP VERIFICATION
  // ============================================================================

  /**
   * Request OTP for verification
   */
  async requestOtp(
    target: string,
    purpose: OtpPurpose,
    identityId?: string,
    firstName?: string,
  ) {
    await this.otpService.sendEmailOtp({
      identityId,
      target,
      purpose,
      firstName,
    });

    return {
      message: `OTP sent to ${this.maskTarget(target)}`,
    };
  }

  /**
   * Verify OTP
   */
  async verifyOtp(target: string, purpose: OtpPurpose, code: string) {
    const isValid = await this.otpService.verifyOtp({
      target,
      purpose,
      code,
    });

    return { verified: isValid };
  }

  /**
   * Verify email address
   */
  async verifyEmail(userId: string, otp: string) {
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const emailPrincipal = fullIdentity.principals.find(p => p.principalType === 'email');
    if (!emailPrincipal) {
      throw new BadRequestException({
        code: 'NO_EMAIL',
        message: 'No email registered',
      });
    }

    if (emailPrincipal.isVerified) {
      return { message: 'Email already verified' };
    }

    // Verify OTP
    await this.otpService.verifyOtp({
      target: emailPrincipal.principalValue,
      purpose: 'email_verification',
      code: otp,
    });

    // Update principal as verified
    await this.identityService.verifyPrincipal(emailPrincipal.id);

    // Update identity status if shell
    const identity = fullIdentity.identity;
    if (identity.status === 'shell') {
      await this.identityService.updateStatus(userId, 'pending_verification');
    }

    await this.identityService.logEvent(userId, 'principal_verified', {
      description: 'Email verified',
      metadata: { principalType: 'email' },
    });

    this.logger.log(`Email verified for user ${userId}`);

    return { message: 'Email verified successfully' };
  }

  /**
   * Verify phone number
   */
  async verifyPhone(userId: string, otp: string) {
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const phonePrincipal = fullIdentity.principals.find(p => p.principalType === 'phone');
    if (!phonePrincipal) {
      throw new BadRequestException({
        code: 'NO_PHONE',
        message: 'No phone registered',
      });
    }

    if (phonePrincipal.isVerified) {
      return { message: 'Phone already verified' };
    }

    // Verify OTP
    await this.otpService.verifyOtp({
      target: phonePrincipal.principalValue,
      purpose: 'phone_verification',
      code: otp,
    });

    // Update principal as verified
    await this.identityService.verifyPrincipal(phonePrincipal.id);

    await this.identityService.logEvent(userId, 'principal_verified', {
      description: 'Phone verified',
      metadata: { principalType: 'phone' },
    });

    this.logger.log(`Phone verified for user ${userId}`);

    return { message: 'Phone verified successfully' };
  }

  /**
   * Request email verification OTP
   */
  async requestEmailVerification(userId: string) {
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const emailPrincipal = fullIdentity.principals.find(p => p.principalType === 'email');
    if (!emailPrincipal) {
      throw new BadRequestException({
        code: 'NO_EMAIL',
        message: 'No email registered',
      });
    }

    if (emailPrincipal.isVerified) {
      throw new BadRequestException({
        code: 'EMAIL_ALREADY_VERIFIED',
        message: 'Email is already verified',
      });
    }

    await this.otpService.sendEmailOtp({
      identityId: userId,
      target: emailPrincipal.principalValue,
      purpose: 'email_verification',
      firstName: fullIdentity.personProfile?.firstName,
    });

    return { message: `Verification code sent to ${this.maskTarget(emailPrincipal.principalValue)}` };
  }

  // ============================================================================
  // PIN MANAGEMENT
  // ============================================================================

  /**
   * Change login PIN
   */
  async changePin(userId: string, dto: ChangePinDto) {
    const { currentPin, newPin, confirmPin } = dto;

    if (newPin !== confirmPin) {
      throw new BadRequestException({
        code: 'PIN_MISMATCH',
        message: 'New PIN and confirmation do not match',
      });
    }

    if (currentPin === newPin) {
      throw new BadRequestException({
        code: 'SAME_PIN',
        message: 'New PIN must be different from current PIN',
      });
    }

    const pinSecret = await this.identityService.getAuthSecret(userId, 'pin');
    if (!pinSecret) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Verify current PIN
    const isValidPin = await this.verifyPin(currentPin, pinSecret.secretHash);
    if (!isValidPin) {
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PIN',
        message: 'Current PIN is incorrect',
      });
    }

    // Hash and update new PIN
    const newPinHash = await this.hashPin(newPin);
    await this.identityService.setAuthSecret(userId, 'pin', newPinHash);

    // Get email for notification
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    const emailPrincipal = fullIdentity?.principals.find(p => p.principalType === 'email');

    if (emailPrincipal) {
      this.mailService.sendSecurityAlertEmail(emailPrincipal.principalValue, {
        firstName: fullIdentity?.personProfile?.firstName || 'User',
        alertType: 'PIN Changed',
        description: 'Your login PIN has been changed.',
        date: new Date().toISOString(),
      }).catch(() => {
        this.logger.warn(`Failed to send PIN change alert`);
      });
    }

    await this.identityService.logEvent(userId, 'pin_changed', {
      description: 'Login PIN changed',
    });

    this.logger.log(`PIN changed for user ${userId}`);

    return { message: 'PIN changed successfully' };
  }

  /**
   * Set transaction PIN (first time)
   */
  async setTransactionPin(userId: string, dto: SetTransactionPinDto) {
    const { pin, confirmPin, loginPin } = dto;

    if (pin !== confirmPin) {
      throw new BadRequestException({
        code: 'PIN_MISMATCH',
        message: 'Transaction PIN and confirmation do not match',
      });
    }

    // Check if transaction PIN already set
    const existingTransactionPin = await this.identityService.getAuthSecret(userId, 'transaction_pin');
    if (existingTransactionPin) {
      throw new BadRequestException({
        code: 'TRANSACTION_PIN_EXISTS',
        message: 'Transaction PIN already set. Use change endpoint instead.',
      });
    }

    // Verify login PIN
    const loginPinSecret = await this.identityService.getAuthSecret(userId, 'pin');
    if (!loginPinSecret) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const isValidLoginPin = await this.verifyPin(loginPin, loginPinSecret.secretHash);
    if (!isValidLoginPin) {
      throw new BadRequestException({
        code: 'INVALID_LOGIN_PIN',
        message: 'Login PIN is incorrect',
      });
    }

    // Hash and store transaction PIN
    const transactionPinHash = await this.hashPin(pin);
    await this.identityService.setAuthSecret(userId, 'transaction_pin', transactionPinHash);

    await this.identityService.logEvent(userId, 'transaction_pin_set', {
      description: 'Transaction PIN set',
    });

    this.logger.log(`Transaction PIN set for user ${userId}`);

    return { message: 'Transaction PIN set successfully' };
  }

  /**
   * Change transaction PIN
   */
  async changeTransactionPin(userId: string, dto: ChangeTransactionPinDto) {
    const { currentPin, newPin, confirmPin } = dto;

    if (newPin !== confirmPin) {
      throw new BadRequestException({
        code: 'PIN_MISMATCH',
        message: 'New transaction PIN and confirmation do not match',
      });
    }

    if (currentPin === newPin) {
      throw new BadRequestException({
        code: 'SAME_PIN',
        message: 'New transaction PIN must be different from current',
      });
    }

    const transactionPinSecret = await this.identityService.getAuthSecret(userId, 'transaction_pin');
    if (!transactionPinSecret) {
      throw new BadRequestException({
        code: 'NO_TRANSACTION_PIN',
        message: 'Transaction PIN not set. Use setup endpoint first.',
      });
    }

    // Verify current transaction PIN
    const isValidPin = await this.verifyPin(currentPin, transactionPinSecret.secretHash);
    if (!isValidPin) {
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PIN',
        message: 'Current transaction PIN is incorrect',
      });
    }

    // Hash and update new transaction PIN
    const newPinHash = await this.hashPin(newPin);
    await this.identityService.setAuthSecret(userId, 'transaction_pin', newPinHash);

    await this.identityService.logEvent(userId, 'transaction_pin_changed', {
      description: 'Transaction PIN changed',
    });

    this.logger.log(`Transaction PIN changed for user ${userId}`);

    return { message: 'Transaction PIN changed successfully' };
  }

  /**
   * Verify transaction PIN
   */
  async verifyTransactionPin(userId: string, pin: string): Promise<boolean> {
    const transactionPinSecret = await this.identityService.getAuthSecret(userId, 'transaction_pin');
    if (!transactionPinSecret) {
      throw new BadRequestException({
        code: 'NO_TRANSACTION_PIN',
        message: 'Transaction PIN not set',
      });
    }

    const isValid = await this.verifyPin(pin, transactionPinSecret.secretHash);
    if (!isValid) {
      throw new BadRequestException({
        code: 'INVALID_TRANSACTION_PIN',
        message: 'Invalid transaction PIN',
      });
    }

    return true;
  }

  /**
   * Verify login PIN (for sensitive operations)
   */
  async verifyLoginPin(userId: string, pin: string): Promise<boolean> {
    const pinSecret = await this.identityService.getAuthSecret(userId, 'pin');
    if (!pinSecret) {
      throw new BadRequestException({
        code: 'NO_LOGIN_PIN',
        message: 'Login PIN not set',
      });
    }

    const isValid = await this.verifyPin(pin, pinSecret.secretHash);
    if (!isValid) {
      throw new BadRequestException({
        code: 'INVALID_LOGIN_PIN',
        message: 'Invalid login PIN',
      });
    }

    return true;
  }

  /**
   * Verify login password
   */
  async verifyLoginPassword(userId: string, password: string): Promise<boolean> {
    const passwordSecret = await this.identityService.getAuthSecret(userId, 'password');
    if (!passwordSecret) {
      throw new BadRequestException({
        code: 'NO_PASSWORD',
        message: 'Password not set',
      });
    }

    const isValid = await this.verifyPin(password, passwordSecret.secretHash);
    if (!isValid) {
      throw new BadRequestException({
        code: 'INVALID_PASSWORD',
        message: 'Invalid password',
      });
    }

    return true;
  }

  /**
   * Verify credential (PIN or password) for sensitive operations
   */
  async verifyCredential(
    userId: string,
    type: 'pin' | 'password',
    credential: string,
  ): Promise<boolean> {
    if (type === 'pin') {
      return this.verifyLoginPin(userId, credential);
    } else {
      return this.verifyLoginPassword(userId, credential);
    }
  }

  /**
   * Forgot PIN - initiate reset
   */
  async forgotPin(dto: ForgotPinDto) {
    const { identifier } = dto;
    const isEmail = identifier.includes('@');

    // Find principal
    const principal = isEmail
      ? await this.identityService.findPrincipalByValue('email', identifier.toLowerCase())
      : await this.identityService.findPrincipalByValue('phone', identifier);

    // Don't reveal if user exists or not
    if (!principal) {
      return {
        message: 'If an account exists with this email/phone, you will receive a reset code.',
      };
    }

    const fullIdentity = await this.identityService.getFullIdentity(principal.identityId);
    const emailPrincipal = fullIdentity?.principals.find(p => p.principalType === 'email');

    if (emailPrincipal) {
      try {
        await this.otpService.sendEmailOtp({
          identityId: principal.identityId,
          target: emailPrincipal.principalValue,
          purpose: 'pin_reset',
          firstName: fullIdentity?.personProfile?.firstName,
        });
        this.logger.log(`PIN reset requested for ${this.maskTarget(identifier)}`);
      } catch (error) {
        this.logger.error(`Failed to send PIN reset OTP to ${this.maskTarget(identifier)}`, error);
      }
    }

    return {
      message: 'If an account exists with this email/phone, you will receive a reset code.',
    };
  }

  /**
   * Reset PIN with OTP
   */
  async resetPin(dto: ResetPinDto) {
    const { identifier, otp, newPin, confirmPin } = dto;

    if (newPin !== confirmPin) {
      throw new BadRequestException({
        code: 'PIN_MISMATCH',
        message: 'New PIN and confirmation do not match',
      });
    }

    const isEmail = identifier.includes('@');
    const principal = isEmail
      ? await this.identityService.findPrincipalByValue('email', identifier.toLowerCase())
      : await this.identityService.findPrincipalByValue('phone', identifier);

    if (!principal) {
      throw new BadRequestException({
        code: 'INVALID_RESET_REQUEST',
        message: 'Invalid reset request',
      });
    }

    const fullIdentity = await this.identityService.getFullIdentity(principal.identityId);
    const emailPrincipal = fullIdentity?.principals.find(p => p.principalType === 'email');

    if (!emailPrincipal) {
      throw new BadRequestException({
        code: 'INVALID_RESET_REQUEST',
        message: 'Invalid reset request',
      });
    }

    // Verify OTP
    await this.otpService.verifyOtp({
      target: emailPrincipal.principalValue,
      purpose: 'pin_reset',
      code: otp,
    });

    // Hash and update PIN
    const newPinHash = await this.hashPin(newPin);
    await this.identityService.setAuthSecret(principal.identityId, 'pin', newPinHash);

    // Send security alert
    this.mailService.sendSecurityAlertEmail(emailPrincipal.principalValue, {
      firstName: fullIdentity?.personProfile?.firstName || 'User',
      alertType: 'PIN Reset',
      description: 'Your login PIN has been reset.',
      date: new Date().toISOString(),
    }).catch(() => {
      this.logger.warn(`Failed to send PIN reset alert`);
    });

    // Revoke all sessions
    await this.sessionsService.revokeAllSessions(principal.identityId);

    await this.identityService.logEvent(principal.identityId, 'pin_reset_completed', {
      description: 'PIN reset completed',
    });

    this.logger.log(`PIN reset completed for user ${principal.identityId}`);

    return { message: 'PIN reset successfully. Please login with your new PIN.' };
  }

  // ============================================================================
  // ACCOUNT CHECK
  // ============================================================================

  /**
   * Check if an account exists with the given identifier
   * Returns account status, preferred login mode, and role information
   *
   * This method checks auth_principals which stores login identifiers
   * for ALL account types: customers, admins, and business accounts.
   */
  async checkAccount(identifier: string) {
    const isEmail = identifier.includes('@');

    // Find principal by email or phone
    const principal = isEmail
      ? await this.identityService.findPrincipalByValue('email', identifier.toLowerCase())
      : await this.identityService.findPrincipalByValue('phone', identifier);

    if (!principal) {
      return {
        exists: false,
        loginMode: null,
        hasPinSet: false,
        hasPasswordSet: false,
        role: null,
        roles: [],
        accountType: null,
      };
    }

    // Get identity and profile
    const fullIdentity = await this.identityService.getFullIdentity(principal.identityId);
    if (!fullIdentity) {
      return {
        exists: false,
        loginMode: null,
        hasPinSet: false,
        hasPasswordSet: false,
        role: null,
        roles: [],
        accountType: null,
      };
    }

    // Check if PIN and password are set
    const pinSecret = await this.identityService.getAuthSecret(principal.identityId, 'pin');
    const passwordSecret = await this.identityService.getAuthSecret(principal.identityId, 'password');

    const loginMode = fullIdentity.personProfile?.preferredLoginMode || 'password';

    // Get user roles from RBAC system
    const identityRoles = await this.permissionsService.getIdentityRoles(principal.identityId);
    const roleTypes = identityRoles.map(r => r.type);
    // Default to 'user' if no roles assigned
    const primaryRole = roleTypes.length > 0 ? roleTypes[0] : 'user';
    const allRoles = roleTypes.length > 0 ? roleTypes : ['user'];

    // Determine account type based on identity type
    const isBusinessAccount = fullIdentity.identity.identityType === 'legal_entity';
    const accountType = isBusinessAccount ? 'business' : 'individual';

    return {
      exists: true,
      loginMode,
      hasPinSet: !!pinSecret,
      hasPasswordSet: !!passwordSecret,
      // Include name for personalized greeting
      firstName: fullIdentity.personProfile?.firstName || null,
      // Include role information for differentiating account types
      role: primaryRole,
      roles: allRoles,
      accountType,
      // Flag to indicate if this is an admin account
      isAdmin: allRoles.includes('admin'),
    };
  }

  // ============================================================================
  // LOGIN MODE MANAGEMENT
  // ============================================================================

  /**
   * Get current login mode preference and credentials status
   */
  async getLoginMode(userId: string) {
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Check if PIN and password are set
    const pinSecret = await this.identityService.getAuthSecret(userId, 'pin');
    const passwordSecret = await this.identityService.getAuthSecret(userId, 'password');

    // Default to password for new accounts and business accounts (which don't have personProfile)
    const loginMode = fullIdentity.personProfile?.preferredLoginMode || 'password';
    return {
      loginMode,
      hasPinSet: !!pinSecret,
      hasPasswordSet: !!passwordSecret,
    };
  }

  /**
   * Update login mode preference
   */
  async updateLoginMode(userId: string, loginMode: 'pin' | 'password') {
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Update the person profile with the new login mode
    await this.identityService.updatePersonProfile(userId, {
      preferredLoginMode: loginMode,
    });

    // Log the event
    await this.identityService.logEvent(userId, 'login_mode_changed', {
      description: `Login mode changed to ${loginMode}`,
    });

    // Send security alert email
    const emailPrincipal = fullIdentity.principals.find(p => p.principalType === 'email');
    if (emailPrincipal) {
      this.mailService.sendSecurityAlertEmail(emailPrincipal.principalValue, {
        firstName: fullIdentity.personProfile?.firstName || 'User',
        alertType: 'Login Mode Changed',
        description: `Your login authentication method has been changed to ${loginMode === 'pin' ? 'PIN' : 'Password'}.`,
        date: new Date().toISOString(),
      }).catch(() => {
        this.logger.warn(`Failed to send login mode change alert`);
      });
    }

    this.logger.log(`Login mode changed to ${loginMode} for user ${userId}`);

    return { message: `Login mode updated to ${loginMode}` };
  }

  // ============================================================================
  // LOGIN CHANNEL PREFERENCES
  // ============================================================================

  /**
   * Get login channel preferences
   */
  async getChannelPreferences(userId: string) {
    return this.identityService.getChannelPreferences(userId);
  }

  /**
   * Update login channel preferences
   */
  async updateChannelPreferences(
    userId: string,
    data: {
      allowWebLogin?: boolean;
      allowMobileLogin?: boolean;
      allowUssdLogin?: boolean;
    },
  ) {
    const result = await this.identityService.updateChannelPreferences(userId, data);

    // Log the event
    await this.identityService.logEvent(userId, 'channel_preferences_changed', {
      description: 'Login channel preferences updated',
      metadata: data,
    });

    this.logger.log(`Channel preferences updated for user ${userId}`);

    return result;
  }

  /**
   * Get geo tagging preferences
   */
  async getGeoTaggingPreferences(userId: string) {
    return this.identityService.getGeoTaggingPreferences(userId);
  }

  /**
   * Update geo tagging preferences
   */
  async updateGeoTaggingPreferences(userId: string, enabled: boolean) {
    const result = await this.identityService.updateGeoTaggingPreferences(userId, enabled);

    // Log the event
    await this.identityService.logEvent(userId, 'geo_tagging_preferences_changed', {
      description: `Geo tagging ${enabled ? 'enabled' : 'disabled'}`,
      metadata: { geoTaggingEnabled: enabled },
    });

    this.logger.log(`Geo tagging ${enabled ? 'enabled' : 'disabled'} for user ${userId}`);

    return result;
  }

  /**
   * Set password for the first time
   */
  async setPassword(userId: string, password: string, confirmPassword: string) {
    if (password !== confirmPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_MISMATCH',
        message: 'Password and confirmation do not match',
      });
    }

    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Check if password already exists
    const existingPassword = await this.identityService.getAuthSecret(userId, 'password');
    if (existingPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_EXISTS',
        message: 'Password already set. Use change password endpoint instead.',
      });
    }

    // Hash and store password
    const passwordHash = await this.hashPin(password); // Using same Argon2id hashing
    await this.identityService.setAuthSecret(userId, 'password', passwordHash);

    // Log the event
    await this.identityService.logEvent(userId, 'password_set', {
      description: 'Password set for the first time',
    });

    // Send security alert email
    const emailPrincipal = fullIdentity.principals.find(p => p.principalType === 'email');
    if (emailPrincipal) {
      this.mailService.sendSecurityAlertEmail(emailPrincipal.principalValue, {
        firstName: fullIdentity.personProfile?.firstName || 'User',
        alertType: 'Password Set',
        description: 'A password has been set for your account.',
        date: new Date().toISOString(),
      }).catch(() => {
        this.logger.warn(`Failed to send password set alert`);
      });
    }

    this.logger.log(`Password set for user ${userId}`);

    return { message: 'Password set successfully' };
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string, confirmPassword: string) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_MISMATCH',
        message: 'New password and confirmation do not match',
      });
    }

    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Check if password exists
    const existingPassword = await this.identityService.getAuthSecret(userId, 'password');
    if (!existingPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_NOT_SET',
        message: 'Password not set. Use set password endpoint instead.',
      });
    }

    // Verify current password
    const isValid = await this.verifyPin(currentPassword, existingPassword.secretHash);
    if (!isValid) {
      throw new BadRequestException({
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect',
      });
    }

    // Hash and store new password
    const passwordHash = await this.hashPin(newPassword);
    await this.identityService.setAuthSecret(userId, 'password', passwordHash);

    // Log the event
    await this.identityService.logEvent(userId, 'password_changed', {
      description: 'Password changed successfully',
    });

    // Send security alert email
    const emailPrincipal = fullIdentity.principals.find(p => p.principalType === 'email');
    if (emailPrincipal) {
      this.mailService.sendSecurityAlertEmail(emailPrincipal.principalValue, {
        firstName: fullIdentity.personProfile?.firstName || 'User',
        alertType: 'Password Changed',
        description: 'Your account password has been changed.',
        date: new Date().toISOString(),
      }).catch(() => {
        this.logger.warn(`Failed to send password change alert`);
      });
    }

    this.logger.log(`Password changed for user ${userId}`);

    return { message: 'Password changed successfully' };
  }

  /**
   * Set PIN for the first time (for users who registered with password)
   */
  async setLoginPin(userId: string, pin: string, confirmPin: string) {
    if (pin !== confirmPin) {
      throw new BadRequestException({
        code: 'PIN_MISMATCH',
        message: 'PIN and confirmation do not match',
      });
    }

    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Check if PIN already exists
    const existingPin = await this.identityService.getAuthSecret(userId, 'pin');
    if (existingPin) {
      throw new BadRequestException({
        code: 'PIN_EXISTS',
        message: 'PIN already set. Use change PIN endpoint instead.',
      });
    }

    // Hash and store PIN
    const pinHash = await this.hashPin(pin);
    await this.identityService.setAuthSecret(userId, 'pin', pinHash);

    // Log the event
    await this.identityService.logEvent(userId, 'pin_set', {
      description: 'Login PIN set for the first time',
    });

    // Send security alert email
    const emailPrincipal = fullIdentity.principals.find(p => p.principalType === 'email');
    if (emailPrincipal) {
      this.mailService.sendSecurityAlertEmail(emailPrincipal.principalValue, {
        firstName: fullIdentity.personProfile?.firstName || 'User',
        alertType: 'PIN Set',
        description: 'A login PIN has been set for your account.',
        date: new Date().toISOString(),
      }).catch(() => {
        this.logger.warn(`Failed to send PIN set alert`);
      });
    }

    this.logger.log(`Login PIN set for user ${userId}`);

    return { message: 'PIN set successfully' };
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  async getSessions(identityId: string, currentSessionId?: string): Promise<SessionInfo[]> {
    return this.sessionsService.getIdentitySessions(identityId, currentSessionId);
  }

  async revokeSession(identityId: string, sessionId: string) {
    await this.sessionsService.revokeSession(sessionId, identityId);
    return { message: 'Session revoked successfully' };
  }

  async revokeAllSessions(identityId: string, exceptCurrentSession?: string) {
    await this.sessionsService.revokeAllSessions(identityId, exceptCurrentSession);

    const fullIdentity = await this.identityService.getFullIdentity(identityId);
    const emailPrincipal = fullIdentity?.principals.find(p => p.principalType === 'email');

    if (emailPrincipal) {
      this.mailService.sendSecurityAlertEmail(emailPrincipal.principalValue, {
        firstName: fullIdentity?.personProfile?.firstName || 'User',
        alertType: 'All Sessions Revoked',
        description: 'All your active sessions have been logged out.',
        date: new Date().toISOString(),
      }).catch(() => {
        this.logger.warn(`Failed to send session revoke alert`);
      });
    }

    return { message: 'All sessions revoked successfully' };
  }

  async trustDevice(identityId: string, sessionId: string) {
    await this.sessionsService.trustDevice(sessionId, identityId);
    return { message: 'Device trusted successfully' };
  }

  async untrustDevice(identityId: string, sessionId: string) {
    await this.sessionsService.untrustDevice(sessionId, identityId);
    return { message: 'Device untrusted successfully' };
  }

  // ============================================================================
  // MFA MANAGEMENT
  // ============================================================================

  async getMfaStatus(userId: string) {
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const phonePrincipal = fullIdentity.principals.find(p => p.principalType === 'phone');
    const emailPrincipal = fullIdentity.principals.find(p => p.principalType === 'email');

    // Get MFA method from profile (the new way - supports email, sms, totp)
    const mfaMethod = await this.identityService.getMfaMethod(userId);
    const mfaEnabled = !!mfaMethod;

    return {
      mfaEnabled,
      mfaMethod: mfaMethod,
      availableMethods: {
        email: emailPrincipal?.isVerified || false,
        sms: phonePrincipal?.isVerified || false,
        totp: true,
      },
    };
  }

  async enableMfa(userId: string, method: 'email' | 'sms' | 'totp') {
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Check if MFA is already enabled
    const existingMfaMethod = await this.identityService.getMfaMethod(userId);
    if (existingMfaMethod) {
      throw new BadRequestException({
        code: 'MFA_ALREADY_ENABLED',
        message: 'MFA is already enabled',
      });
    }

    if (method === 'email') {
      const emailPrincipal = fullIdentity.principals.find(p => p.principalType === 'email');
      if (!emailPrincipal?.isVerified) {
        throw new BadRequestException({
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Email must be verified before enabling Email MFA',
        });
      }
    }

    if (method === 'sms') {
      const phonePrincipal = fullIdentity.principals.find(p => p.principalType === 'phone');
      if (!phonePrincipal?.isVerified) {
        throw new BadRequestException({
          code: 'PHONE_NOT_VERIFIED',
          message: 'Phone number must be verified before enabling SMS MFA',
        });
      }
    }

    // For TOTP: generate secret and QR code
    if (method === 'totp') {
      const totpSecret = new OTPAuth.Secret();
      const secret = totpSecret.base32;
      const encryptionKey = this.configService.get<string>('app.encryptionKey');
      const encryptedSecret = encrypt(secret, encryptionKey!);

      // Store temporarily (not activated yet - will be activated on verify)
      await this.identityService.setAuthSecret(userId, 'totp', encryptedSecret);

      const emailPrincipal = fullIdentity.principals.find(p => p.principalType === 'email');
      const totp = new OTPAuth.TOTP({
        issuer: 'BankApp',
        label: emailPrincipal?.principalValue || 'User',
        secret: totpSecret,
      });
      const qrCode = await QRCode.toDataURL(totp.toString());

      this.logger.log(`TOTP setup initiated for user ${userId}`);

      return {
        message: 'Scan the QR code with your authenticator app, then enter the 6-digit code to verify.',
        qrCode,
        secret,
        method: 'totp',
      };
    }

    // For email/SMS: send OTP for verification
    const target = method === 'email'
      ? fullIdentity.principals.find(p => p.principalType === 'email')?.principalValue
      : fullIdentity.principals.find(p => p.principalType === 'phone')?.principalValue;

    if (target) {
      await this.otpService.sendEmailOtp({
        identityId: userId,
        target,
        purpose: 'mfa_setup',
        firstName: fullIdentity.personProfile?.firstName,
      });
    }

    this.logger.log(`MFA setup initiated for identity ${userId} via ${method}`);

    return {
      message: `Verification code sent to ${this.maskTarget(target || '')}`,
      maskedTarget: this.maskTarget(target || ''),
      method,
    };
  }

  async verifyMfaSetup(userId: string, code: string, method?: 'email' | 'sms' | 'totp') {
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // If method is not provided, check if TOTP secret exists (backward compatibility)
    const totpSecret = await this.identityService.getAuthSecret(userId, 'totp');
    const effectiveMethod = method || (totpSecret ? 'totp' : null);

    if (!effectiveMethod) {
      throw new BadRequestException({
        code: 'MFA_NOT_INITIATED',
        message: 'MFA setup has not been initiated. Call enable first.',
      });
    }

    if (effectiveMethod === 'totp') {
      // Verify TOTP code
      if (!totpSecret) {
        throw new BadRequestException({
          code: 'MFA_NOT_INITIATED',
          message: 'TOTP setup has not been initiated.',
        });
      }

      const encryptionKey = this.configService.get<string>('app.encryptionKey');
      const secret = decrypt(totpSecret.secretHash, encryptionKey!);
      const totp = new OTPAuth.TOTP({
        issuer: 'BankApp',
        secret: OTPAuth.Secret.fromBase32(secret),
      });
      const isValid = totp.validate({ token: code, window: 1 }) !== null;

      if (!isValid) {
        throw new BadRequestException({
          code: 'INVALID_TOTP',
          message: 'Invalid authenticator code. Please try again.',
        });
      }
    } else {
      // Verify email/SMS OTP
      const target = effectiveMethod === 'email'
        ? fullIdentity.principals.find(p => p.principalType === 'email')?.principalValue
        : fullIdentity.principals.find(p => p.principalType === 'phone')?.principalValue;

      if (!target) {
        throw new BadRequestException({
          code: 'TARGET_NOT_FOUND',
          message: `No ${effectiveMethod === 'email' ? 'email' : 'phone'} found for this account.`,
        });
      }

      try {
        await this.otpService.verifyOtp({
          target,
          purpose: 'mfa_setup',
          code,
        });
      } catch {
        throw new BadRequestException({
          code: 'INVALID_OTP',
          message: 'Invalid or expired verification code. Please try again.',
        });
      }
    }

    // Set MFA method in profile - this enables MFA
    await this.identityService.setMfaMethod(userId, effectiveMethod);

    // MFA is now verified and active
    const methodLabel = effectiveMethod === 'totp' ? 'Authenticator App' : effectiveMethod === 'email' ? 'Email OTP' : 'SMS OTP';
    await this.identityService.logEvent(userId, 'mfa_enabled', {
      description: `MFA enabled via ${methodLabel}`,
      metadata: { method: effectiveMethod },
    });

    const emailPrincipal = fullIdentity.principals.find(p => p.principalType === 'email');
    if (emailPrincipal) {
      this.mailService.sendSecurityAlertEmail(emailPrincipal.principalValue, {
        firstName: fullIdentity.personProfile?.firstName || 'User',
        alertType: 'MFA Enabled',
        description: `Multi-factor authentication has been enabled using ${methodLabel}.`,
        date: new Date().toISOString(),
      }).catch(() => {
        this.logger.warn(`Failed to send MFA enable alert`);
      });
    }

    this.logger.log(`MFA enabled for user ${userId} via ${effectiveMethod}`);

    // Generate backup codes
    const backupCodes = await this.identityService.generateBackupCodes(userId);

    return {
      message: 'MFA has been enabled successfully',
      backupCodes,
      backupCodesCount: backupCodes.length,
    };
  }

  /**
   * Get remaining backup codes count
   */
  async getBackupCodesStatus(userId: string) {
    const mfaMethod = await this.identityService.getMfaMethod(userId);
    if (!mfaMethod) {
      throw new BadRequestException({
        code: 'MFA_NOT_ENABLED',
        message: 'MFA is not enabled',
      });
    }

    const remainingCount = await this.identityService.getRemainingBackupCodeCount(userId);
    const hasBackupCodes = await this.identityService.hasBackupCodes(userId);

    return {
      hasBackupCodes,
      remainingCount,
      totalGenerated: 10, // Always generate 10 codes
    };
  }

  /**
   * Regenerate backup codes (requires PIN/password verification)
   */
  async regenerateBackupCodes(userId: string, credential: string) {
    // Check if MFA is enabled
    const mfaMethod = await this.identityService.getMfaMethod(userId);
    if (!mfaMethod) {
      throw new BadRequestException({
        code: 'MFA_NOT_ENABLED',
        message: 'MFA must be enabled to generate backup codes',
      });
    }

    // Verify login PIN or password
    const pinSecret = await this.identityService.getAuthSecret(userId, 'pin');
    const passwordSecret = await this.identityService.getAuthSecret(userId, 'password');

    if (!pinSecret && !passwordSecret) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Try to verify against PIN first, then password
    let isValid = false;
    if (pinSecret) {
      isValid = await this.verifyPin(credential, pinSecret.secretHash);
    }
    if (!isValid && passwordSecret) {
      isValid = await this.verifyPin(credential, passwordSecret.secretHash);
    }

    if (!isValid) {
      throw new BadRequestException({
        code: 'INVALID_CREDENTIAL',
        message: 'Invalid PIN or password',
      });
    }

    // Generate new backup codes
    const backupCodes = await this.identityService.generateBackupCodes(userId);

    // Log the event
    await this.identityService.logEvent(userId, 'backup_codes_regenerated', {
      description: 'MFA backup codes regenerated',
    });

    // Send security alert
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    const emailPrincipal = fullIdentity?.principals.find(p => p.principalType === 'email');
    if (emailPrincipal) {
      this.mailService.sendSecurityAlertEmail(emailPrincipal.principalValue, {
        firstName: fullIdentity?.personProfile?.firstName || 'User',
        alertType: 'Backup Codes Regenerated',
        description: 'New MFA backup codes have been generated. Your old codes are no longer valid.',
        date: new Date().toISOString(),
      }).catch(() => {
        this.logger.warn(`Failed to send backup codes regeneration alert`);
      });
    }

    this.logger.log(`Backup codes regenerated for user ${userId}`);

    return {
      message: 'Backup codes regenerated successfully',
      backupCodes,
      backupCodesCount: backupCodes.length,
    };
  }

  /**
   * Verify a backup code (for MFA login fallback)
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    return this.identityService.verifyBackupCode(userId, code);
  }

  async disableMfa(userId: string, pin: string) {
    // Check if MFA is enabled
    const mfaMethod = await this.identityService.getMfaMethod(userId);
    if (!mfaMethod) {
      throw new BadRequestException({
        code: 'MFA_NOT_ENABLED',
        message: 'MFA is not currently enabled',
      });
    }

    // Verify login PIN or password
    const pinSecret = await this.identityService.getAuthSecret(userId, 'pin');
    const passwordSecret = await this.identityService.getAuthSecret(userId, 'password');

    if (!pinSecret && !passwordSecret) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Try to verify against PIN first, then password
    let isValid = false;
    if (pinSecret) {
      isValid = await this.verifyPin(pin, pinSecret.secretHash);
    }
    if (!isValid && passwordSecret) {
      isValid = await this.verifyPin(pin, passwordSecret.secretHash);
    }

    if (!isValid) {
      throw new BadRequestException({
        code: 'INVALID_PIN',
        message: 'Invalid PIN or password',
      });
    }

    // Clear MFA method from profile
    await this.identityService.setMfaMethod(userId, null);

    // Remove TOTP secret if it exists
    const totpSecret = await this.identityService.getAuthSecret(userId, 'totp');
    if (totpSecret) {
      await this.identityService.deleteAuthSecret(userId, 'totp');
    }

    // Delete backup codes
    await this.identityService.deleteBackupCodes(userId);

    const fullIdentity = await this.identityService.getFullIdentity(userId);
    const emailPrincipal = fullIdentity?.principals.find(p => p.principalType === 'email');

    if (emailPrincipal) {
      this.mailService.sendSecurityAlertEmail(emailPrincipal.principalValue, {
        firstName: fullIdentity?.personProfile?.firstName || 'User',
        alertType: 'MFA Disabled',
        description: 'Multi-factor authentication has been disabled on your account.',
        date: new Date().toISOString(),
      }).catch(() => {
        this.logger.warn(`Failed to send MFA disable alert`);
      });
    }

    await this.identityService.logEvent(userId, 'mfa_disabled', {
      description: 'MFA disabled',
    });

    this.logger.log(`MFA disabled for user ${userId}`);

    return { message: 'MFA has been disabled successfully' };
  }

  async verifyTotpCode(userId: string, code: string) {
    const totpSecret = await this.identityService.getAuthSecret(userId, 'totp');
    if (!totpSecret || !totpSecret.secretHash) {
      throw new BadRequestException({
        code: 'TOTP_NOT_CONFIGURED',
        message: 'TOTP is not configured for this account.',
      });
    }

    const encryptionKey = this.configService.get<string>('app.encryptionKey');
    const secret = decrypt(totpSecret.secretHash, encryptionKey!);
    const totp = new OTPAuth.TOTP({
      issuer: 'BankApp',
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const isValid = totp.validate({ token: code, window: 1 }) !== null;

    if (!isValid) {
      throw new BadRequestException({
        code: 'INVALID_TOTP',
        message: 'Invalid authenticator code. Please try again.',
      });
    }

    return { verified: true };
  }

  async verifyMfaLogin(mfaToken: string, code: string, context: RequestContext, method?: 'totp' | 'email' | 'sms') {
    let payload: TokenPayload & { mfaMethod?: 'email' | 'sms' | 'totp' };
    try {
      payload = this.jwtService.verify<TokenPayload & { mfaMethod?: 'email' | 'sms' | 'totp' }>(mfaToken, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_MFA_TOKEN',
        message: 'MFA token is invalid or expired. Please login again.',
      });
    }

    if (payload.type !== 'mfa_challenge') {
      throw new UnauthorizedException({
        code: 'INVALID_MFA_TOKEN',
        message: 'Invalid token type',
      });
    }

    const identity = await this.identityService.findById(payload.sub);
    if (!identity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Use the method from the request, or fall back to the method from the token, or default to totp
    const effectiveMethod = method || payload.mfaMethod || 'totp';

    // Get full identity for OTP verification
    const fullIdentity = await this.identityService.getFullIdentity(identity.id);

    // Verify code based on method
    if (effectiveMethod === 'email') {
      // Verify email OTP
      const emailPrincipal = fullIdentity?.principals.find(p => p.principalType === 'email');

      if (!emailPrincipal) {
        throw new BadRequestException({
          code: 'NO_EMAIL',
          message: 'No email address found for this account.',
        });
      }

      // Verify OTP
      try {
        await this.otpService.verifyOtp({
          target: emailPrincipal.principalValue,
          purpose: 'login_mfa',
          code,
        });
      } catch {
        throw new BadRequestException({
          code: 'INVALID_OTP',
          message: 'Invalid or expired verification code. Please try again.',
        });
      }
    } else if (effectiveMethod === 'sms') {
      // Verify SMS OTP
      const phonePrincipal = fullIdentity?.principals.find(p => p.principalType === 'phone');

      if (!phonePrincipal) {
        throw new BadRequestException({
          code: 'NO_PHONE',
          message: 'No phone number found for this account.',
        });
      }

      // Verify OTP
      try {
        await this.otpService.verifyOtp({
          target: phonePrincipal.principalValue,
          purpose: 'login_mfa',
          code,
        });
      } catch {
        throw new BadRequestException({
          code: 'INVALID_OTP',
          message: 'Invalid or expired verification code. Please try again.',
        });
      }
    } else {
      // Verify TOTP code
      const totpSecret = await this.identityService.getAuthSecret(identity.id, 'totp');
      if (!totpSecret || !totpSecret.secretHash) {
        throw new BadRequestException({
          code: 'TOTP_NOT_CONFIGURED',
          message: 'TOTP is not configured for this account.',
        });
      }

      const encryptionKey = this.configService.get<string>('app.encryptionKey');
      const secret = decrypt(totpSecret.secretHash, encryptionKey!);
      const totp = new OTPAuth.TOTP({
        issuer: 'BankApp',
        secret: OTPAuth.Secret.fromBase32(secret),
      });
      const isValid = totp.validate({ token: code, window: 1 }) !== null;

      if (!isValid) {
        throw new BadRequestException({
          code: 'INVALID_TOTP',
          message: 'Invalid authenticator code. Please try again.',
        });
      }
    }

    // Get principals from fullIdentity (already fetched above)
    const emailPrincipal = fullIdentity?.principals.find(p => p.principalType === 'email');
    const phonePrincipal = fullIdentity?.principals.find(p => p.principalType === 'phone');
    const email = emailPrincipal?.principalValue || payload.email;

    // Generate tokens
    const tokens = await this.generateTokens(identity.id, email);

    // Create session
    const session = await this.sessionsService.createSession({
      identityId: identity.id,
      refreshToken: tokens.refreshToken,
      deviceId: context.deviceId,
      deviceName: context.deviceName,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress || 'unknown',
    });

    // Check for transaction PIN
    const transactionPinSecret = await this.identityService.getAuthSecret(identity.id, 'transaction_pin');

    await this.identityService.logEvent(identity.id, 'login_success', {
      description: 'User logged in with MFA',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    this.logger.log(`MFA login completed for user ${email}`);

    // Determine account type based on identity type
    const isBusinessAccount = identity.identityType === 'legal_entity';
    const accountType = isBusinessAccount ? 'business' : 'individual';
    const businessProfile = fullIdentity?.businessProfile;

    // Get scoped roles (new RBAC)
    const scopedRoles = await this.getScopedRolesForResponse(identity.id);

    // Get user roles from RBAC system (legacy)
    const identityRoles = await this.permissionsService.getIdentityRoles(identity.id);
    const roleTypes = identityRoles.map(r => r.type).filter(Boolean);

    // Merge role types from both legacy and scoped roles
    const scopedRoleTypes = scopedRoles
      .map(sr => {
        // Map roleCode to legacy type for backward compatibility
        if (sr.roleCode === 'ADMIN' || sr.roleCode === 'SUPER_ADMIN') return 'admin';
        if (sr.roleCode === 'SUPPORT_AGENT') return 'support_agent';
        return sr.roleCode?.toLowerCase() || null;
      })
      .filter((t): t is string => t !== null);

    const allRoleTypes = [...new Set([...roleTypes, ...scopedRoleTypes])];

    // Default to 'user' if no roles assigned
    const primaryRole = allRoleTypes.length > 0 ? allRoleTypes[0] : 'user';
    const allRoles = allRoleTypes.length > 0 ? allRoleTypes : ['user'];

    // Check if business account requires onboarding (no principals added yet)
    let requiresOnboarding = false;
    let onboardingStep: string | undefined;
    if (isBusinessAccount) {
      const hasPrincipals = await this.identityService.hasRequiredPrincipals(identity.id);
      requiresOnboarding = !hasPrincipals;
      onboardingStep = hasPrincipals ? undefined : 'add_principal';
    }

    return {
      user: {
        id: identity.id,
        email: email,
        phone: phonePrincipal?.principalValue,
        firstName: fullIdentity?.personProfile?.firstName || '',
        lastName: fullIdentity?.personProfile?.lastName || '',
        status: identity.status,
        tier: fullIdentity?.kycProfile?.kycTier || 'tier_0',
        emailVerified: emailPrincipal?.isVerified || false,
        phoneVerified: phonePrincipal?.isVerified || false,
        hasTransactionPin: !!transactionPinSecret,
        mfaEnabled: true,
        role: primaryRole,
        roles: allRoles,
        scopedRoles, // New scoped RBAC
        // Account type and business fields
        accountType,
        ...(isBusinessAccount && {
          legalName: businessProfile?.legalName,
          businessType: businessProfile?.businessType,
          requiresOnboarding,
          onboardingStep,
        }),
      },
      ...tokens,
      sessionId: session.id,
    };
  }

  /**
   * Request email OTP fallback during MFA login
   */
  async requestMfaEmailFallback(mfaToken: string) {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(mfaToken, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_MFA_TOKEN',
        message: 'MFA token is invalid or expired. Please login again.',
      });
    }

    if (payload.type !== 'mfa_challenge') {
      throw new UnauthorizedException({
        code: 'INVALID_MFA_TOKEN',
        message: 'Invalid token type',
      });
    }

    const fullIdentity = await this.identityService.getFullIdentity(payload.sub);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const emailPrincipal = fullIdentity.principals.find(p => p.principalType === 'email');
    if (!emailPrincipal) {
      throw new BadRequestException({
        code: 'NO_EMAIL',
        message: 'No email address found for this account.',
      });
    }

    if (!emailPrincipal.isVerified) {
      throw new BadRequestException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email address is not verified. Cannot use email fallback.',
      });
    }

    // Send OTP to email
    await this.otpService.sendEmailOtp({
      identityId: payload.sub,
      target: emailPrincipal.principalValue,
      purpose: 'login_mfa',
      firstName: fullIdentity.personProfile?.firstName,
    });

    this.logger.log(`MFA email fallback OTP sent to ${this.maskTarget(emailPrincipal.principalValue)}`);

    return {
      message: 'Verification code sent to your email',
      maskedEmail: this.maskTarget(emailPrincipal.principalValue),
    };
  }

  // ============================================================================
  // BUSINESS ONBOARDING
  // ============================================================================

  /**
   * Add a principal/director to a business account
   */
  async addBusinessPrincipal(userId: string, dto: AddBusinessPrincipalDto) {
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (fullIdentity.identity.identityType !== 'legal_entity') {
      throw new BadRequestException({
        code: 'NOT_A_BUSINESS',
        message: 'This endpoint is only for business accounts',
      });
    }

    const relationship = await this.identityService.addBusinessRelationship(userId, {
      name: dto.name,
      role: dto.relationship,
      ownershipPercentage: dto.ownershipPercentage,
      positionTitle: dto.positionTitle,
    });

    this.logger.log(`Business principal added for ${userId}: ${dto.name} as ${dto.relationship}`);

    return {
      message: 'Principal added successfully',
      principal: {
        id: relationship.id,
        name: dto.name,
        relationship: dto.relationship,
        ownershipPercentage: dto.ownershipPercentage,
        positionTitle: dto.positionTitle,
      },
    };
  }

  /**
   * Get business principals/directors
   */
  async getBusinessPrincipals(userId: string) {
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (fullIdentity.identity.identityType !== 'legal_entity') {
      throw new BadRequestException({
        code: 'NOT_A_BUSINESS',
        message: 'This endpoint is only for business accounts',
      });
    }

    const relationships = fullIdentity.businessRelationships || [];

    // For each relationship, get the person profile
    const principals = await Promise.all(
      relationships.map(async (rel) => {
        const personIdentity = await this.identityService.getFullIdentity(rel.personIdentityId);
        return {
          id: rel.id,
          name: personIdentity?.personProfile
            ? `${personIdentity.personProfile.firstName} ${personIdentity.personProfile.lastName}`.trim()
            : 'Unknown',
          relationship: rel.role,
          ownershipPercentage: rel.ownershipPercentage,
          positionTitle: rel.positionTitle,
          addedAt: rel.createdAt,
        };
      }),
    );

    return { principals };
  }

  /**
   * Update a business principal
   */
  async updateBusinessPrincipal(
    userId: string,
    principalId: string,
    dto: { name?: string; relationship?: 'owner' | 'director' | 'signatory'; ownershipPercentage?: number; positionTitle?: string },
  ) {
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (fullIdentity.identity.identityType !== 'legal_entity') {
      throw new BadRequestException({
        code: 'NOT_A_BUSINESS',
        message: 'This endpoint is only for business accounts',
      });
    }

    // Verify the principal belongs to this business
    const relationship = await this.identityService.findBusinessRelationshipById(principalId);
    if (!relationship || relationship.businessIdentityId !== userId) {
      throw new NotFoundException({
        code: 'PRINCIPAL_NOT_FOUND',
        message: 'Principal not found',
      });
    }

    // Update the relationship fields
    const updateData: any = {};
    if (dto.relationship) updateData.role = dto.relationship;
    if (dto.ownershipPercentage !== undefined) updateData.ownershipPercentage = dto.ownershipPercentage;
    if (dto.positionTitle !== undefined) updateData.positionTitle = dto.positionTitle;

    await this.identityService.updateBusinessRelationship(principalId, updateData);

    // If name is being updated, update the person profile
    if (dto.name) {
      const personIdentity = await this.identityService.getFullIdentity(relationship.personIdentityId);
      if (personIdentity?.personProfile) {
        const nameParts = dto.name.split(' ');
        await this.identityService.updatePersonProfile(relationship.personIdentityId, {
          firstName: nameParts[0] || dto.name,
          lastName: nameParts.slice(1).join(' ') || '',
        });
      }
    }

    this.logger.log(`Business principal ${principalId} updated for ${userId}`);

    return {
      message: 'Principal updated successfully',
    };
  }

  /**
   * Delete a business principal
   */
  async deleteBusinessPrincipal(userId: string, principalId: string) {
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (fullIdentity.identity.identityType !== 'legal_entity') {
      throw new BadRequestException({
        code: 'NOT_A_BUSINESS',
        message: 'This endpoint is only for business accounts',
      });
    }

    // Verify the principal belongs to this business
    const relationship = await this.identityService.findBusinessRelationshipById(principalId);
    if (!relationship || relationship.businessIdentityId !== userId) {
      throw new NotFoundException({
        code: 'PRINCIPAL_NOT_FOUND',
        message: 'Principal not found',
      });
    }

    await this.identityService.removeBusinessRelationship(principalId);

    this.logger.log(`Business principal ${principalId} deleted for ${userId}`);

    return {
      message: 'Principal deleted successfully',
    };
  }

  /**
   * Get business onboarding status
   */
  async getBusinessOnboardingStatus(userId: string) {
    const fullIdentity = await this.identityService.getFullIdentity(userId);
    if (!fullIdentity) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (fullIdentity.identity.identityType !== 'legal_entity') {
      return {
        isBusinessAccount: false,
        onboardingComplete: true,
        requiresOnboarding: false,
      };
    }

    const hasPrincipals = await this.identityService.hasRequiredPrincipals(userId);

    return {
      isBusinessAccount: true,
      onboardingComplete: hasPrincipals,
      requiresOnboarding: !hasPrincipals,
      steps: {
        hasPrincipal: hasPrincipals,
      },
      nextStep: hasPrincipals ? null : 'add_principal',
    };
  }

  // ============================================================================
  // ROLE & PROPERTY ASSIGNMENT
  // ============================================================================

  /**
   * Assign roles and properties to a newly registered user
   *
   * Personal users receive:
   * - USER role with GLOBAL scope
   * - IdentityProperty (ONBOARDED_AT) linked to registration channel
   *
   * Business users receive:
   * - USER role with GLOBAL scope
   * - BUSINESS_OWNER role with TENANT scope (new tenant created)
   * - IdentityProperty (ONBOARDED_AT) linked to registration channel
   */
  private async assignRolesAndPropertiesToNewUser(
    identityId: string,
    isBusinessAccount: boolean,
    businessLegalName?: string,
    channel?: 'web' | 'mobile_android' | 'mobile_ios' | 'ussd' | 'api',
  ): Promise<void> {
    try {
      // 1. Assign USER role with GLOBAL scope
      const userRole = await this.permissionsService.findRoleByCode('USER');
      if (userRole) {
        await this.permissionsService.assignScopedRoleToIdentity(
          identityId,
          userRole.id,
          'GLOBAL',
          null,
          identityId, // self-assigned during registration
        );
        this.logger.log(`Assigned USER role (GLOBAL) to identity ${identityId}`);
      } else {
        this.logger.warn('USER role not found - run database seeds');
      }

      // 2. For business accounts, create tenant and assign BUSINESS_OWNER role
      if (isBusinessAccount && businessLegalName) {
        // Create a tenant for the business
        const tenant = await this.tenantsService.createTenant({
          tenantType: 'BUSINESS_BANKING',
          legalName: businessLegalName,
          ownerIdentityId: identityId,
        });
        this.logger.log(`Created tenant ${tenant.id} for business ${businessLegalName}`);

        // Assign BUSINESS_OWNER role with TENANT scope
        const businessOwnerRole = await this.permissionsService.findRoleByCode('BUSINESS_OWNER');
        if (businessOwnerRole) {
          await this.permissionsService.assignScopedRoleToIdentity(
            identityId,
            businessOwnerRole.id,
            'TENANT',
            tenant.id,
            identityId, // self-assigned during registration
          );
          this.logger.log(`Assigned BUSINESS_OWNER role (TENANT: ${tenant.id}) to identity ${identityId}`);
        } else {
          this.logger.warn('BUSINESS_OWNER role not found - run database seeds');
        }
      }

      // 3. Assign IdentityProperty (ONBOARDED_AT) based on registration channel
      const propertyCode = this.getPropertyCodeForChannel(channel);
      try {
        const property = await this.propertiesService.findPropertyByCode(propertyCode);
        await this.propertiesService.assignPropertyToIdentity(
          identityId,
          property.id,
          'ONBOARDED_AT',
        );
        this.logger.log(`Assigned property ${propertyCode} (ONBOARDED_AT) to identity ${identityId}`);
      } catch (error) {
        // Property might not exist yet if seeds haven't been run
        this.logger.warn(`Failed to assign property ${propertyCode}: ${error}`);
      }
    } catch (error) {
      // Don't fail registration if role/property assignment fails
      // These can be assigned later via admin interface
      this.logger.error(`Failed to assign roles/properties to identity ${identityId}: ${error}`);
    }
  }

  /**
   * Get the property code based on registration channel
   */
  private getPropertyCodeForChannel(
    channel?: 'web' | 'mobile_android' | 'mobile_ios' | 'ussd' | 'api',
  ): string {
    switch (channel) {
      case 'mobile_android':
        return 'MOBILE_APP_ANDROID';
      case 'mobile_ios':
        return 'MOBILE_APP_IOS';
      case 'ussd':
        return 'USSD_CHANNEL';
      case 'api':
        return 'PARTNER_API';
      case 'web':
      default:
        return 'WEB_APP';
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async hashPin(pin: string): Promise<string> {
    return argon2.hash(pin, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  private async verifyPin(pin: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, pin);
  }

  private async generateTokens(userId: string, email: string, sessionId?: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, type: 'access', sessionId },
        {
          secret: this.configService.get<string>('jwt.accessSecret'),
          expiresIn: this.configService.get<string>('jwt.accessExpiration', '15m'),
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email, type: 'refresh', sessionId },
        {
          secret: this.configService.get<string>('jwt.refreshSecret'),
          expiresIn: this.configService.get<string>('jwt.refreshExpiration', '7d'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async handleFailedLogin(identityId: string, secretId: string, context: RequestContext) {
    const maxAttempts = 5;
    const lockDurationMinutes = 30;

    const attempts = await this.identityService.incrementSecretFailedAttempts(secretId);

    await this.identityService.logEvent(identityId, 'login_failure', {
      description: `Failed login attempt (${attempts}/${maxAttempts})`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    if (attempts >= maxAttempts) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + lockDurationMinutes);
      await this.identityService.lockSecret(secretId, lockUntil);

      await this.identityService.logEvent(identityId, 'account_locked', {
        description: `Account locked after ${attempts} failed attempts`,
        ipAddress: context.ipAddress,
      });

      this.logger.warn(`Account locked: ${identityId} after ${attempts} failed attempts`);
    }
  }

  private maskTarget(target: string): string {
    if (target.includes('@')) {
      const [local, domain] = target.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    }
    return `${target.substring(0, 4)}****${target.slice(-2)}`;
  }

  /**
   * Get scoped roles formatted for response
   * Returns an array of scoped role assignments with role details
   */
  private async getScopedRolesForResponse(identityId: string): Promise<
    Array<{
      roleId: string;
      roleCode: string;
      roleName: string;
      scope: 'GLOBAL' | 'TENANT' | 'PROPERTY';
      scopeRefId: string | null;
    }>
  > {
    try {
      const scopedRoles = await this.permissionsService.getIdentityScopedRoles(identityId);

      return scopedRoles.map((sr: any) => ({
        roleId: sr.roleId,
        roleCode: sr.role?.roleCode || '',
        roleName: sr.role?.name || '',
        scope: sr.scope,
        scopeRefId: sr.scopeRefId,
      }));
    } catch (error) {
      this.logger.warn(`Failed to get scoped roles for ${identityId}: ${error}`);
      return [];
    }
  }

  // ============================================================================
  // STAGED BUSINESS REGISTRATION
  // ============================================================================

  /**
   * Check if a registration number (RC/RN) is already in use
   */
  async checkRegistrationNumber(registrationNumber: string) {
    const exists = await this.identityService.checkRegistrationNumberExists(registrationNumber);
    return { exists, registrationNumber };
  }

  /**
   * Initialize a staged business registration
   * Verifies OTP and creates a pending registration record
   */
  async initBusinessRegistration(identifier: string, otp: string) {
    const isEmail = identifier.includes('@');
    const normalizedIdentifier = isEmail ? identifier.toLowerCase() : identifier;
    const contactType = isEmail ? 'email' : 'phone';

    // Verify OTP
    try {
      await this.otpService.verifyOtp({
        target: normalizedIdentifier,
        purpose: 'email_verification',
        code: otp,
      });
    } catch {
      throw new BadRequestException({
        code: 'INVALID_OTP',
        message: 'Invalid or expired verification code',
      });
    }

    // Check if identifier is already registered
    const existingPrincipal = await this.identityService.findPrincipalByValue(
      contactType,
      normalizedIdentifier,
    );
    if (existingPrincipal) {
      throw new ConflictException({
        code: contactType === 'email' ? 'EMAIL_EXISTS' : 'PHONE_EXISTS',
        message: `An account with this ${contactType} already exists`,
      });
    }

    // Check for existing pending registration and delete it
    const existingPending = await this.db
      .select()
      .from(pendingBusinessRegistrations)
      .where(eq(pendingBusinessRegistrations.contactIdentifier, normalizedIdentifier))
      .limit(1);

    if (existingPending.length > 0) {
      await this.db
        .delete(pendingBusinessRegistrations)
        .where(eq(pendingBusinessRegistrations.id, existingPending[0].id));
    }

    // Create pending registration (expires in 24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const [pendingRegistration] = await this.db
      .insert(pendingBusinessRegistrations)
      .values({
        contactIdentifier: normalizedIdentifier,
        contactType: contactType as 'email' | 'phone',
        data: {},
        currentStep: 'business_info',
        expiresAt,
      })
      .returning();

    this.logger.log(`Business registration initiated for ${this.maskTarget(normalizedIdentifier)}`);

    return {
      pendingId: pendingRegistration.id,
      step: 'business_info',
    };
  }

  /**
   * Submit business info step
   */
  async submitBusinessInfoStep(
    pendingId: string,
    data: {
      legalName: string;
      businessType: string;
      businessEmail?: string;
      businessPhone?: string;
      rcNumber?: string;
      registrationNumber?: string;
    },
  ) {
    const pendingReg = await this.getPendingRegistrationById(pendingId);

    // Update data and advance step
    const currentData = (pendingReg.data || {}) as PendingBusinessRegistrationData;
    const newData: PendingBusinessRegistrationData = {
      ...currentData,
      legalName: data.legalName,
      businessType: data.businessType,
      businessEmail: data.businessEmail,
      businessPhone: data.businessPhone,
      rcNumber: data.rcNumber,
      registrationNumber: data.registrationNumber,
    };

    await this.db
      .update(pendingBusinessRegistrations)
      .set({
        data: newData,
        currentStep: 'relationship',
        updatedAt: new Date(),
      })
      .where(eq(pendingBusinessRegistrations.id, pendingId));

    this.logger.log(`Business info submitted for pending registration ${pendingId}`);

    return { step: 'relationship' };
  }

  /**
   * Submit relationship step
   */
  async submitRelationshipStep(
    pendingId: string,
    data: {
      firstName: string;
      lastName: string;
      phone: string;
      relationship: string;
    },
  ) {
    const pendingReg = await this.getPendingRegistrationById(pendingId);

    // Update data and advance step
    const currentData = (pendingReg.data || {}) as PendingBusinessRegistrationData;
    const newData: PendingBusinessRegistrationData = {
      ...currentData,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      relationship: data.relationship,
    };

    await this.db
      .update(pendingBusinessRegistrations)
      .set({
        data: newData,
        currentStep: 'password',
        updatedAt: new Date(),
      })
      .where(eq(pendingBusinessRegistrations.id, pendingId));

    this.logger.log(`Relationship info submitted for pending registration ${pendingId}`);

    return { step: 'password' };
  }

  /**
   * Complete business registration with password
   */
  async completeBusinessRegistration(
    pendingId: string,
    password: string,
    confirmPassword: string,
    context: RequestContext,
  ) {
    if (password !== confirmPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_MISMATCH',
        message: 'Passwords do not match',
      });
    }

    const pendingReg = await this.getPendingRegistrationById(pendingId);
    const data = pendingReg.data as PendingBusinessRegistrationData;

    // Validate all required data is present
    if (!data.legalName || !data.businessType) {
      throw new BadRequestException({
        code: 'INCOMPLETE_DATA',
        message: 'Business information is incomplete. Please start from the beginning.',
      });
    }

    if (!data.firstName || !data.lastName || !data.phone || !data.relationship) {
      throw new BadRequestException({
        code: 'INCOMPLETE_DATA',
        message: 'Relationship information is incomplete. Please complete that step first.',
      });
    }

    // Check again if identifier is already registered (race condition protection)
    const existingPrincipal = await this.identityService.findPrincipalByValue(
      pendingReg.contactType,
      pendingReg.contactIdentifier,
    );
    if (existingPrincipal) {
      await this.deletePendingRegistration(pendingId);
      throw new ConflictException({
        code: pendingReg.contactType === 'email' ? 'EMAIL_EXISTS' : 'PHONE_EXISTS',
        message: `An account with this ${pendingReg.contactType} already exists`,
      });
    }

    // Also check if phone from relationship step already exists
    if (data.phone !== pendingReg.contactIdentifier) {
      const existingPhone = await this.identityService.findPrincipalByValue('phone', data.phone);
      if (existingPhone) {
        throw new ConflictException({
          code: 'PHONE_EXISTS',
          message: 'An account with this phone number already exists',
        });
      }
    }

    // Hash password
    const passwordHash = await this.hashPin(password);

    // Determine email and phone from collected data
    const email = pendingReg.contactType === 'email'
      ? pendingReg.contactIdentifier
      : data.businessEmail || '';
    const phone = pendingReg.contactType === 'phone'
      ? pendingReg.contactIdentifier
      : data.phone;

    // Map relationship to business role
    const roleMapping: Record<string, 'owner' | 'director' | 'signatory' | 'admin' | 'operator' | 'staff'> = {
      authorized_signatory: 'signatory',
      owner: 'owner',
      director: 'director',
      staff: 'staff',
    };
    const businessRole = roleMapping[data.relationship] || 'staff';

    // Create business identity with profile
    const businessResult = await this.identityService.createBusinessIdentityWithProfile({
      profile: {
        legalName: data.legalName,
        businessType: data.businessType as any,
      },
      principals: [
        ...(email ? [{ type: 'email' as const, value: email, isPrimary: true }] : []),
        ...(phone && phone !== email ? [{ type: 'phone' as const, value: phone, isPrimary: true }] : []),
      ],
    });

    const businessIdentity = businessResult.identity;
    const principals = businessResult.principals;

    // Update business profile with email, phone, and registration number
    const registrationNumber = data.rcNumber || data.registrationNumber;
    if (email || phone || registrationNumber) {
      await this.identityService.updateBusinessProfile(businessIdentity.id, {
        businessEmail: email || undefined,
        businessPhone: phone || undefined,
        registrationNumber: registrationNumber || undefined,
      });
    }

    // Mark contact as verified (since OTP was verified)
    const contactPrincipal = principals.find(
      (p) => p.principalValue === pendingReg.contactIdentifier,
    );
    if (contactPrincipal) {
      await this.identityService.verifyPrincipal(contactPrincipal.id);
    }

    // Update identity status to active
    await this.identityService.updateStatus(businessIdentity.id, 'active', undefined, 'Business registration completed');

    // Store password in auth_secrets
    await this.identityService.setAuthSecret(businessIdentity.id, 'password', passwordHash);

    // Create a person profile for the business identity to store contact person's details
    // This allows firstName/lastName to be retrieved when fetching the business profile
    await this.identityService.createPersonProfileForBusiness(businessIdentity.id, {
      firstName: data.firstName,
      lastName: data.lastName,
    });

    // Create business relationship (this also creates a person identity for the registering user)
    try {
      const relationship = await this.identityService.addBusinessRelationship(businessIdentity.id, {
        name: `${data.firstName} ${data.lastName}`,
        role: businessRole,
      });
      this.logger.log(`Business relationship created: ${relationship.id} for business ${businessIdentity.id}`);
    } catch (relationshipError) {
      this.logger.error(`Failed to create business relationship: ${relationshipError}`);
      throw relationshipError;
    }

    // Assign roles and properties
    await this.assignRolesAndPropertiesToNewUser(
      businessIdentity.id,
      true,
      data.legalName,
      context.channel,
    );

    // Generate tokens
    const tokens = await this.generateTokens(businessIdentity.id, email);

    // Create session
    const session = await this.sessionsService.createSession({
      identityId: businessIdentity.id,
      refreshToken: tokens.refreshToken,
      deviceId: context.deviceId,
      deviceName: context.deviceName,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress || 'unknown',
    });

    // Log identity event
    await this.identityService.logEvent(businessIdentity.id, 'created', {
      description: 'Business registered via staged flow',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Delete pending registration
    await this.deletePendingRegistration(pendingId);

    // Send welcome email
    if (email) {
      this.mailService.sendWelcomeEmail(email, {
        firstName: data.firstName,
        lastName: data.lastName,
      }).catch(() => {
        this.logger.warn(`Failed to send welcome email to ${email}`);
      });
    }

    this.logger.log(`Business registered: ${data.legalName} (${email}) from ${context.ipAddress}`);

    const emailPrincipal = principals.find(p => p.principalType === 'email');
    const phonePrincipal = principals.find(p => p.principalType === 'phone');

    return {
      user: {
        id: businessIdentity.id,
        email: email,
        phone: phone,
        firstName: data.firstName,
        lastName: data.lastName,
        accountType: 'business',
        legalName: data.legalName,
        businessType: data.businessType,
        status: businessIdentity.status,
        tier: 'basic',
        emailVerified: emailPrincipal?.isVerified || pendingReg.contactType === 'email',
        phoneVerified: phonePrincipal?.isVerified || pendingReg.contactType === 'phone',
        role: 'user',
        requiresOnboarding: false, // No longer requires onboarding since relationship is already set
        onboardingStep: undefined,
      },
      ...tokens,
      sessionId: session.id,
    };
  }

  /**
   * Get pending registration by ID
   */
  async getPendingRegistration(pendingId: string) {
    const pendingReg = await this.getPendingRegistrationById(pendingId);
    const data = pendingReg.data as PendingBusinessRegistrationData;

    return {
      id: pendingReg.id,
      contactIdentifier: pendingReg.contactIdentifier,
      contactType: pendingReg.contactType,
      currentStep: pendingReg.currentStep,
      data: {
        legalName: data.legalName,
        businessType: data.businessType,
        businessEmail: data.businessEmail,
        businessPhone: data.businessPhone,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        relationship: data.relationship,
      },
      expiresAt: pendingReg.expiresAt.toISOString(),
    };
  }

  /**
   * Helper: Get pending registration by ID with validation
   */
  private async getPendingRegistrationById(pendingId: string): Promise<PendingBusinessRegistration> {
    const [pendingReg] = await this.db
      .select()
      .from(pendingBusinessRegistrations)
      .where(eq(pendingBusinessRegistrations.id, pendingId))
      .limit(1);

    if (!pendingReg) {
      throw new NotFoundException({
        code: 'PENDING_REGISTRATION_NOT_FOUND',
        message: 'Registration not found or has expired. Please start again.',
      });
    }

    // Check if expired
    if (new Date() > pendingReg.expiresAt) {
      // Clean up expired record
      await this.deletePendingRegistration(pendingId);
      throw new BadRequestException({
        code: 'REGISTRATION_EXPIRED',
        message: 'Registration has expired. Please start again.',
      });
    }

    return pendingReg;
  }

  /**
   * Helper: Delete pending registration
   */
  private async deletePendingRegistration(pendingId: string): Promise<void> {
    await this.db
      .delete(pendingBusinessRegistrations)
      .where(eq(pendingBusinessRegistrations.id, pendingId));
  }

  /**
   * Cleanup expired pending registrations
   * Can be called by a cron job
   */
  async cleanupExpiredPendingRegistrations(): Promise<number> {
    const result = await this.db
      .delete(pendingBusinessRegistrations)
      .where(lt(pendingBusinessRegistrations.expiresAt, new Date()))
      .returning();

    if (result.length > 0) {
      this.logger.log(`Cleaned up ${result.length} expired pending registrations`);
    }

    return result.length;
  }
}
