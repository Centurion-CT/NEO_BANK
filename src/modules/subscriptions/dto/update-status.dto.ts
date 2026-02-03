import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSubscriptionStatusDto {
  @ApiProperty({
    description: 'New subscription status',
    enum: ['active', 'expired', 'cancelled', 'past_due', 'pending', 'trial'],
    example: 'active',
  })
  @IsEnum(['active', 'expired', 'cancelled', 'past_due', 'pending', 'trial'], {
    message: 'Invalid subscription status',
  })
  @IsNotEmpty({ message: 'Status is required' })
  status: 'active' | 'expired' | 'cancelled' | 'past_due' | 'pending' | 'trial';

  @ApiPropertyOptional({ description: 'Reason for status change' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
