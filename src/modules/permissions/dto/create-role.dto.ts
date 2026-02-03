import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
  Matches,
} from 'class-validator';

export type RoleCategoryType = 'PERSONAL' | 'BUSINESS' | 'OPERATIONAL' | 'SYSTEM';
export type RoleType = 'super_admin' | 'admin' | 'support_agent' | 'user';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Unique role code (uppercase, underscores allowed)',
    example: 'CONTENT_MODERATOR',
  })
  @IsString()
  @IsNotEmpty({ message: 'Role code is required' })
  @MaxLength(50, { message: 'Role code must be at most 50 characters' })
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'Role code must be uppercase letters, numbers, and underscores, starting with a letter',
  })
  roleCode: string;

  @ApiProperty({ description: 'Role name', example: 'Content Moderator' })
  @IsString()
  @IsNotEmpty({ message: 'Role name is required' })
  @MaxLength(100, { message: 'Role name must be at most 100 characters' })
  name: string;

  @ApiProperty({
    description: 'Role category',
    enum: ['PERSONAL', 'BUSINESS', 'OPERATIONAL', 'SYSTEM'],
    example: 'OPERATIONAL',
  })
  @IsEnum(['PERSONAL', 'BUSINESS', 'OPERATIONAL', 'SYSTEM'], { message: 'Invalid role category' })
  @IsNotEmpty({ message: 'Role category is required' })
  roleCategory: RoleCategoryType;

  @ApiPropertyOptional({
    description: 'Legacy role type (deprecated, use roleCategory)',
    enum: ['super_admin', 'admin', 'support_agent', 'user'],
    example: 'admin',
  })
  @IsEnum(['super_admin', 'admin', 'support_agent', 'user'], { message: 'Invalid role type' })
  @IsOptional()
  type?: RoleType;

  @ApiPropertyOptional({ description: 'Role description', example: 'Moderates user content' })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description must be at most 500 characters' })
  description?: string;

  @ApiPropertyOptional({ description: 'Whether this is a system role', default: false })
  @IsBoolean()
  @IsOptional()
  isSystemRole?: boolean;
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: 'Role name', example: 'Content Moderator' })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Role name must be at most 100 characters' })
  name?: string;

  @ApiPropertyOptional({ description: 'Role description', example: 'Moderates user content' })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description must be at most 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Role category',
    enum: ['PERSONAL', 'BUSINESS', 'OPERATIONAL', 'SYSTEM'],
  })
  @IsEnum(['PERSONAL', 'BUSINESS', 'OPERATIONAL', 'SYSTEM'], { message: 'Invalid role category' })
  @IsOptional()
  roleCategory?: RoleCategoryType;

  @ApiPropertyOptional({ description: 'Whether the role is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
