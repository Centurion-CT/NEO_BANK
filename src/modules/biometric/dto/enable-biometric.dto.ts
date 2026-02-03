import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, Matches } from 'class-validator';

export class EnableBiometricDto {
  @ApiProperty({
    description: 'Type of biometric authentication',
    enum: ['fingerprint', 'face_id', 'touch_id'],
    example: 'fingerprint',
  })
  @IsEnum(['fingerprint', 'face_id', 'touch_id'], { message: 'Invalid biometric type' })
  @IsNotEmpty({ message: 'Biometric type is required' })
  biometricType: 'fingerprint' | 'face_id' | 'touch_id';

  @ApiProperty({ description: 'User PIN for verification', example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'PIN is required' })
  @Matches(/^\d{6}$/, { message: 'PIN must be exactly 6 digits' })
  pin: string;
}
