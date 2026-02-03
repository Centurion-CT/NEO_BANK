import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, or, desc, sql, count, gte, lte, inArray } from 'drizzle-orm';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import {
  subscriptionPlans,
  userSubscriptions,
  subscriptionHistory,
  SubscriptionPlan,
  NewSubscriptionPlan,
  UserSubscription,
  NewUserSubscription,
  NewSubscriptionHistoryEntry,
} from '@database/schemas/subscriptions.schema';

@Injectable()
export class SubscriptionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  // =====================
  // PLANS
  // =====================

  async createPlan(data: Omit<NewSubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubscriptionPlan> {
    const [plan] = await this.db.insert(subscriptionPlans).values(data).returning();
    return plan;
  }

  async findPlanById(id: string): Promise<SubscriptionPlan | null> {
    const [plan] = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, id))
      .limit(1);
    return plan || null;
  }

  async findPlanByType(type: string): Promise<SubscriptionPlan | null> {
    const [plan] = await this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.type, type as any))
      .limit(1);
    return plan || null;
  }

  async findAllPlans(): Promise<SubscriptionPlan[]> {
    return this.db
      .select()
      .from(subscriptionPlans)
      .orderBy(subscriptionPlans.sortOrder);
  }

  async findActivePlans(): Promise<SubscriptionPlan[]> {
    return this.db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder);
  }

  async updatePlan(id: string, data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
    const [plan] = await this.db
      .update(subscriptionPlans)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return plan;
  }

  async deletePlan(id: string): Promise<void> {
    await this.db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
  }

  // =====================
  // USER SUBSCRIPTIONS
  // =====================

  async createSubscription(data: Omit<NewUserSubscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserSubscription> {
    const [subscription] = await this.db.insert(userSubscriptions).values(data).returning();
    return subscription;
  }

  async findSubscriptionById(id: string): Promise<UserSubscription | null> {
    const [subscription] = await this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.id, id))
      .limit(1);
    return subscription || null;
  }

  async findActiveSubscriptionByIdentityId(identityId: string): Promise<UserSubscription | null> {
    const [subscription] = await this.db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.identityId, identityId),
          or(
            eq(userSubscriptions.status, 'active'),
            eq(userSubscriptions.status, 'trial'),
          ),
        ),
      )
      .limit(1);
    return subscription || null;
  }

  async findSubscriptionsByIdentityId(identityId: string): Promise<UserSubscription[]> {
    return this.db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.identityId, identityId))
      .orderBy(desc(userSubscriptions.createdAt));
  }

  async updateSubscription(id: string, data: Partial<UserSubscription>): Promise<UserSubscription> {
    const [subscription] = await this.db
      .update(userSubscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSubscriptions.id, id))
      .returning();
    return subscription;
  }

  async findAllSubscriptions(
    options: {
      status?: string;
      planId?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ subscriptions: UserSubscription[]; total: number }> {
    const { status, planId, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) {
      conditions.push(eq(userSubscriptions.status, status as any));
    }
    if (planId) {
      conditions.push(eq(userSubscriptions.planId, planId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [subscriptionsResult, countResult] = await Promise.all([
      this.db
        .select()
        .from(userSubscriptions)
        .where(whereClause)
        .orderBy(desc(userSubscriptions.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(userSubscriptions)
        .where(whereClause),
    ]);

    return {
      subscriptions: subscriptionsResult,
      total: countResult[0]?.count || 0,
    };
  }

  async findExpiringSubscriptions(withinDays: number): Promise<UserSubscription[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + withinDays);

    return this.db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.status, 'active'),
          lte(userSubscriptions.endDate, futureDate),
          gte(userSubscriptions.endDate, new Date()),
        ),
      );
  }

  async findExpiredSubscriptions(): Promise<UserSubscription[]> {
    return this.db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          or(
            eq(userSubscriptions.status, 'active'),
            eq(userSubscriptions.status, 'trial'),
          ),
          lte(userSubscriptions.endDate, new Date()),
        ),
      );
  }

  // =====================
  // SUBSCRIPTION HISTORY
  // =====================

  async createHistoryEntry(data: Omit<NewSubscriptionHistoryEntry, 'id' | 'createdAt'>): Promise<void> {
    await this.db.insert(subscriptionHistory).values(data);
  }

  async findSubscriptionHistory(
    identityId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ history: any[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const [historyResult, countResult] = await Promise.all([
      this.db
        .select()
        .from(subscriptionHistory)
        .where(eq(subscriptionHistory.identityId, identityId))
        .orderBy(desc(subscriptionHistory.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(subscriptionHistory)
        .where(eq(subscriptionHistory.identityId, identityId)),
    ]);

    return {
      history: historyResult,
      total: countResult[0]?.count || 0,
    };
  }

  // =====================
  // STATISTICS
  // =====================

  async getSubscriptionStats(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    trialSubscriptions: number;
    cancelledSubscriptions: number;
    expiredSubscriptions: number;
    subscriptionsByPlan: { planId: string; planName: string; count: number }[];
    revenueThisMonth: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get counts by status
    const statusCounts = await this.db
      .select({
        status: userSubscriptions.status,
        count: count(),
      })
      .from(userSubscriptions)
      .groupBy(userSubscriptions.status);

    const statusMap: Record<string, number> = {};
    for (const { status, count: c } of statusCounts) {
      statusMap[status] = c;
    }

    // Get subscriptions by plan
    const planCounts = await this.db
      .select({
        planId: userSubscriptions.planId,
        planName: subscriptionPlans.name,
        count: count(),
      })
      .from(userSubscriptions)
      .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .where(
        or(
          eq(userSubscriptions.status, 'active'),
          eq(userSubscriptions.status, 'trial'),
        ),
      )
      .groupBy(userSubscriptions.planId, subscriptionPlans.name);

    // Calculate revenue this month (new subscriptions and renewals)
    const revenueResult = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${userSubscriptions.priceAtSubscription}), 0)`,
      })
      .from(userSubscriptions)
      .where(
        and(
          gte(userSubscriptions.startDate, startOfMonth),
          or(
            eq(userSubscriptions.status, 'active'),
            eq(userSubscriptions.status, 'trial'),
          ),
        ),
      );

    const totalSubscriptions = Object.values(statusMap).reduce((a, b) => a + b, 0);

    return {
      totalSubscriptions,
      activeSubscriptions: statusMap['active'] || 0,
      trialSubscriptions: statusMap['trial'] || 0,
      cancelledSubscriptions: statusMap['cancelled'] || 0,
      expiredSubscriptions: statusMap['expired'] || 0,
      subscriptionsByPlan: planCounts,
      revenueThisMonth: Number(revenueResult[0]?.total) || 0,
    };
  }
}
