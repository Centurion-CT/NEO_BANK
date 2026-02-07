import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import { AuthService } from './auth.service';
import { Public, CurrentUser } from '@common/decorators';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import {
  RegisterDto,
  SendRegistrationOtpDto,
  AddBusinessPrincipalDto,
  UpdateBusinessPrincipalDto,
  LoginDto,
  RefreshTokenDto,
  RequestOtpDto,
  VerifyOtpDto,
  ChangePinDto,
  VerifyLoginPinDto,
  SetTransactionPinDto,
  ChangeTransactionPinDto,
  VerifyTransactionPinDto,
  ForgotPinDto,
  ResetPinDto,
  EnableMfaDto,
  VerifyMfaSetupDto,
  DisableMfaDto,
  VerifyMfaLoginDto,
  RequestMfaEmailFallbackDto,
  UpdateLoginModeDto,
  SetPasswordDto,
  ChangePasswordDto,
  SetPinDto,
  CheckAccountDto,
  VerifyCredentialDto,
  InitBusinessRegistrationDto,
  BusinessInfoStepDto,
  RelationshipStepDto,
  PasswordStepDto,
  CheckRegistrationNumberDto,
} from './dto';
import { SessionInfo } from '@modules/sessions/sessions.service';

/**
 * Authentication Controller
 * Handles all authentication-related endpoints
 */
