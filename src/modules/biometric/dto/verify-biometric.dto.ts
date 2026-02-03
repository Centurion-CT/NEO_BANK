import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class VerifyBiometricDto {
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
}
