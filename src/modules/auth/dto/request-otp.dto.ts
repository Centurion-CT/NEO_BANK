import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

/**
 * Request OTP DTO
 *
 * Used to request an OTP for verification purposes
 */
export class RequestOtpDto {
  @ApiProperty({
    description: 'Email address or phone number to send OTP to',
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
}
