import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountsRepository } from './accounts.repository';

/**
 * Accounts Module
 *
 * Handles:
 * - Bank account management
 * - Balance inquiries
 * - Account statements
 * - Account preferences
 *
 * MICROSERVICE NOTE:
 * Uses repository pattern for data access.
 * Can be extracted as standalone Account Service.
 */
@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AccountsRepository],
  exports: [AccountsService],
})
export class AccountsModule {}
