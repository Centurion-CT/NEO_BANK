import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, count, and, gte, lte, or, ilike, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import { auditLogs, AuditLog, NewAuditLog } from '@database/schemas';

@Injectable()
export class AuditRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create a new audit log entry
   */
  async create(data: NewAuditLog): Promise<AuditLog> {
    const [log] = await this.db.insert(auditLogs).values(data).returning();
    return log;
  }

  /**
   * Find all audit logs with pagination
   */
  async findAll(limit: number, offset: number): Promise<AuditLog[]> {
    return this.db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Find audit logs with filters
   */
  async findFiltered(options: {
    limit: number;
    offset: number;
    action?: string;
    status?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AuditLog[]> {
    const conditions = [];

    if (options.action) {
      conditions.push(eq(auditLogs.action, options.action as any));
    }
    if (options.status) {
      conditions.push(eq(auditLogs.status, options.status));
    }
    if (options.userId) {
      conditions.push(eq(auditLogs.userId, options.userId));
    }
    if (options.startDate) {
      conditions.push(gte(auditLogs.createdAt, options.startDate));
    }
    if (options.endDate) {
      conditions.push(lte(auditLogs.createdAt, options.endDate));
    }

    const query = this.db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(options.limit)
      .offset(options.offset);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }

    return query;
  }

  /**
   * Count all audit logs
   */
  async countAll(): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(auditLogs);
    return result?.count ?? 0;
  }

  /**
   * Count with filters
   */
  async countFiltered(options: {
    action?: string;
    status?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<number> {
    const conditions = [];

    if (options.action) {
      conditions.push(eq(auditLogs.action, options.action as any));
    }
    if (options.status) {
      conditions.push(eq(auditLogs.status, options.status));
    }
    if (options.userId) {
      conditions.push(eq(auditLogs.userId, options.userId));
    }
    if (options.startDate) {
      conditions.push(gte(auditLogs.createdAt, options.startDate));
    }
    if (options.endDate) {
      conditions.push(lte(auditLogs.createdAt, options.endDate));
    }

    const query = this.db.select({ count: count() }).from(auditLogs);

    if (conditions.length > 0) {
      const [result] = await query.where(and(...conditions));
      return result?.count ?? 0;
    }

    const [result] = await query;
    return result?.count ?? 0;
  }

  /**
   * Count by status
   */
  async countByStatus(status: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(auditLogs)
      .where(eq(auditLogs.status, status));
    return result?.count ?? 0;
  }

  /**
   * Count security events (login failures, session revokes, etc.)
   */
  async countSecurityEvents(): Promise<number> {
    const securityActions = [
      'login_failure',
      'session_revoke',
      'device_revoke',
      'password_change',
      'pin_change',
      'mfa_enroll',
      'mfa_verify',
    ];
    const [result] = await this.db
      .select({ count: count() })
      .from(auditLogs)
      .where(
        or(...securityActions.map((a) => eq(auditLogs.action, a as any))),
      );
    return result?.count ?? 0;
  }

  /**
   * Find by ID
   */
  async findById(id: string): Promise<AuditLog | null> {
    const [log] = await this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, id))
      .limit(1);
    return log || null;
  }
}
