import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ description: 'Plan name', example: 'Premium Plan' })
  @IsString()
  @IsNotEmpty({ message: 'Plan name is required' })
  @MaxLength(100, { message: 'Plan name must be at most 100 characters' })
  name: string;

  @ApiProperty({
    description: 'Plan type',
    enum: ['basic', 'verified', 'premium', 'business'],
    example: 'premium',
  })
  @IsEnum(['basic', 'verified', 'premium', 'business'], { message: 'Invalid plan type' })
  @IsNotEmpty({ message: 'Plan type is required' })
  type: 'basic' | 'verified' | 'premium' | 'business';

  @ApiPropertyOptional({ description: 'Plan description', example: 'Full access to all features' })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description must be at most 500 characters' })
  description?: string;

  @ApiProperty({ description: 'Monthly price', example: 2000 })
  @IsNumber()
  @Min(0, { message: 'Price cannot be negative' })
  monthlyPrice: number;

  @ApiProperty({ description: 'Yearly price', example: 20000 })
  @IsNumber()
  @Min(0, { message: 'Price cannot be negative' })
  yearlyPrice: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'NGN' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({ description: 'List of features', example: ['Unlimited transfers', '24/7 support'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @ApiPropertyOptional({ description: 'Daily transaction limit', example: 2000000 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  dailyTransactionLimit?: number;

  @ApiPropertyOptional({ description: 'Monthly transaction limit', example: 50000000 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  monthlyTransactionLimit?: number;

  @ApiPropertyOptional({ description: 'Maximum transfers per day', example: -1 })
  @IsNumber()
  @IsOptional()
  maxTransfersPerDay?: number;

  @ApiPropertyOptional({ description: 'Maximum accounts allowed', default: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  maxAccountsAllowed?: number;

  @ApiPropertyOptional({ description: 'Mark as popular plan', default: false })
  @IsBoolean()
  @IsOptional()
  isPopular?: boolean;

  @ApiPropertyOptional({ description: 'Trial period in days', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({ description: 'Sort order for display', default: 0 })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class UpdatePlanDto {
  @ApiPropertyOptional({ description: 'Plan name', example: 'Premium Plan' })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Plan name must be at most 100 characters' })
  name?: string;

  @ApiPropertyOptional({ description: 'Plan description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Monthly price' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  monthlyPrice?: number;

  @ApiPropertyOptional({ description: 'Yearly price' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  yearlyPrice?: number;

  @ApiPropertyOptional({ description: 'List of features' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @ApiPropertyOptional({ description: 'Daily transaction limit' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  dailyTransactionLimit?: number;

  @ApiPropertyOptional({ description: 'Monthly transaction limit' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  monthlyTransactionLimit?: number;

  @ApiPropertyOptional({ description: 'Maximum transfers per day' })
  @IsNumber()
  @IsOptional()
  maxTransfersPerDay?: number;

  @ApiPropertyOptional({ description: 'Maximum accounts allowed' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  maxAccountsAllowed?: number;

  @ApiPropertyOptional({ description: 'Mark as popular plan' })
  @IsBoolean()
  @IsOptional()
  isPopular?: boolean;

  @ApiPropertyOptional({ description: 'Activate/deactivate plan' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Trial period in days' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({ description: 'Sort order for display' })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}
