import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

/**
 * Forgot PIN DTO
 *
 * Used to initiate PIN reset process
 */
export class ForgotPinDto {
  @ApiProperty({
    description: 'Email address or phone number',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email or phone number is required' })
  identifier: string;
}

/**
 * Reset PIN DTO
 *
 * Used to reset PIN after OTP verification
 */
export class ResetPinDto {
  @ApiProperty({
    description: 'Email address or phone number',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email or phone number is required' })
  identifier: string;

  @ApiProperty({
    description: '6-digit OTP code received via email/SMS',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP code is required' })
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  otp: string;

  @ApiProperty({
    description: 'New 6-digit PIN',
    example: '654321',
  })
  @IsString()
  @IsNotEmpty({ message: 'New PIN is required' })
  @Matches(/^\d{6}$/, { message: 'New PIN must be exactly 6 digits' })
  newPin: string;

  @ApiProperty({
    description: 'Confirm new 6-digit PIN',
    example: '654321',
  })
  @IsString()
  @IsNotEmpty({ message: 'PIN confirmation is required' })
  @Matches(/^\d{6}$/, { message: 'Confirm PIN must be exactly 6 digits' })
  confirmPin: string;
}
