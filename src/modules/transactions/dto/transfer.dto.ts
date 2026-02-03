import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
  MaxLength,
  MinLength,
  IsUUID,
} from 'class-validator';

/**
 * Transfer DTO
 * Validates fund transfer requests
 */
export class TransferDto {
  @ApiProperty({
    description: 'Source account ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  sourceAccountId: string;

  @ApiProperty({
    description: 'Destination account number',
    example: '0123456789',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(10)
  destinationAccountNumber: string;

  @ApiProperty({
    description: 'Transfer amount',
    example: 5000,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'NGN',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency: string;

  @ApiPropertyOptional({
    description: 'Transfer description',
    example: 'Payment for services',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({
    description: 'Narration',
    example: 'Invoice #123',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  narration?: string;
}
