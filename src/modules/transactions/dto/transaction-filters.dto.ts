import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Transaction Filters DTO
 * Query parameters for transaction history
 */
export class TransactionFiltersDto {
  @ApiPropertyOptional({
    description: 'Filter by account ID',
  })
  @IsUUID()
  @IsOptional()
  accountId?: string;

  @ApiPropertyOptional({
    description: 'Transaction type',
    enum: ['transfer', 'deposit', 'withdrawal', 'payment', 'refund'],
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    description: 'Transaction status',
    enum: ['pending', 'processing', 'completed', 'failed', 'reversed'],
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Start date (ISO string)',
    example: '2024-01-01',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO string)',
    example: '2024-12-31',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Number of records to return',
    example: 50,
    default: 50,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of records to skip',
    example: 0,
    default: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  offset?: number;
}
