import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsEnum, IsOptional, IsBoolean } from 'class-validator';

export class SubscribeDto {
  @ApiProperty({ description: 'Plan ID to subscribe to', example: 'uuid' })
  @IsUUID('4', { message: 'Invalid plan ID format' })
  @IsNotEmpty({ message: 'Plan ID is required' })
  planId: string;

  @ApiProperty({
    description: 'Billing cycle',
    enum: ['monthly', 'yearly'],
    example: 'monthly',
  })
  @IsEnum(['monthly', 'yearly'], { message: 'Invalid billing cycle' })
  @IsNotEmpty({ message: 'Billing cycle is required' })
  billingCycle: 'monthly' | 'yearly';

  @ApiPropertyOptional({ description: 'Enable auto-renewal', default: true })
  @IsBoolean()
  @IsOptional()
  autoRenewal?: boolean;
}
