import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional, IsDateString, IsEnum } from 'class-validator';

export type ScopeType = 'GLOBAL' | 'TENANT' | 'PROPERTY';

export class AssignRoleDto {
  @ApiProperty({ description: 'Identity ID to assign the role to', example: 'uuid' })
  @IsUUID('4', { message: 'Invalid identity ID format' })
  @IsNotEmpty({ message: 'Identity ID is required' })
  identityId: string;

  @ApiProperty({ description: 'Role ID to assign', example: 'uuid' })
  @IsUUID('4', { message: 'Invalid role ID format' })
  @IsNotEmpty({ message: 'Role ID is required' })
  roleId: string;

  @ApiProperty({
    description: 'Scope of the role assignment',
    enum: ['GLOBAL', 'TENANT', 'PROPERTY'],
    example: 'GLOBAL',
  })
  @IsEnum(['GLOBAL', 'TENANT', 'PROPERTY'], { message: 'Scope must be GLOBAL, TENANT, or PROPERTY' })
  @IsNotEmpty({ message: 'Scope is required' })
  scope: ScopeType;

  @ApiPropertyOptional({
    description: 'Reference ID for scope (tenant ID or property ID). Required for TENANT/PROPERTY scopes.',
    example: 'uuid',
  })
  @IsUUID('4', { message: 'Invalid scope reference ID format' })
  @IsOptional()
  scopeRefId?: string;

  @ApiPropertyOptional({
    description: 'Optional expiry date for temporary role assignment',
    example: '2025-12-31T23:59:59Z',
  })
  @IsDateString({}, { message: 'Invalid date format' })
  @IsOptional()
  expiresAt?: string;
}

/**
 * @deprecated Use AssignRoleDto with identityId instead
 */
export class AssignRoleLegacyDto {
  @ApiProperty({ description: 'User ID to assign the role to', example: 'uuid' })
  @IsUUID('4', { message: 'Invalid user ID format' })
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  @ApiProperty({ description: 'Role ID to assign', example: 'uuid' })
  @IsUUID('4', { message: 'Invalid role ID format' })
  @IsNotEmpty({ message: 'Role ID is required' })
  roleId: string;

  @ApiPropertyOptional({
    description: 'Optional expiry date for temporary role assignment',
    example: '2025-12-31T23:59:59Z',
  })
  @IsDateString({}, { message: 'Invalid date format' })
  @IsOptional()
  expiresAt?: string;
}

export class RevokeRoleDto {
  @ApiProperty({ description: 'Identity ID to revoke the role from', example: 'uuid' })
  @IsUUID('4', { message: 'Invalid identity ID format' })
  @IsNotEmpty({ message: 'Identity ID is required' })
  identityId: string;

  @ApiProperty({ description: 'Role ID to revoke', example: 'uuid' })
  @IsUUID('4', { message: 'Invalid role ID format' })
  @IsNotEmpty({ message: 'Role ID is required' })
  roleId: string;

  @ApiProperty({
    description: 'Scope of the role to revoke',
    enum: ['GLOBAL', 'TENANT', 'PROPERTY'],
    example: 'GLOBAL',
  })
  @IsEnum(['GLOBAL', 'TENANT', 'PROPERTY'], { message: 'Scope must be GLOBAL, TENANT, or PROPERTY' })
  @IsNotEmpty({ message: 'Scope is required' })
  scope: ScopeType;

  @ApiPropertyOptional({
    description: 'Reference ID for scope (tenant ID or property ID)',
    example: 'uuid',
  })
  @IsUUID('4', { message: 'Invalid scope reference ID format' })
  @IsOptional()
  scopeRefId?: string;
}

/**
 * @deprecated Use RevokeRoleDto instead
 */
export class RemoveRoleDto {
  @ApiProperty({ description: 'User ID to remove the role from', example: 'uuid' })
  @IsUUID('4', { message: 'Invalid user ID format' })
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  @ApiProperty({ description: 'Role ID to remove', example: 'uuid' })
  @IsUUID('4', { message: 'Invalid role ID format' })
  @IsNotEmpty({ message: 'Role ID is required' })
  roleId: string;
}