@ApiTags('Auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ============================================================================
  // REGISTRATION & LOGIN
  // ============================================================================

  /**
   * Send OTP for registration email verification
   */
  @Public()
  @Post('register/send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Send registration OTP',
    description: 'Send OTP to email for verification before registration',
  })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async sendRegistrationOtp(@Body() dto: SendRegistrationOtpDto) {
    return this.authService.sendRegistrationOtp(dto.email);
  }

  /**
   * Register a new user
   */
  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Creates a new user account with email, phone, and password. Requires email OTP verification.',
  })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data or OTP' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  async register(@Body() registerDto: RegisterDto, @Req() req: Request) {
    return this.authService.register(registerDto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId: req.headers['x-device-id'] as string,
      deviceName: req.headers['x-device-name'] as string,
    });
  }

  // ============================================================================
  // BUSINESS ONBOARDING
  // ============================================================================

  /**
   * Add a business principal/director
   */
  @UseGuards(JwtAuthGuard)
  @Post('business/principals')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add business principal',
    description: 'Add a director or principal to a business account',
  })
  @ApiResponse({ status: 201, description: 'Principal added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or not a business account' })
  async addBusinessPrincipal(
    @CurrentUser('id') userId: string,
    @Body() dto: AddBusinessPrincipalDto,
  ) {
    return this.authService.addBusinessPrincipal(userId, dto);
  }

  /**
   * Get business principals/directors
   */
  @UseGuards(JwtAuthGuard)
  @Get('business/principals')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get business principals',
    description: 'Get all directors and principals for a business account',
  })
  @ApiResponse({ status: 200, description: 'List of principals' })
  async getBusinessPrincipals(@CurrentUser('id') userId: string) {
    return this.authService.getBusinessPrincipals(userId);
  }

  /**
   * Update a business principal
   */
  @UseGuards(JwtAuthGuard)
  @Patch('business/principals/:id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update business principal',
    description: 'Update a director or principal for a business account',
  })
  @ApiParam({ name: 'id', description: 'Principal ID' })
  @ApiResponse({ status: 200, description: 'Principal updated successfully' })
  @ApiResponse({ status: 404, description: 'Principal not found' })
  async updateBusinessPrincipal(
    @CurrentUser('id') userId: string,
    @Param('id') principalId: string,
    @Body() dto: UpdateBusinessPrincipalDto,
  ) {
    return this.authService.updateBusinessPrincipal(userId, principalId, dto);
  }

  /**
   * Delete a business principal
   */
  @UseGuards(JwtAuthGuard)
  @Delete('business/principals/:id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete business principal',
    description: 'Remove a director or principal from a business account',
  })
  @ApiParam({ name: 'id', description: 'Principal ID' })
  @ApiResponse({ status: 200, description: 'Principal deleted successfully' })
  @ApiResponse({ status: 404, description: 'Principal not found' })
  async deleteBusinessPrincipal(
    @CurrentUser('id') userId: string,
    @Param('id') principalId: string,
  ) {
    return this.authService.deleteBusinessPrincipal(userId, principalId);
  }

  /**
   * Check if business onboarding is complete
   */
  @UseGuards(JwtAuthGuard)
  @Get('business/onboarding-status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check business onboarding status',
    description: 'Check if business has completed required onboarding steps',
  })
  @ApiResponse({ status: 200, description: 'Onboarding status' })
  async getBusinessOnboardingStatus(@CurrentUser('id') userId: string) {
    return this.authService.getBusinessOnboardingStatus(userId);
  }

  // ============================================================================
  // STAGED BUSINESS REGISTRATION
  // ============================================================================

  /**
   * Check if registration number (RC/RN) is already in use
   */
  @Public()
  @Post('business/check-registration-number')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check registration number availability',
    description: 'Check if a business registration number (RC/RN) is already registered',
  })
  @ApiResponse({ status: 200, description: 'Registration number check result' })
  async checkRegistrationNumber(@Body() dto: CheckRegistrationNumberDto) {
    return this.authService.checkRegistrationNumber(dto.registrationNumber);
  }

  /**
   * Initialize business registration after OTP verification
   */
  @Public()
  @Post('business/init')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Initialize business registration',
    description: 'Start business registration flow after OTP verification. Creates a pending registration.',
  })
  @ApiResponse({ status: 200, description: 'Pending registration created' })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  @ApiResponse({ status: 409, description: 'Email/phone already exists' })
  async initBusinessRegistration(@Body() dto: InitBusinessRegistrationDto) {
    return this.authService.initBusinessRegistration(dto.identifier, dto.otp);
  }

  /**
   * Submit business info step
   */
  @Public()
  @Post('business/step/business-info')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Submit business info',
    description: 'Submit business information (Step 1 of staged registration)',
  })
  @ApiResponse({ status: 200, description: 'Business info saved, proceed to relationship step' })
  @ApiResponse({ status: 404, description: 'Pending registration not found or expired' })
  async submitBusinessInfoStep(@Body() dto: BusinessInfoStepDto) {
    return this.authService.submitBusinessInfoStep(dto.pendingId, {
      legalName: dto.legalName,
      businessType: dto.businessType,
      businessEmail: dto.businessEmail,
      businessPhone: dto.businessPhone,
      rcNumber: dto.rcNumber,
      registrationNumber: dto.registrationNumber,
    });
  }

  /**
   * Submit relationship step
   */
  @Public()
  @Post('business/step/relationship')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Submit relationship info',
    description: 'Submit user-business relationship (Step 2 of staged registration)',
  })
  @ApiResponse({ status: 200, description: 'Relationship info saved, proceed to password step' })
  @ApiResponse({ status: 404, description: 'Pending registration not found or expired' })
  async submitRelationshipStep(@Body() dto: RelationshipStepDto) {
    return this.authService.submitRelationshipStep(dto.pendingId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      relationship: dto.relationship,
    });
  }

  /**
   * Complete business registration with password
   */
  @Public()
  @Post('business/step/password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Complete business registration',
    description: 'Create password and complete business registration (Step 3 of staged registration)',
  })
  @ApiResponse({ status: 201, description: 'Business registered successfully' })
  @ApiResponse({ status: 400, description: 'Password validation failed or incomplete data' })
  @ApiResponse({ status: 404, description: 'Pending registration not found or expired' })
  @ApiResponse({ status: 409, description: 'Email/phone already exists' })
  async completeBusinessRegistration(@Body() dto: PasswordStepDto, @Req() req: Request) {
    return this.authService.completeBusinessRegistration(dto.pendingId, dto.password, dto.confirmPassword, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId: req.headers['x-device-id'] as string,
      deviceName: req.headers['x-device-name'] as string,
    });
  }

  /**
   * Get pending registration status
   */
  @Public()
  @Get('business/pending/:id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get pending registration',
    description: 'Get current step and collected data for a pending registration (for resume)',
  })
  @ApiParam({ name: 'id', description: 'Pending registration ID' })
  @ApiResponse({ status: 200, description: 'Pending registration data' })
  @ApiResponse({ status: 404, description: 'Pending registration not found or expired' })
  async getPendingRegistration(@Param('id') pendingId: string) {
    return this.authService.getPendingRegistration(pendingId);
  }

  /**
   * Check if account exists
   */
  @Public()
  @Post('check-account')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Check account existence',
    description: 'Check if an account exists with the given email/phone and get login preferences',
  })
  @ApiResponse({ status: 200, description: 'Account check result' })
  async checkAccount(@Body() dto: CheckAccountDto) {
    return this.authService.checkAccount(dto.identifier);
  }

  /**
   * Login with email/phone and PIN or Password
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticates user with email/phone and PIN or Password',
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or account locked' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.authService.login(loginDto, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId: req.headers['x-device-id'] as string,
      deviceName: req.headers['x-device-name'] as string,
    });
  }

  /**
   * Refresh access token
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Get a new access token using refresh token',
  })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  /**
   * Logout - revoke session
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout',
    description: 'Revokes the current session',
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const sessionId = (req as any).user?.sessionId;
    return this.authService.logout(userId, sessionId);
  }

  // ============================================================================
  // OTP VERIFICATION
  // ============================================================================

  /**
   * Request OTP
   */
  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Request OTP',
    description: 'Request an OTP code for verification purposes',
  })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.target, dto.purpose as any);
  }

  /**
   * Verify OTP
   */
  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Verify OTP',
    description: 'Verify an OTP code',
  })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.target, dto.purpose as any, dto.code);
  }

  /**
   * Request email verification OTP (authenticated)
   */
  @Post('verify-email/request')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Request email verification',
    description: 'Request an OTP to verify email address',
  })
  @ApiResponse({ status: 200, description: 'Verification OTP sent' })
  async requestEmailVerification(@CurrentUser('id') userId: string) {
    return this.authService.requestEmailVerification(userId);
  }

  /**
   * Verify email address
   */
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Verify email',
    description: 'Verify email address with OTP',
  })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  async verifyEmail(
    @CurrentUser('id') userId: string,
    @Body() dto: { otp: string },
  ) {
    return this.authService.verifyEmail(userId, dto.otp);
  }

  /**
   * Verify phone number
   */
  @Post('verify-phone')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Verify phone',
    description: 'Verify phone number with OTP',
  })
  @ApiResponse({ status: 200, description: 'Phone verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  async verifyPhone(
    @CurrentUser('id') userId: string,
    @Body() dto: { otp: string },
  ) {
    return this.authService.verifyPhone(userId, dto.otp);
  }

  // ============================================================================
  // PIN MANAGEMENT
  // ============================================================================

  /**
   * Change login PIN
   */
  @Post('pin/change')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Change login PIN',
    description: 'Change the user\'s login PIN',
  })
  @ApiResponse({ status: 200, description: 'PIN changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid current PIN or validation error' })
  async changePin(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePinDto,
  ) {
    return this.authService.changePin(userId, dto);
  }

  /**
   * Set transaction PIN (first time)
   */
  @Post('transaction-pin/setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Set transaction PIN',
    description: 'Set up transaction PIN for the first time',
  })
  @ApiResponse({ status: 200, description: 'Transaction PIN set successfully' })
  @ApiResponse({ status: 400, description: 'Transaction PIN already exists or invalid login PIN' })
  async setTransactionPin(
    @CurrentUser('id') userId: string,
    @Body() dto: SetTransactionPinDto,
  ) {
    return this.authService.setTransactionPin(userId, dto);
  }

  /**
   * Change transaction PIN
   */
  @Post('transaction-pin/change')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Change transaction PIN',
    description: 'Change the transaction PIN',
  })
  @ApiResponse({ status: 200, description: 'Transaction PIN changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid current PIN or no transaction PIN set' })
  async changeTransactionPin(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangeTransactionPinDto,
  ) {
    return this.authService.changeTransactionPin(userId, dto);
  }

  /**
   * Verify transaction PIN
   */
  @Post('transaction-pin/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Verify transaction PIN',
    description: 'Verify transaction PIN before sensitive operations',
  })
  @ApiResponse({ status: 200, description: 'Transaction PIN verified' })
  @ApiResponse({ status: 400, description: 'Invalid transaction PIN' })
  async verifyTransactionPin(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyTransactionPinDto,
  ) {
    await this.authService.verifyTransactionPin(userId, dto.pin);
    return { verified: true };
  }

  /**
   * Verify login PIN (for sensitive operations)
   */
  @Post('pin/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Verify login PIN',
    description: 'Verify login PIN for sensitive operations like trusting a device',
  })
  @ApiResponse({ status: 200, description: 'Login PIN verified' })
  @ApiResponse({ status: 400, description: 'Invalid login PIN' })
  async verifyLoginPin(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyLoginPinDto,
  ) {
    await this.authService.verifyLoginPin(userId, dto.pin);
    return { verified: true };
  }

  /**
   * Verify credential (PIN or password) for sensitive operations
   */
  @Post('verify-credential')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Verify credential',
    description: 'Verify PIN or password for sensitive operations like changing login mode',
  })
  @ApiResponse({ status: 200, description: 'Credential verified' })
  @ApiResponse({ status: 400, description: 'Invalid credential' })
  async verifyCredential(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyCredentialDto,
  ) {
    await this.authService.verifyCredential(userId, dto.type, dto.credential);
    return { verified: true };
  }

  /**
   * Forgot PIN - request reset
   */
  @Public()
  @Post('forgot-pin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Forgot PIN',
    description: 'Request PIN reset via OTP',
  })
  @ApiResponse({ status: 200, description: 'Reset code sent if account exists' })
  async forgotPin(@Body() dto: ForgotPinDto) {
    return this.authService.forgotPin(dto);
  }

  /**
   * Reset PIN with OTP
   */
  @Public()
  @Post('reset-pin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Reset PIN',
    description: 'Reset PIN using OTP verification',
  })
  @ApiResponse({ status: 200, description: 'PIN reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid OTP or request' })
  async resetPin(@Body() dto: ResetPinDto) {
    return this.authService.resetPin(dto);
  }

  // ============================================================================
  // MFA
  // ============================================================================

  /**
   * Get MFA status
   */
  @Get('mfa/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get MFA status',
    description: 'Returns the current MFA configuration for the user',
  })
  @ApiResponse({ status: 200, description: 'MFA status retrieved' })
  async getMfaStatus(@CurrentUser('id') userId: string) {
    return this.authService.getMfaStatus(userId);
  }

  /**
   * Enable MFA
   */
  @Post('mfa/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Enable MFA',
    description: 'Initiate MFA setup by choosing a method and receiving a verification code',
  })
  @ApiResponse({ status: 200, description: 'Verification code sent' })
  async enableMfa(
    @CurrentUser('id') userId: string,
    @Body() dto: EnableMfaDto,
  ) {
    return this.authService.enableMfa(userId, dto.method);
  }

  /**
   * Verify MFA setup
   */
  @Post('mfa/verify-setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Verify MFA setup',
    description: 'Confirm OTP to activate MFA',
  })
  @ApiResponse({ status: 200, description: 'MFA enabled successfully' })
  async verifyMfaSetup(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyMfaSetupDto,
  ) {
    return this.authService.verifyMfaSetup(userId, dto.code, dto.method);
  }

  /**
   * Disable MFA
   */
  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Disable MFA',
    description: 'Disable MFA by verifying login PIN',
  })
  @ApiResponse({ status: 200, description: 'MFA disabled successfully' })
  async disableMfa(
    @CurrentUser('id') userId: string,
    @Body() dto: DisableMfaDto,
  ) {
    return this.authService.disableMfa(userId, dto.pin);
  }

  /**
   * Verify TOTP code for authenticated user (sensitive operations)
   */
  @Post('mfa/verify-totp')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Verify TOTP code',
    description: 'Verify a TOTP authenticator code for an authenticated user (used for sensitive operations like device trust)',
  })
  @ApiResponse({ status: 200, description: 'TOTP code verified' })
  @ApiResponse({ status: 400, description: 'Invalid TOTP code' })
  async verifyTotpCode(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyMfaSetupDto,
  ) {
    return this.authService.verifyTotpCode(userId, dto.code);
  }

  /**
   * Verify MFA login challenge
   */
  @Public()
  @Post('mfa/verify-login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Verify MFA login',
    description: 'Complete login by verifying MFA OTP code',
  })
  @ApiResponse({ status: 200, description: 'Login completed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid MFA token or OTP' })
  async verifyMfaLogin(@Body() dto: VerifyMfaLoginDto, @Req() req: Request) {
    return this.authService.verifyMfaLogin(dto.mfaToken, dto.code, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId: req.headers['x-device-id'] as string,
      deviceName: req.headers['x-device-name'] as string,
    }, dto.method || 'totp');
  }

  /**
   * Request email OTP fallback during MFA login
   */
  @Public()
  @Post('mfa/request-email-fallback')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Request email OTP fallback',
    description: 'Request email OTP as fallback when TOTP is the primary MFA method',
  })
  @ApiResponse({ status: 200, description: 'Email OTP sent successfully' })
  @ApiResponse({ status: 401, description: 'Invalid MFA token' })
  async requestMfaEmailFallback(@Body() dto: RequestMfaEmailFallbackDto) {
    return this.authService.requestMfaEmailFallback(dto.mfaToken);
  }

  /**
   * Get backup codes status
   */
  @Get('mfa/backup-codes/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get backup codes status',
    description: 'Returns the number of remaining backup codes',
  })
  @ApiResponse({ status: 200, description: 'Backup codes status retrieved' })
  async getBackupCodesStatus(@CurrentUser('id') userId: string) {
    return this.authService.getBackupCodesStatus(userId);
  }

  /**
   * Regenerate backup codes
   */
  @Post('mfa/backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Regenerate backup codes',
    description: 'Generate new backup codes (requires PIN/password verification). Old codes become invalid.',
  })
  @ApiResponse({ status: 200, description: 'Backup codes regenerated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid PIN/password or MFA not enabled' })
  async regenerateBackupCodes(
    @CurrentUser('id') userId: string,
    @Body() dto: { credential: string },
  ) {
    return this.authService.regenerateBackupCodes(userId, dto.credential);
  }

  // ============================================================================
  // LOGIN MODE
  // ============================================================================

  /**
   * Get current login mode preference
   */
  @Get('login-mode')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get login mode',
    description: 'Returns the user\'s preferred login authentication method (PIN or Password)',
  })
  @ApiResponse({ status: 200, description: 'Login mode retrieved successfully' })
  async getLoginMode(@CurrentUser('id') userId: string) {
    return this.authService.getLoginMode(userId);
  }

  /**
   * Update login mode preference
   */
  @Post('login-mode')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update login mode',
    description: 'Change the preferred login authentication method (PIN or Password)',
  })
  @ApiResponse({ status: 200, description: 'Login mode updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid login mode' })
  async updateLoginMode(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateLoginModeDto,
  ) {
    return this.authService.updateLoginMode(userId, dto.loginMode);
  }

  /**
   * Set password for the first time
   */
  @Post('password/setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Set password',
    description: 'Set a password for the first time',
  })
  @ApiResponse({ status: 200, description: 'Password set successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or password already exists' })
  async setPassword(
    @CurrentUser('id') userId: string,
    @Body() dto: SetPasswordDto,
  ) {
    return this.authService.setPassword(userId, dto.password, dto.confirmPassword);
  }

  /**
   * Change password
   */
  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Change password',
    description: 'Change existing password',
  })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or incorrect current password' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto.currentPassword, dto.newPassword, dto.confirmPassword);
  }

  /**
   * Set login PIN for the first time
   */
  @Post('pin/setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Set login PIN',
    description: 'Set a login PIN for the first time (for users who registered with password)',
  })
  @ApiResponse({ status: 200, description: 'PIN set successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or PIN already exists' })
  async setLoginPin(
    @CurrentUser('id') userId: string,
    @Body() dto: SetPinDto,
  ) {
    return this.authService.setLoginPin(userId, dto.pin, dto.confirmPin);
  }

  // ============================================================================
  // LOGIN CHANNEL PREFERENCES
  // ============================================================================

  /**
   * Get login channel preferences
   */
  @Get('channels')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get login channel preferences',
    description: 'Get which channels (Web, Mobile, USSD) are allowed for login',
  })
  @ApiResponse({ status: 200, description: 'Channel preferences retrieved successfully' })
  async getChannelPreferences(@CurrentUser('id') userId: string) {
    return this.authService.getChannelPreferences(userId);
  }

  /**
   * Update login channel preferences
   */
  @Post('channels')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update login channel preferences',
    description: 'Enable or disable specific login channels (Web, Mobile, USSD)',
  })
  @ApiResponse({ status: 200, description: 'Channel preferences updated successfully' })
  @ApiResponse({ status: 400, description: 'At least one channel must be enabled' })
  async updateChannelPreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: { allowWebLogin?: boolean; allowMobileLogin?: boolean; allowUssdLogin?: boolean },
  ) {
    return this.authService.updateChannelPreferences(userId, dto);
  }

  // ============================================================================
  // GEO TAGGING PREFERENCES
  // ============================================================================

  /**
   * Get geo tagging preferences
   */
  @Get('geo-tagging')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get geo tagging preferences',
    description: 'Get whether geo tagging is enabled for transaction location tracking',
  })
  @ApiResponse({ status: 200, description: 'Geo tagging preferences retrieved successfully' })
  async getGeoTaggingPreferences(@CurrentUser('id') userId: string) {
    return this.authService.getGeoTaggingPreferences(userId);
  }

  /**
   * Update geo tagging preferences
   */
  @Post('geo-tagging')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update geo tagging preferences',
    description: 'Enable or disable geo tagging for transaction location tracking',
  })
  @ApiResponse({ status: 200, description: 'Geo tagging preferences updated successfully' })
  async updateGeoTaggingPreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: { enabled: boolean },
  ) {
    return this.authService.updateGeoTaggingPreferences(userId, dto.enabled);
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Get active sessions
   */
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get active sessions',
    description: 'List all active sessions for the current user',
  })
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  async getSessions(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ): Promise<SessionInfo[]> {
    const currentSessionId = (req as any).user?.sessionId;
    return this.authService.getSessions(userId, currentSessionId);
  }

  /**
   * Revoke a specific session
   */
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Revoke session',
    description: 'Revoke a specific session (logout from that device)',
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID to revoke' })
  @ApiResponse({ status: 200, description: 'Session revoked successfully' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.authService.revokeSession(userId, sessionId);
  }

  /**
   * Revoke all sessions (force logout everywhere)
   */
  @Post('sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Revoke all sessions',
    description: 'Logout from all devices except current',
  })
  @ApiResponse({ status: 200, description: 'All sessions revoked successfully' })
  async revokeAllSessions(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const currentSessionId = (req as any).user?.sessionId;
    return this.authService.revokeAllSessions(userId, currentSessionId);
  }

  /**
   * Trust current device
   */
  @Post('sessions/:sessionId/trust')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Trust device',
    description: 'Mark a device/session as trusted',
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID to trust' })
  @ApiResponse({ status: 200, description: 'Device trusted successfully' })
  async trustDevice(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.authService.trustDevice(userId, sessionId);
  }

  /**
   * Untrust device
   */
  @Post('sessions/:sessionId/untrust')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Untrust device',
    description: 'Remove trusted status from a device/session',
  })
  @ApiParam({ name: 'sessionId', description: 'Session ID to untrust' })
  @ApiResponse({ status: 200, description: 'Device untrusted successfully' })
  async untrustDevice(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.authService.untrustDevice(userId, sessionId);
  }
}
