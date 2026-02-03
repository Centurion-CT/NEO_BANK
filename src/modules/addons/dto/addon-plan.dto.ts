import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsObject,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAddonPlanDto {
  @ApiProperty({ description: 'Addon ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty({ message: 'Addon ID is required' })
  addonId: string;

  @ApiProperty({ description: 'Plan name', example: 'Basic' })
  @IsString()
  @IsNotEmpty({ message: 'Plan name is required' })
  @MaxLength(100, { message: 'Name must be at most 100 characters' })
  name: string;

  @ApiPropertyOptional({ description: 'Plan description', example: 'Essential features for small businesses' })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description must be at most 500 characters' })
  description?: string;

  @ApiProperty({ description: 'Monthly price', example: 5000 })
  @IsNumber()
  @Min(0, { message: 'Price cannot be negative' })
  monthlyPrice: number;

  @ApiProperty({ description: 'Yearly price', example: 50000 })
  @IsNumber()
  @Min(0, { message: 'Price cannot be negative' })
  yearlyPrice: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'NGN' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({ description: 'List of features', example: ['10 Users', '100GB Storage'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @ApiPropertyOptional({ description: 'Plan-specific limits', example: { users: 10, storage: 100 } })
  @IsObject()
  @IsOptional()
  limits?: Record<string, number>;

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
  @Min(0)
  sortOrder?: number;
}

export class UpdateAddonPlanDto {
  @ApiPropertyOptional({ description: 'Plan name' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
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

  @ApiPropertyOptional({ description: 'Plan-specific limits' })
  @IsObject()
  @IsOptional()
  limits?: Record<string, number>;

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
  @Min(0)
  sortOrder?: number;
}
