import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class BiometricLoginDto {
  @ApiProperty({ description: 'Challenge ID returned from /biometric/challenge' })
  @IsUUID('4', { message: 'Invalid challenge ID format' })
  @IsNotEmpty({ message: 'Challenge ID is required' })
  challengeId: string;

  @ApiProperty({ description: 'Challenge response (signed challenge from device)' })
  @IsString()
  @IsNotEmpty({ message: 'Challenge response is required' })
  response: string;

  @ApiProperty({ description: 'Biometric token stored on device' })
  @IsString()
  @IsNotEmpty({ message: 'Biometric token is required' })
  biometricToken: string;

  @ApiProperty({ description: 'Session ID for the trusted device' })
  @IsUUID('4', { message: 'Invalid session ID format' })
  @IsNotEmpty({ message: 'Session ID is required' })
  sessionId: string;
}

export class GenerateChallengeDto {
  @ApiPropertyOptional({ description: 'Session ID (optional if already authenticated)' })
  @IsUUID('4', { message: 'Invalid session ID format' })
  @IsOptional()
  sessionId?: string;
}
