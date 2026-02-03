import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { BiometricService } from './biometric.service';
import { EnableBiometricDto } from './dto/enable-biometric.dto';
import { VerifyBiometricDto } from './dto/verify-biometric.dto';
import { BiometricLoginDto, GenerateChallengeDto } from './dto/biometric-login.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('Biometric')
@Controller('biometric')
@UseGuards(ThrottlerGuard)
export class BiometricController {
  constructor(private readonly biometricService: BiometricService) {}

  // =====================
  // AUTHENTICATED ENDPOINTS
  // =====================

  @Post('enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable biometric authentication for the current session' })
  @ApiHeader({ name: 'x-session-id', description: 'Session ID', required: true })
  @ApiResponse({ status: 201, description: 'Biometric enabled successfully' })
  @ApiResponse({ status: 401, description: 'Invalid PIN' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async enableBiometric(
    @CurrentUser('id') userId: string,
    @Headers('x-session-id') sessionId: string,
    @Body() dto: EnableBiometricDto,
  ) {
    const result = await this.biometricService.enableBiometric(userId, sessionId, dto);
    return {
      message: 'Biometric enabled successfully',
      biometricToken: result.biometricToken,
    };
  }

  @Post('disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable biometric authentication for the current session' })
  @ApiHeader({ name: 'x-session-id', description: 'Session ID', required: true })
  @ApiResponse({ status: 200, description: 'Biometric disabled successfully' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async disableBiometric(
    @CurrentUser('id') userId: string,
    @Headers('x-session-id') sessionId: string,
  ) {
    await this.biometricService.disableBiometric(userId, sessionId);
    return { message: 'Biometric disabled successfully' };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get biometric status for the current session' })
  @ApiHeader({ name: 'x-session-id', description: 'Session ID', required: true })
  @ApiResponse({ status: 200, description: 'Biometric status' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getBiometricStatus(
    @CurrentUser('id') userId: string,
    @Headers('x-session-id') sessionId: string,
  ) {
    const status = await this.biometricService.getBiometricStatus(userId, sessionId);
    return { status };
  }

  @Post('challenge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a biometric verification challenge' })
  @ApiHeader({ name: 'x-session-id', description: 'Session ID', required: true })
  @ApiResponse({ status: 201, description: 'Challenge generated' })
  @ApiResponse({ status: 400, description: 'Biometric not enabled' })
  @ApiResponse({ status: 403, description: 'Biometric locked' })
  async generateChallenge(
    @CurrentUser('id') userId: string,
    @Headers('x-session-id') sessionId: string,
  ) {
    const result = await this.biometricService.generateChallenge(userId, sessionId);
    return result;
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a biometric challenge response' })
  @ApiHeader({ name: 'x-session-id', description: 'Session ID', required: true })
  @ApiResponse({ status: 200, description: 'Verification result' })
  @ApiResponse({ status: 400, description: 'Invalid challenge or response' })
  @ApiResponse({ status: 401, description: 'Invalid biometric token' })
  async verifyChallenge(
    @CurrentUser('id') userId: string,
    @Headers('x-session-id') sessionId: string,
    @Body() dto: VerifyBiometricDto,
  ) {
    const result = await this.biometricService.verifyChallenge(userId, sessionId, dto);
    return result;
  }

  // =====================
  // PUBLIC ENDPOINTS (for login)
  // =====================

  @Post('login/challenge')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @ApiOperation({ summary: 'Generate a biometric login challenge (public, rate-limited)' })
  @ApiResponse({ status: 201, description: 'Challenge generated' })
  @ApiResponse({ status: 400, description: 'Biometric not enabled' })
  @ApiResponse({ status: 403, description: 'Device not trusted or biometric locked' })
  async generateLoginChallenge(@Body() dto: GenerateChallengeDto) {
    if (!dto.sessionId) {
      throw new Error('Session ID is required for biometric login challenge');
    }
    const result = await this.biometricService.generateLoginChallenge(dto.sessionId);
    return result;
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with biometric authentication (public, rate-limited)' })
  @ApiResponse({
    status: 200,
    description: 'Login successful - returns auth tokens',
  })
  @ApiResponse({ status: 400, description: 'Invalid challenge or response' })
  @ApiResponse({ status: 401, description: 'Invalid biometric token' })
  @ApiResponse({ status: 403, description: 'Device not trusted or biometric locked' })
  async biometricLogin(@Body() dto: BiometricLoginDto) {
    // Verify biometric
    const result = await this.biometricService.verifyBiometricLogin(dto);

    // Note: In a real implementation, this would call AuthService to generate new tokens
    // For now, we return the verification result and the auth service integration
    // would handle token generation

    return {
      message: 'Biometric verification successful',
      verified: true,
      userId: result.identityId, // Return as userId for API compatibility
      sessionId: result.sessionId,
      // In production, add: accessToken, refreshToken
      // This requires integration with AuthService.biometricLogin()
    };
  }
}
