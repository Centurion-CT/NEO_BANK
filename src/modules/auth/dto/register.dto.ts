import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsIn,
  ValidateIf,
  IsOptional,
  Length,
} from 'class-validator';

/**
 * Send Registration OTP DTO
 * Request OTP to verify email before registration
 */
export class SendRegistrationOtpDto {
  @ApiProperty({
    description: 'Email address to verify',
    example: 'john.doe@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;
}

/**
 * Base Registration DTO
 * Common fields for both individual and business registration
 */
export class RegisterDto {
  @ApiProperty({
    description: 'Account type',
    example: 'individual',
    enum: ['individual', 'business'],
  })
  @IsString()
  @IsNotEmpty({ message: 'Account type is required' })
  @IsIn(['individual', 'business'], { message: 'Account type must be individual or business' })
  accountType: 'individual' | 'business';

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'User phone number with country code',
    example: '+2348012345678',
  })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone: string;

  @ApiProperty({
    description: 'Password for authentication (min 8 chars, must contain uppercase, lowercase, and number)',
    example: 'MySecure123',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @ApiProperty({
    description: 'OTP code sent to email for verification',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email verification OTP is required' })
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  emailOtp: string;

  // ===== Individual Fields =====
  @ApiPropertyOptional({
    description: 'First name (required for individual accounts)',
    example: 'John',
  })
  @ValidateIf((o) => o.accountType === 'individual')
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  @MaxLength(50, { message: 'First name must not exceed 50 characters' })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name (required for individual accounts)',
    example: 'Doe',
  })
  @ValidateIf((o) => o.accountType === 'individual')
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  @MaxLength(50, { message: 'Last name must not exceed 50 characters' })
  lastName?: string;

  // ===== Business Fields =====
  @ApiPropertyOptional({
    description: 'Legal business name (required for business accounts)',
    example: 'Acme Corporation Ltd',
  })
  @ValidateIf((o) => o.accountType === 'business')
  @IsString()
  @IsNotEmpty({ message: 'Legal name is required' })
  @MinLength(2, { message: 'Legal name must be at least 2 characters' })
  @MaxLength(255, { message: 'Legal name must not exceed 255 characters' })
  legalName?: string;

  @ApiPropertyOptional({
    description: 'Business type (required for business accounts)',
    example: 'limited_liability',
    enum: ['limited_liability', 'enterprise'],
  })
  @ValidateIf((o) => o.accountType === 'business')
  @IsString()
  @IsNotEmpty({ message: 'Business type is required' })
  @IsIn(['limited_liability', 'enterprise'], { message: 'Business type must be limited_liability or enterprise' })
  businessType?: 'limited_liability' | 'enterprise';

  @ApiPropertyOptional({
    description: 'RC Number (required for Limited Liability companies)',
    example: 'RC123456',
  })
  @ValidateIf((o) => o.accountType === 'business' && o.businessType === 'limited_liability')
  @IsString()
  @IsNotEmpty({ message: 'RC Number is required for Limited Liability companies' })
  rcNumber?: string;

  @ApiPropertyOptional({
    description: 'Registration Number (required for Enterprise businesses)',
    example: 'RN789012',
  })
  @ValidateIf((o) => o.accountType === 'business' && o.businessType === 'enterprise')
  @IsString()
  @IsNotEmpty({ message: 'Registration Number is required for Enterprise businesses' })
  registrationNumber?: string;
}

/**
 * Add Business Principal DTO
 * For adding directors/principals after business registration
 */
export class AddBusinessPrincipalDto {
  @ApiProperty({
    description: 'Director/Principal full name',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;

  @ApiProperty({
    description: 'Relationship/Role in the business',
    example: 'director',
    enum: ['owner', 'director', 'signatory'],
  })
  @IsString()
  @IsNotEmpty({ message: 'Relationship is required' })
  @IsIn(['owner', 'director', 'signatory'], { message: 'Relationship must be owner, director, or signatory' })
  relationship: 'owner' | 'director' | 'signatory';

  @ApiPropertyOptional({
    description: 'Ownership percentage (if applicable)',
    example: 25,
  })
  @IsOptional()
  ownershipPercentage?: number;

  @ApiPropertyOptional({
    description: 'Position/Title',
    example: 'Managing Director',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  positionTitle?: string;
}

/**
 * Update Business Principal DTO
 * For updating existing directors/principals
 */
export class UpdateBusinessPrincipalDto {
  @ApiPropertyOptional({
    description: 'Director/Principal full name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Relationship/Role in the business',
    example: 'director',
    enum: ['owner', 'director', 'signatory'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['owner', 'director', 'signatory'], { message: 'Relationship must be owner, director, or signatory' })
  relationship?: 'owner' | 'director' | 'signatory';

  @ApiPropertyOptional({
    description: 'Ownership percentage (if applicable)',
    example: 25,
  })
  @IsOptional()
  ownershipPercentage?: number;

  @ApiPropertyOptional({
    description: 'Position/Title',
    example: 'Managing Director',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  positionTitle?: string;
}
