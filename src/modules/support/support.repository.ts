import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, count } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import { supportRequests, SupportRequest, NewSupportRequest } from '@database/schemas';

/**
 * Support Repository
 *
 * Data access layer for support_requests table.
 */
@Injectable()
export class SupportRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new support request
   */
  async create(data: Omit<NewSupportRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<SupportRequest> {
    const [request] = await this.db
      .insert(supportRequests)
      .values(data)
      .returning();
    return request;
  }

  /**
   * Find support request by ID
   */
  async findById(id: string): Promise<SupportRequest | null> {
    const [request] = await this.db
      .select()
      .from(supportRequests)
      .where(eq(supportRequests.id, id))
      .limit(1);
    return request || null;
  }

  /**
   * Find support requests by identity ID with pagination
   */
  async findByIdentityId(identityId: string, limit: number, offset: number): Promise<SupportRequest[]> {
    return this.db
      .select()
      .from(supportRequests)
      .where(eq(supportRequests.identityId, identityId))
      .orderBy(desc(supportRequests.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Update a support request
   */
  async update(id: string, data: Partial<SupportRequest>): Promise<SupportRequest> {
    const [request] = await this.db
      .update(supportRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(supportRequests.id, id))
      .returning();
    return request;
  }

  /**
   * Count support requests by identity ID
   */
  async countByIdentityId(identityId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(supportRequests)
      .where(eq(supportRequests.identityId, identityId));
    return result?.count ?? 0;
  }

  /**
   * Find all support requests with pagination
   */
  async findAll(limit: number, offset: number): Promise<SupportRequest[]> {
    return this.db
      .select()
      .from(supportRequests)
      .orderBy(desc(supportRequests.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Count support requests by status
   */
  async countByStatus(status: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(supportRequests)
      .where(eq(supportRequests.status, status));
    return result?.count ?? 0;
  }
}
