import { IsString, IsEnum, IsOptional, IsUUID, MinLength, MaxLength } from 'class-validator';

export class CreateTenantDto {
  @IsEnum(['BUSINESS_BANKING', 'SUBSCRIPTION_WORKSPACE', 'PARTNER'])
  tenantType: 'BUSINESS_BANKING' | 'SUBSCRIPTION_WORKSPACE' | 'PARTNER';

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  legalName: string;

  @IsOptional()
  @IsUUID()
  ownerIdentityId?: string;
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  legalName?: string;

  @IsOptional()
  @IsUUID()
  ownerIdentityId?: string;

  @IsOptional()
  @IsEnum(['ACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'SUSPENDED';
}
