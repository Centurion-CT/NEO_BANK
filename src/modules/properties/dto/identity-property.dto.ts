import { IsString, IsEnum, IsUUID } from 'class-validator';

export class AssignPropertyToIdentityDto {
  @IsUUID()
  identityId: string;

  @IsUUID()
  propertyId: string;

  @IsEnum(['ONBOARDED_AT', 'PRIMARY_PROPERTY', 'SERVICED_BY'])
  relationshipType: 'ONBOARDED_AT' | 'PRIMARY_PROPERTY' | 'SERVICED_BY';
}

export class RemovePropertyFromIdentityDto {
  @IsUUID()
  identityId: string;

  @IsUUID()
  propertyId: string;
}
