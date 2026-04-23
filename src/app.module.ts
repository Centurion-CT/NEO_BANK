import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from '@common/controllers/health.controller';

// Configuration
import { appConfig, databaseConfig, jwtConfig, redisConfig, mailConfig, qoreidConfig, bunnyConfig } from '@config/index';
import { configValidationSchema } from '@config/config.validation';

// Database
import { DatabaseModule } from '@database/database.module';

// Feature Modules
import { AuthModule } from '@modules/auth/auth.module';
import { IdentityModule } from '@modules/identity/identity.module';
import { AccountsModule } from '@modules/accounts/accounts.module';
import { TransactionsModule } from '@modules/transactions/transactions.module';
import { KycModule } from '@modules/kyc/kyc.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { MailModule } from '@modules/mail/mail.module';
import { QoreidModule } from '@modules/qoreid/qoreid.module';
import { OtpModule } from '@modules/otp/otp.module';
import { SessionsModule } from '@modules/sessions/sessions.module';
import { SupportModule } from '@modules/support/support.module';
import { AdminModule } from '@modules/admin/admin.module';
import { AuditModule } from '@modules/audit/audit.module';
import { PermissionsModule } from '@modules/permissions/permissions.module';
import { SubscriptionsModule } from '@modules/subscriptions/subscriptions.module';
import { AddonsModule } from '@modules/addons/addons.module';
import { BiometricModule } from '@modules/biometric/biometric.module';
import { DevicesModule } from '@modules/devices/devices.module';
import { TenantsModule } from '@modules/tenants/tenants.module';
import { PropertiesModule } from '@modules/properties/properties.module';

@Module({
  imports: [
    // Global Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, mailConfig, qoreidConfig, bunnyConfig],
      validationSchema: configValidationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 50,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Database
    DatabaseModule,

    // Global Service Modules
    MailModule,
    OtpModule,
    SessionsModule,
    QoreidModule,

    // Feature Modules (Microservice-ready)
    AuthModule,
    IdentityModule,
    AccountsModule,
    TransactionsModule,
    KycModule,
    NotificationsModule,
    SupportModule,
    AdminModule,
    AuditModule,
    PermissionsModule,
    SubscriptionsModule,
    AddonsModule,
    BiometricModule,
    DevicesModule,
    TenantsModule,
    PropertiesModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
