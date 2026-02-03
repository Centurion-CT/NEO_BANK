import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * Update Account DTO
 * Only allows updating user-controllable fields
 */
export class UpdateAccountDto {
  @ApiPropertyOptional({
    description: 'Account nickname',
    example: 'My Savings',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nickname?: string;
}
