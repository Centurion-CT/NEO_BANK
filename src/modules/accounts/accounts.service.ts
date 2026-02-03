import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AccountsRepository } from './accounts.repository';
import { Account, NewAccount } from '@database/schemas';

/**
 * Accounts Service
 *
 * Business logic for account operations.
 * Follows Single Responsibility Principle.
 */
@Injectable()
export class AccountsService {
  constructor(private readonly accountsRepository: AccountsRepository) {}

  /**
   * Create a new account
   */
  async create(data: Omit<NewAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<Account> {
    return this.accountsRepository.create(data);
  }

  /**
   * Find account by ID with ownership verification
   */
  async findById(id: string, identityId: string): Promise<Account> {
    const account = await this.accountsRepository.findById(id);

    if (!account) {
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account not found',
      });
    }

    if (account.identityId !== identityId) {
      throw new ForbiddenException({
        code: 'ACCOUNT_ACCESS_DENIED',
        message: 'Access denied to this account',
      });
    }

    return account;
  }

  /**
   * Find account by account number
   */
  async findByAccountNumber(accountNumber: string): Promise<Account | null> {
    return this.accountsRepository.findByAccountNumber(accountNumber);
  }

  /**
   * Get all accounts for an identity
   */
  async findByIdentityId(identityId: string): Promise<Account[]> {
    return this.accountsRepository.findByIdentityId(identityId);
  }

  /**
   * Get primary account for an identity
   */
  async findPrimaryAccount(identityId: string): Promise<Account | null> {
    return this.accountsRepository.findPrimaryByIdentityId(identityId);
  }

  /**
   * Update account preferences
   */
  async update(id: string, identityId: string, data: Partial<Account>): Promise<Account> {
    // Verify ownership first
    await this.findById(id, identityId);

    // Prevent updating sensitive fields
    const { balance, accountNumber, identityId: _, ...safeData } = data;

    return this.accountsRepository.update(id, safeData);
  }

  /**
   * Set account as primary
   */
  async setPrimary(id: string, identityId: string): Promise<Account> {
    // Verify ownership
    await this.findById(id, identityId);

    // Get all identity accounts and unset primary
    const identityAccounts = await this.findByIdentityId(identityId);
    for (const account of identityAccounts) {
      if (account.isPrimary) {
        await this.accountsRepository.update(account.id, { isPrimary: false });
      }
    }

    // Set new primary
    return this.accountsRepository.update(id, { isPrimary: true });
  }
}
