import { Global, Module } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { PermissionsRepository } from './permissions.repository';

/**
 * Permissions Module
 *
 * Global module for Role-Based Access Control (RBAC)
 * Provides role and permission management across the application
 */
@Global()
@Module({
  controllers: [PermissionsController],
  providers: [
    PermissionsService,
    PermissionsRepository,
    // Provide as PERMISSIONS_SERVICE for the PermissionsGuard
    {
      provide: 'PERMISSIONS_SERVICE',
      useExisting: PermissionsService,
    },
  ],
  exports: [PermissionsService, 'PERMISSIONS_SERVICE'],
})
export class PermissionsModule {}
