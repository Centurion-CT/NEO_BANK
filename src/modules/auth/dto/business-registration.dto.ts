import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsIn,
  IsOptional,
  Length,
  IsUUID,
} from 'class-validator';

/**
 * Business Type Enum
 * Supported business types for registration
 */
const BUSINESS_TYPES = [
  'enterprise',
  'limited_liability',
  'partnership',
  'sole_proprietorship',
  'ngo',
] as const;

/**
 * Business Relationship Enum
 * Relationship types between a person and a business
 */
const BUSINESS_RELATIONSHIPS = [
  'authorized_signatory',
  'owner',
  'director',
  'staff',
] as const;

/**
 * Init Business Registration DTO
 * Start the business registration process after OTP verification
 */
export class InitBusinessRegistrationDto {
  @ApiProperty({
    description: 'Email or phone number (verified via OTP)',
    example: 'business@example.com',
  })
  @IsString()
  @IsNotEmpty({ message: 'Identifier is required' })
  identifier: string;

  @ApiProperty({
    description: 'OTP code for verification',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP is required' })
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  otp: string;
}

/**
 * Business Info Step DTO
 * Step 1: Collect business information
 */
export class BusinessInfoStepDto {
  @ApiProperty({
    description: 'Pending registration ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'Invalid pending registration ID' })
  @IsNotEmpty({ message: 'Pending registration ID is required' })
  pendingId: string;

  @ApiProperty({
    description: 'Legal business name',
    example: 'Acme Corporation Ltd',
  })
  @IsString()
  @IsNotEmpty({ message: 'Legal name is required' })
  @MinLength(2, { message: 'Legal name must be at least 2 characters' })
  @MaxLength(255, { message: 'Legal name must not exceed 255 characters' })
  legalName: string;

  @ApiProperty({
    description: 'Business type',
    example: 'limited_liability',
    enum: BUSINESS_TYPES,
  })
  @IsString()
  @IsNotEmpty({ message: 'Business type is required' })
  @IsIn(BUSINESS_TYPES, {
    message: 'Business type must be enterprise, limited_liability, partnership, sole_proprietorship, or ngo',
  })
  businessType: typeof BUSINESS_TYPES[number];

  @ApiPropertyOptional({
    description: 'Business email (defaults to contact identifier if email)',
    example: 'contact@business.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid business email' })
  businessEmail?: string;

  @ApiPropertyOptional({
    description: 'Business phone number',
    example: '+2348012345678',
  })
  @IsOptional()
  @IsString()
  businessPhone?: string;

  @ApiPropertyOptional({
    description: 'RC Number (required for Limited Liability, Partnership, Sole Proprietorship, NGO)',
    example: 'RC123456',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'RC Number must be at least 2 characters' })
  rcNumber?: string;

  @ApiPropertyOptional({
    description: 'Registration Number (required for Enterprise)',
    example: 'BN123456',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Registration Number must be at least 2 characters' })
  registrationNumber?: string;
}

/**
 * Relationship Step DTO
 * Step 2: Collect user-business relationship information
 */
export class RelationshipStepDto {
  @ApiProperty({
    description: 'Pending registration ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'Invalid pending registration ID' })
  @IsNotEmpty({ message: 'Pending registration ID is required' })
  pendingId: string;

  @ApiProperty({
    description: 'First name of the person registering',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  @MaxLength(50, { message: 'First name must not exceed 50 characters' })
  firstName: string;

  @ApiProperty({
    description: 'Last name of the person registering',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  @MaxLength(50, { message: 'Last name must not exceed 50 characters' })
  lastName: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+2348012345678',
  })
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone: string;

  @ApiProperty({
    description: 'Relationship to the business',
    example: 'owner',
    enum: BUSINESS_RELATIONSHIPS,
  })
  @IsString()
  @IsNotEmpty({ message: 'Relationship is required' })
  @IsIn(BUSINESS_RELATIONSHIPS, {
    message: 'Relationship must be authorized_signatory, owner, director, or staff',
  })
  relationship: typeof BUSINESS_RELATIONSHIPS[number];
}

/**
 * Password Step DTO
 * Step 3: Create password to complete registration
 */
export class PasswordStepDto {
  @ApiProperty({
    description: 'Pending registration ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'Invalid pending registration ID' })
  @IsNotEmpty({ message: 'Pending registration ID is required' })
  pendingId: string;

  @ApiProperty({
    description: 'Password (min 8 chars, must contain uppercase, lowercase, and number)',
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
    description: 'Confirm password',
    example: 'MySecure123',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password confirmation is required' })
  confirmPassword: string;
}

/**
 * Get Pending Registration Response
 */
export class PendingRegistrationResponseDto {
  @ApiProperty({ description: 'Pending registration ID' })
  id: string;

  @ApiProperty({ description: 'Contact identifier' })
  contactIdentifier: string;

  @ApiProperty({ description: 'Contact type', enum: ['email', 'phone'] })
  contactType: 'email' | 'phone';

  @ApiProperty({ description: 'Current step in the registration flow' })
  currentStep: 'business_info' | 'relationship' | 'password';

  @ApiProperty({ description: 'Collected data so far' })
  data: {
    legalName?: string;
    businessType?: string;
    businessEmail?: string;
    businessPhone?: string;
    rcNumber?: string;
    registrationNumber?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    relationship?: string;
  };

  @ApiProperty({ description: 'Expiration timestamp' })
  expiresAt: string;
}

/**
 * Check Registration Number DTO
 * Check if a registration number (RC/RN) is already in use
 */
export class CheckRegistrationNumberDto {
  @ApiProperty({
    description: 'Registration number to check (RC or RN)',
    example: 'RC123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'Registration number is required' })
  @MinLength(2, { message: 'Registration number must be at least 2 characters' })
  registrationNumber: string;
}
