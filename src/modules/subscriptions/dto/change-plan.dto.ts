import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class ChangePlanDto {
  @ApiProperty({ description: 'New plan ID to switch to', example: 'uuid' })
  @IsUUID('4', { message: 'Invalid plan ID format' })
  @IsNotEmpty({ message: 'Plan ID is required' })
  newPlanId: string;

  @ApiPropertyOptional({
    description: 'New billing cycle (optional, defaults to current)',
    enum: ['monthly', 'yearly'],
  })
  @IsEnum(['monthly', 'yearly'], { message: 'Invalid billing cycle' })
  @IsOptional()
  billingCycle?: 'monthly' | 'yearly';
}
