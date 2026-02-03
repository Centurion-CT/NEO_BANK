import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

/**
 * Change PIN DTO
 *
 * Used to change the user's login PIN
 */
export class ChangePinDto {
  @ApiProperty({
    description: 'Current 6-digit PIN',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'Current PIN is required' })
  @Matches(/^\d{6}$/, { message: 'Current PIN must be exactly 6 digits' })
  currentPin: string;

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

/**
 * Verify Login PIN DTO
 *
 * Used to verify login PIN for sensitive operations
 */
export class VerifyLoginPinDto {
  @ApiProperty({
    description: '6-digit login PIN',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'Login PIN is required' })
  @Matches(/^\d{6}$/, { message: 'Login PIN must be exactly 6 digits' })
  pin: string;
}
