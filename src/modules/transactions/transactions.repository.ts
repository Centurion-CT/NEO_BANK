import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, and, or, gte, lte, sql, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import { Transaction, NewTransaction, transactions } from '@database/schemas';

export interface TransactionFilters {
  accountId?: string;
  type?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Transactions Repository
 *
 * Data access layer for transactions table.
 * Follows Repository Pattern for clean separation.
 *
 * IMPORTANT: Transactions are immutable.
 * Never update transaction records, only status changes allowed.
 */
@Injectable()
export class TransactionsRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new transaction
   * CRITICAL: Should be called within a database transaction
   */
  async create(data: Omit<NewTransaction, 'id' | 'createdAt'>): Promise<Transaction> {
    const [transaction] = await this.db
      .insert(transactions)
      .values(data)
      .returning();
    return transaction;
  }

  /**
   * Find transaction by ID
   */
  async findById(id: string): Promise<Transaction | null> {
    const [transaction] = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);
    return transaction || null;
  }

  /**
   * Find transaction by reference
   */
  async findByReference(reference: string): Promise<Transaction | null> {
    const [transaction] = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.reference, reference))
      .limit(1);
    return transaction || null;
  }

  /**
   * Find transactions for an account with filters
   */
  async findByAccountId(
    accountId: string,
    filters: TransactionFilters = {},
  ): Promise<Transaction[]> {
    const conditions: SQL[] = [
      or(
        eq(transactions.sourceAccountId, accountId),
        eq(transactions.destinationAccountId, accountId),
      )!,
    ];

    if (filters.type) {
      conditions.push(eq(transactions.type, filters.type));
    }

    if (filters.status) {
      conditions.push(eq(transactions.status, filters.status));
    }

    if (filters.startDate) {
      conditions.push(gte(transactions.createdAt, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(transactions.createdAt, filters.endDate));
    }

    return this.db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
  }

  /**
   * Find transactions for an identity (all accounts)
   */
  async findByIdentityId(
    identityId: string,
    filters: TransactionFilters = {},
  ): Promise<Transaction[]> {
    const conditions: SQL[] = [eq(transactions.identityId, identityId)];

    if (filters.accountId) {
      conditions.push(
        or(
          eq(transactions.sourceAccountId, filters.accountId),
          eq(transactions.destinationAccountId, filters.accountId),
        )!,
      );
    }

    if (filters.type) {
      conditions.push(eq(transactions.type, filters.type));
    }

    if (filters.status) {
      conditions.push(eq(transactions.status, filters.status));
    }

    if (filters.startDate) {
      conditions.push(gte(transactions.createdAt, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(transactions.createdAt, filters.endDate));
    }

    return this.db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
  }

  /**
   * Update transaction status
   * IMPORTANT: Only status updates allowed, transactions are immutable
   */
  async updateStatus(
    id: string,
    status: string,
    failureReason?: string,
  ): Promise<Transaction> {
    const updateData: Partial<Transaction> = { status };

    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    if (failureReason) {
      updateData.failureReason = failureReason;
    }

    const [transaction] = await this.db
      .update(transactions)
      .set(updateData)
      .where(eq(transactions.id, id))
      .returning();

    return transaction;
  }

  /**
   * Count transactions for reporting
   */
  async countByIdentityId(identityId: string, filters: TransactionFilters = {}): Promise<number> {
    const conditions: SQL[] = [eq(transactions.identityId, identityId)];

    if (filters.startDate) {
      conditions.push(gte(transactions.createdAt, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(transactions.createdAt, filters.endDate));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(and(...conditions));

    return Number(result[0]?.count || 0);
  }
}
