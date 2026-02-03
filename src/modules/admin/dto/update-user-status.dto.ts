import { IsIn, IsString } from 'class-validator';

export class UpdateUserStatusDto {
  @IsString()
  @IsIn(['active', 'suspended', 'closed'])
  status: string;
}
