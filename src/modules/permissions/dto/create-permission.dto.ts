import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength, Matches } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({
    description: 'Permission code (unique identifier)',
    example: 'users.read',
  })
  @IsString()
  @IsNotEmpty({ message: 'Permission code is required' })
  @MaxLength(100, { message: 'Permission code must be at most 100 characters' })
  @Matches(/^[a-z_]+\.[a-z_]+$/, {
    message: 'Permission code must be in format: category.action (e.g., users.read)',
  })
  code: string;

  @ApiProperty({ description: 'Permission name', example: 'Read Users' })
  @IsString()
  @IsNotEmpty({ message: 'Permission name is required' })
  @MaxLength(255, { message: 'Permission name must be at most 255 characters' })
  name: string;

  @ApiPropertyOptional({
    description: 'Permission description',
    example: 'Allows viewing user profiles and data',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description must be at most 500 characters' })
  description?: string;

  @ApiProperty({
    description: 'Permission category',
    enum: ['users', 'kyc', 'transactions', 'sessions', 'audit', 'settings', 'subscriptions', 'permissions'],
    example: 'users',
  })
  @IsEnum(['users', 'kyc', 'transactions', 'sessions', 'audit', 'settings', 'subscriptions', 'permissions'], {
    message: 'Invalid permission category',
  })
  @IsNotEmpty({ message: 'Permission category is required' })
  category: 'users' | 'kyc' | 'transactions' | 'sessions' | 'audit' | 'settings' | 'subscriptions' | 'permissions';
}
