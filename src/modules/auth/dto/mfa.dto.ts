import { IsString, IsIn, Length, Matches, IsOptional } from 'class-validator';

/**
 * Enable MFA - choose delivery method
 */
export class EnableMfaDto {
  @IsString()
  @IsIn(['email', 'sms', 'totp'])
  method: 'email' | 'sms' | 'totp';
}

/**
 * Verify MFA setup - confirm OTP to activate MFA
 */
export class VerifyMfaSetupDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code must be a 6-digit number' })
  code: string;

  @IsOptional()
  @IsString()
  @IsIn(['email', 'sms', 'totp'])
  method?: 'email' | 'sms' | 'totp';
}

/**
 * Disable MFA - requires login PIN for security
 */
export class DisableMfaDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'PIN must be a 6-digit number' })
  pin: string;
}

/**
 * Verify MFA during login - submit OTP with temporary mfaToken
 */
export class VerifyMfaLoginDto {
  @IsString()
  mfaToken: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Code must be a 6-digit number' })
  code: string;

  @IsOptional()
  @IsString()
  @IsIn(['totp', 'email', 'sms'])
  method?: 'totp' | 'email' | 'sms';
}

/**
 * Request email OTP fallback during MFA login
 */
export class RequestMfaEmailFallbackDto {
  @IsString()
  mfaToken: string;
}
