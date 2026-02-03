import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Reason for cancellation',
    example: 'Switching to a different service',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Reason must be at most 500 characters' })
  reason?: string;
}
