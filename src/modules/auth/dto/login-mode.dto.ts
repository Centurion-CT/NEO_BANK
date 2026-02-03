import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn, MinLength, Matches, IsEmail, ValidateIf } from 'class-validator';

/**
 * Check Account DTO
 *
 * Used to check if an account exists with given identifier
 */
export class CheckAccountDto {
  @ApiProperty({
    description: 'Email or phone number',
    example: 'user@example.com',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email or phone is required' })
  identifier: string;
}

/**
 * Update Login Mode DTO
 *
 * Used to change the user's preferred login authentication method
 */
export class UpdateLoginModeDto {
  @ApiProperty({
    description: 'Preferred login mode (pin or password)',
    example: 'pin',
    enum: ['pin', 'password'],
  })
  @IsString()
  @IsNotEmpty({ message: 'Login mode is required' })
  @IsIn(['pin', 'password'], { message: 'Login mode must be either pin or password' })
  loginMode: 'pin' | 'password';
}

/**
 * Set Password DTO
 *
 * Used to set a password (for password login mode)
 */
export class SetPasswordDto {
  @ApiProperty({
    description: 'New password (minimum 8 characters, must include uppercase, lowercase, number)',
    example: 'MySecure123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @ApiProperty({
    description: 'Confirm password',
    example: 'MySecure123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password confirmation is required' })
  confirmPassword: string;
}

/**
 * Set PIN DTO
 *
 * Used to set a PIN (for PIN login mode)
 */
export class SetPinDto {
  @ApiProperty({
    description: 'New 6-digit PIN',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'PIN is required' })
  @Matches(/^\d{6}$/, { message: 'PIN must be exactly 6 digits' })
  pin: string;

  @ApiProperty({
    description: 'Confirm PIN',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'PIN confirmation is required' })
  @Matches(/^\d{6}$/, { message: 'Confirm PIN must be exactly 6 digits' })
  confirmPin: string;
}

/**
 * Change Password DTO
 *
 * Used to change an existing password
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldSecure123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @ApiProperty({
    description: 'New password (minimum 8 characters, must include uppercase, lowercase, number)',
    example: 'NewSecure456',
  })
  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword: string;

  @ApiProperty({
    description: 'Confirm new password',
    example: 'NewSecure456',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password confirmation is required' })
  confirmPassword: string;
}
