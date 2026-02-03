import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionsRepository } from './transactions.repository';
import { AccountsModule } from '@modules/accounts/accounts.module';

/**
 * Transactions Module
 *
 * Handles:
 * - Fund transfers
 * - Transaction history
 * - Transaction receipts
 * - Payment processing
 *
 * MICROSERVICE NOTE:
 * Uses repository pattern for data access.
 * Can be extracted as standalone Payment Service.
 * Depends on AccountsModule for balance operations.
 */
@Module({
  imports: [AccountsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, TransactionsRepository],
  exports: [TransactionsService],
})
export class TransactionsModule {}
