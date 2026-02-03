import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { IdentityModule } from '@modules/identity/identity.module';
import { PermissionsModule } from '@modules/permissions/permissions.module';
import { KycModule } from '@modules/kyc/kyc.module';
import { SupportModule } from '@modules/support/support.module';
import { SessionsModule } from '@modules/sessions/sessions.module';
import { AuditModule } from '@modules/audit/audit.module';

@Module({
  imports: [
    IdentityModule,
    PermissionsModule,
    KycModule,
    SupportModule,
    SessionsModule,
    AuditModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
