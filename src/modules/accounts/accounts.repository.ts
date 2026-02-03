import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import { Account, NewAccount, accounts } from '@database/schemas';

/**
 * Accounts Repository
 *
 * Data access layer for accounts table.
 * Follows Repository Pattern for clean separation.
 */
@Injectable()
export class AccountsRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new account
   */
  async create(data: Omit<NewAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<Account> {
    const [account] = await this.db
      .insert(accounts)
      .values(data)
      .returning();
    return account;
  }

  /**
   * Find account by ID
   */
  async findById(id: string): Promise<Account | null> {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id))
      .limit(1);
    return account || null;
  }

  /**
   * Find account by account number
   */
  async findByAccountNumber(accountNumber: string): Promise<Account | null> {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.accountNumber, accountNumber))
      .limit(1);
    return account || null;
  }

  /**
   * Find account by external core banking accountId
   */
  async findByAccountId(accountId: string): Promise<Account | null> {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.accountId, accountId))
      .limit(1);
    return account || null;
  }

  /**
   * Find all accounts for an identity
   */
  async findByIdentityId(identityId: string): Promise<Account[]> {
    return this.db
      .select()
      .from(accounts)
      .where(eq(accounts.identityId, identityId));
  }

  /**
   * Find primary account for an identity
   */
  async findPrimaryByIdentityId(identityId: string): Promise<Account | null> {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.identityId, identityId),
          eq(accounts.isPrimary, true),
        ),
      )
      .limit(1);
    return account || null;
  }

  /**
   * Update account
   */
  async update(id: string, data: Partial<Account>): Promise<Account> {
    const [account] = await this.db
      .update(accounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accounts.id, id))
      .returning();
    return account;
  }

  /**
   * Update account balance
   * CRITICAL: This should be called within a transaction
   */
  async updateBalance(id: string, newBalance: string): Promise<Account> {
    const [account] = await this.db
      .update(accounts)
      .set({
        balance: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, id))
      .returning();
    return account;
  }
}
