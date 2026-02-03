import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class SubscribeAddonDto {
  @ApiProperty({ description: 'Plan ID to subscribe to', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty({ message: 'Plan ID is required' })
  planId: string;

  @ApiProperty({
    description: 'Billing cycle',
    enum: ['monthly', 'yearly'],
    example: 'monthly',
  })
  @IsEnum(['monthly', 'yearly'], { message: 'Billing cycle must be monthly or yearly' })
  @IsNotEmpty({ message: 'Billing cycle is required' })
  billingCycle: 'monthly' | 'yearly';

  @ApiPropertyOptional({ description: 'Enable auto-renewal', default: true })
  @IsBoolean()
  @IsOptional()
  autoRenewal?: boolean;
}

export class ChangeAddonPlanDto {
  @ApiProperty({ description: 'New plan ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty({ message: 'New plan ID is required' })
  newPlanId: string;

  @ApiPropertyOptional({
    description: 'New billing cycle',
    enum: ['monthly', 'yearly'],
  })
  @IsEnum(['monthly', 'yearly'], { message: 'Billing cycle must be monthly or yearly' })
  @IsOptional()
  billingCycle?: 'monthly' | 'yearly';
}

export class CancelAddonSubscriptionDto {
  @ApiPropertyOptional({ description: 'Cancellation reason' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class UpdateAddonSubscriptionStatusDto {
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
