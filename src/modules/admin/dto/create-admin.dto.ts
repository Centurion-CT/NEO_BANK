import {
  IsEmail,
  IsString,
  IsOptional,
  IsIn,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsIn(['pin', 'password'])
  @IsOptional()
  loginMode?: 'pin' | 'password';

  @ValidateIf((o) => o.loginMode === 'pin' || (!o.loginMode && !o.password))
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4-6 digits' })
  pin?: string;

  @ValidateIf((o) => o.loginMode === 'password' || (!o.loginMode && !o.pin))
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password?: string;
}
