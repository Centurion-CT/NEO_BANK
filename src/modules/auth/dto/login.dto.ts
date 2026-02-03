import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, ValidateIf, IsOptional } from 'class-validator';

/**
 * User Login DTO
 *
 * Supports login via email or phone number with PIN or Password
 */
export class LoginDto {
  @ApiProperty({
    description: 'Email address or phone number',
    example: 'john.doe@example.com',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email or phone number is required' })
  identifier: string;

  @ApiPropertyOptional({
    description: '6-digit PIN (required if using PIN login mode)',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => !o.password)
  @Matches(/^\d{6}$/, { message: 'PIN must be exactly 6 digits' })
  pin?: string;

  @ApiPropertyOptional({
    description: 'Password (required if using password login mode)',
    example: 'MySecure123',
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => !o.pin)
  @IsNotEmpty({ message: 'Password is required' })
  password?: string;
}
