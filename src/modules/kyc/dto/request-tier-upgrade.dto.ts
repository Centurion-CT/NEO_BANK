import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsIn } from 'class-validator';

/**
 * Request Tier Upgrade DTO
 * Validates tier upgrade requests
 */
export class RequestTierUpgradeDto {
  @ApiProperty({
    description: 'Target tier to upgrade to',
    enum: ['verified', 'premium', 'business'],
    example: 'verified',
  })
  @IsString()
  @IsIn(['verified', 'premium', 'business'])
  targetTier: string;
}
