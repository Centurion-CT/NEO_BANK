import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  Length,
} from 'class-validator';

/**
 * Verify Identity DTO
 * Validates digital identity verification requests (BVN / NIN)
 */
export class VerifyIdentityDto {
  @ApiProperty({
    description: 'Document type for digital verification',
    enum: ['bvn', 'nin'],
    example: 'bvn',
  })
  @IsString()
  @IsIn(['bvn', 'nin'])
  documentType: 'bvn' | 'nin';

  @ApiProperty({
    description: 'Document number (11 digits for BVN, 11 digits for NIN)',
    example: '12345678901',
  })
  @IsString()
  @Length(11, 11, { message: 'Document number must be exactly 11 digits' })
  documentNumber: string;

  @ApiPropertyOptional({
    description: 'First name (falls back to user profile if omitted)',
    example: 'John',
  })
  @IsString()
  @IsOptional()
  firstname?: string;

  @ApiPropertyOptional({
    description: 'Last name (falls back to user profile if omitted)',
    example: 'Doe',
  })
  @IsString()
  @IsOptional()
  lastname?: string;

  @ApiPropertyOptional({
    description: 'Date of birth in YYYY-MM-DD format (falls back to user profile if omitted)',
    example: '1990-01-15',
  })
  @IsString()
  @IsOptional()
  dob?: string;
}
