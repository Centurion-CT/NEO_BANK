import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn, Matches } from 'class-validator';

/**
 * Verify OTP DTO
 *
 * Used to verify an OTP code
 */
export class VerifyOtpDto {
  @ApiProperty({
    description: 'Email address or phone number the OTP was sent to',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty({ message: 'Target (email or phone) is required' })
  target: string;

  @ApiProperty({
    description: 'Purpose of the OTP',
    example: 'email_verification',
    enum: ['email_verification', 'phone_verification', 'pin_reset', 'transaction_confirmation', 'login_mfa', 'sensitive_action'],
  })
  @IsString()
  @IsNotEmpty({ message: 'Purpose is required' })
  @IsIn(['email_verification', 'phone_verification', 'pin_reset', 'transaction_confirmation', 'login_mfa', 'sensitive_action'])
  purpose: string;

  @ApiProperty({
    description: '6-digit OTP code',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP code is required' })
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  code: string;
}
