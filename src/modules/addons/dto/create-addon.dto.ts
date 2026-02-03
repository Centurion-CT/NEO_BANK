import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

export class CreateAddonDto {
  @ApiProperty({ description: 'Unique slug identifier', example: 'erp' })
  @IsString()
  @IsNotEmpty({ message: 'Slug is required' })
  @MaxLength(50, { message: 'Slug must be at most 50 characters' })
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must contain only lowercase letters, numbers, and hyphens' })
  slug: string;

  @ApiProperty({ description: 'Addon name', example: 'ERP System' })
  @IsString()
  @IsNotEmpty({ message: 'Addon name is required' })
  @MaxLength(100, { message: 'Name must be at most 100 characters' })
  name: string;

  @ApiPropertyOptional({ description: 'Full description', example: 'Complete enterprise resource planning solution' })
  @IsString()
  @IsOptional()
  @MaxLength(1000, { message: 'Description must be at most 1000 characters' })
  description?: string;

  @ApiPropertyOptional({ description: 'Short description for cards', example: 'ERP for your business' })
  @IsString()
  @IsOptional()
  @MaxLength(255, { message: 'Short description must be at most 255 characters' })
  shortDescription?: string;

  @ApiPropertyOptional({ description: 'Icon name (lucide icon)', default: 'package' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ description: 'Theme color', default: 'blue' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ description: 'Addon category', default: 'business' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ description: 'List of features', example: ['Inventory Management', 'Purchase Orders'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @ApiPropertyOptional({ description: 'Activate addon', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Mark as coming soon', default: false })
  @IsBoolean()
  @IsOptional()
  isComingSoon?: boolean;

  @ApiPropertyOptional({ description: 'Sort order for display', default: 0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  sortOrder?: number;
}

export class UpdateAddonDto {
  @ApiPropertyOptional({ description: 'Addon name' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Full description' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Short description for cards' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  shortDescription?: string;

  @ApiPropertyOptional({ description: 'Icon name (lucide icon)' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ description: 'Theme color' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ description: 'Addon category' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ description: 'List of features' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @ApiPropertyOptional({ description: 'Activate/deactivate addon' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Mark as coming soon' })
  @IsBoolean()
  @IsOptional()
  isComingSoon?: boolean;

  @ApiPropertyOptional({ description: 'Sort order for display' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  sortOrder?: number;
}
