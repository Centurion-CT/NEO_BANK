import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
  IsObject,
} from 'class-validator';

export class CreatePropertyDto {
  @IsEnum(['PHYSICAL', 'VIRTUAL'])
  propertyType: 'PHYSICAL' | 'VIRTUAL';

  @IsEnum([
    'BRANCH',
    'AGENT_LOCATION',
    'OUTLET',
    'MOBILE_APP',
    'WEB_APP',
    'USSD_CHANNEL',
    'PARTNER_CHANNEL',
    'INTERNAL_SYSTEM',
  ])
  propertySubtype:
    | 'BRANCH'
    | 'AGENT_LOCATION'
    | 'OUTLET'
    | 'MOBILE_APP'
    | 'WEB_APP'
    | 'USSD_CHANNEL'
    | 'PARTNER_CHANNEL'
    | 'INTERNAL_SYSTEM';

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'Property code must be uppercase alphanumeric with underscores only',
  })
  propertyCode: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsBoolean()
  isAssignable?: boolean;

  @IsOptional()
  @IsBoolean()
  allowsAgentAccess?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdatePropertyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

  @IsOptional()
  @IsBoolean()
  isAssignable?: boolean;

  @IsOptional()
  @IsBoolean()
  allowsAgentAccess?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
