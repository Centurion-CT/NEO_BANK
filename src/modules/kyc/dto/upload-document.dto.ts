import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
  MaxLength,
  IsDateString,
  IsIn,
} from 'class-validator';

/**
 * Upload Document DTO
 * Validates KYC document upload requests
 */
export class UploadDocumentDto {
  @ApiProperty({
    description: 'Document type',
    enum: ['bvn', 'government_id', 'passport', 'drivers_license', 'utility_bill', 'selfie'],
    example: 'government_id',
  })
  @IsString()
  @IsIn(['bvn', 'government_id', 'passport', 'drivers_license', 'utility_bill', 'selfie'])
  documentType: string;

  @ApiPropertyOptional({
    description: 'Document number (if applicable)',
    example: '12345678901',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  documentNumber?: string;

  @ApiProperty({
    description: 'File URL (from file upload service)',
    example: 'https://storage.example.com/kyc/doc123.pdf',
  })
  @IsString()
  @MaxLength(500)
  fileUrl: string;

  @ApiProperty({
    description: 'Original file name',
    example: 'my_id.pdf',
  })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1048576,
  })
  @IsNumber()
  @IsPositive()
  fileSize: number;

  @ApiProperty({
    description: 'File MIME type',
    example: 'application/pdf',
  })
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  mimeType: string;

  @ApiPropertyOptional({
    description: 'Document expiry date (if applicable)',
    example: '2025-12-31',
  })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;
}
