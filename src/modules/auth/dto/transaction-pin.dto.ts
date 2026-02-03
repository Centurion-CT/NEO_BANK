import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

/**
 * Set Transaction PIN DTO
 *
 * Used to set up a transaction PIN for the first time
 */
export class SetTransactionPinDto {
  @ApiProperty({
    description: 'New 4-digit transaction PIN',
    example: '1234',
  })
  @IsString()
  @IsNotEmpty({ message: 'Transaction PIN is required' })
  @Matches(/^\d{4}$/, { message: 'Transaction PIN must be exactly 4 digits' })
  pin: string;

  @ApiProperty({
    description: 'Confirm 4-digit transaction PIN',
    example: '1234',
  })
  @IsString()
  @IsNotEmpty({ message: 'PIN confirmation is required' })
  @Matches(/^\d{4}$/, { message: 'Confirm PIN must be exactly 4 digits' })
  confirmPin: string;

  @ApiProperty({
    description: 'Login PIN for verification',
    example: '654321',
  })
  @IsString()
  @IsNotEmpty({ message: 'Login PIN is required for verification' })
  @Matches(/^\d{6}$/, { message: 'Login PIN must be exactly 6 digits' })
  loginPin: string;
}

/**
 * Change Transaction PIN DTO
 *
 * Used to change an existing transaction PIN
 */
export class ChangeTransactionPinDto {
  @ApiProperty({
    description: 'Current 4-digit transaction PIN',
    example: '1234',
  })
  @IsString()
  @IsNotEmpty({ message: 'Current transaction PIN is required' })
  @Matches(/^\d{4}$/, { message: 'Current PIN must be exactly 4 digits' })
  currentPin: string;

  @ApiProperty({
    description: 'New 4-digit transaction PIN',
    example: '4321',
  })
  @IsString()
  @IsNotEmpty({ message: 'New transaction PIN is required' })
  @Matches(/^\d{4}$/, { message: 'New PIN must be exactly 4 digits' })
  newPin: string;

  @ApiProperty({
    description: 'Confirm new 4-digit transaction PIN',
    example: '4321',
  })
  @IsString()
  @IsNotEmpty({ message: 'PIN confirmation is required' })
  @Matches(/^\d{4}$/, { message: 'Confirm PIN must be exactly 4 digits' })
  confirmPin: string;
}

/**
 * Verify Transaction PIN DTO
 *
 * Used to verify transaction PIN before sensitive operations
 */
export class VerifyTransactionPinDto {
  @ApiProperty({
    description: '4-digit transaction PIN',
    example: '1234',
  })
  @IsString()
  @IsNotEmpty({ message: 'Transaction PIN is required' })
  @Matches(/^\d{4}$/, { message: 'Transaction PIN must be exactly 4 digits' })
  pin: string;
}
