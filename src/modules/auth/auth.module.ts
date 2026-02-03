import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { IdentityModule } from '@modules/identity/identity.module';
import { PermissionsModule } from '@modules/permissions/permissions.module';
import { TenantsModule } from '@modules/tenants/tenants.module';
import { PropertiesModule } from '@modules/properties/properties.module';

/**
 * Authentication Module
 *
 * Handles:
 * - User registration
 * - PIN-based login
 * - JWT token management
 * - Session management
 * - MFA
 *
 * Uses the new identity/authentication compliance model:
 * - Identities: Root identity object
 * - PersonProfiles: User profile data
 * - AuthPrincipals: Login identifiers (email, phone)
 * - AuthSecrets: Credentials (PIN, transaction PIN, TOTP)
 *
 * Registration assigns:
 * - USER role (GLOBAL scope) to all users
 * - BUSINESS_OWNER role (TENANT scope) to business users
 * - IdentityProperty (ONBOARDED_AT) based on registration channel
 *
 * MICROSERVICE NOTE:
 * This module can be extracted to a standalone authentication service.
 * It maintains minimal coupling with other modules via interfaces.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.accessSecret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.accessExpiration', '15m'),
        },
      }),
    }),
    IdentityModule,
    PermissionsModule,
    TenantsModule,
    PropertiesModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
