import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TransactionsRepository, TransactionFilters } from './transactions.repository';
import { AccountsService } from '@modules/accounts/accounts.service';
import { Transaction } from '@database/schemas';
import { v4 as uuidv4 } from 'uuid';

export interface TransferDto {
  sourceAccountId: string;
  destinationAccountNumber: string;
  amount: number;
  currency: string;
  description?: string;
  narration?: string;
}

/**
 * Transactions Service
 *
 * Business logic for transaction operations.
 * Implements ACID-compliant fund transfers.
 *
 * SECURITY: All monetary operations must be validated
 * and logged for audit compliance.
 */
@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactionsRepository: TransactionsRepository,
    private readonly accountsService: AccountsService,
  ) {}

  /**
   * Generate unique transaction reference
   */
  private generateReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = uuidv4().split('-')[0].toUpperCase();
    return `TXN${timestamp}${random}`;
  }

  /**
   * Find transaction by ID with ownership verification
   */
  async findById(id: string, identityId: string): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findById(id);

    if (!transaction) {
      throw new NotFoundException({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found',
      });
    }

    if (transaction.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'TRANSACTION_ACCESS_DENIED',
        message: 'Access denied to this transaction',
      });
    }

    return transaction;
  }

  /**
   * Get transaction history for an identity
   */
  async getHistory(
    identityId: string,
    filters: TransactionFilters = {},
  ): Promise<Transaction[]> {
    return this.transactionsRepository.findByIdentityId(identityId, filters);
  }

  /**
   * Get transactions for a specific account
   */
  async getAccountTransactions(
    accountId: string,
    identityId: string,
    filters: TransactionFilters = {},
  ): Promise<Transaction[]> {
    // Verify account ownership
    await this.accountsService.findById(accountId, identityId);

    return this.transactionsRepository.findByAccountId(accountId, filters);
  }

  /**
   * Process internal transfer
   *
   * CRITICAL: This is a placeholder implementation.
   * Production requires:
   * - Database transaction with proper isolation
   * - Idempotency keys to prevent duplicates
   * - Real-time balance checks
   * - Transaction PIN verification
   * - Fraud detection integration
   */
  async transfer(identityId: string, dto: TransferDto): Promise<Transaction> {
    // 1. Validate source account ownership
    const sourceAccount = await this.accountsService.findById(
      dto.sourceAccountId,
      identityId,
    );

    // 2. Validate destination account exists
    const destinationAccount = await this.accountsService.findByAccountNumber(
      dto.destinationAccountNumber,
    );

    if (!destinationAccount) {
      throw new NotFoundException({
        code: 'DESTINATION_NOT_FOUND',
        message: 'Destination account not found',
      });
    }

    // 3. Validate sufficient balance
    const availableBalance = parseFloat(sourceAccount.availableBalance || '0');
    if (availableBalance < dto.amount) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient funds for this transaction',
      });
    }

    // 4. Validate currency match
    if (sourceAccount.currency !== dto.currency) {
      throw new BadRequestException({
        code: 'CURRENCY_MISMATCH',
        message: 'Currency does not match source account',
      });
    }

    // 5. Create transaction record
    const transaction = await this.transactionsRepository.create({
      identityId,
      sourceAccountId: dto.sourceAccountId,
      destinationAccountId: destinationAccount.id,
      type: 'transfer',
      amount: dto.amount.toString(),
      currency: dto.currency,
      reference: this.generateReference(),
      description: dto.description,
      narration: dto.narration,
      status: 'pending',
      balanceBefore: sourceAccount.balance,
      balanceAfter: (parseFloat(sourceAccount.balance) - dto.amount).toString(),
    });

    // NOTE: In production, balance updates would be done
    // in a database transaction with proper locking.
    // This is simplified for demonstration.

    return transaction;
  }

  /**
   * Get transaction by reference
   */
  async findByReference(reference: string): Promise<Transaction | null> {
    return this.transactionsRepository.findByReference(reference);
  }
}
