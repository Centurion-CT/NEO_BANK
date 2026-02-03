import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, or, desc, sql, count, gte, lte } from 'drizzle-orm';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import {
  addons,
  addonPlans,
  userAddonSubscriptions,
  addonSubscriptionHistory,
  Addon,
  NewAddon,
  AddonPlan,
  NewAddonPlan,
  UserAddonSubscription,
  NewUserAddonSubscription,
  NewAddonSubscriptionHistoryEntry,
} from '@database/schemas/addons.schema';

@Injectable()
export class AddonsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  // =====================
  // ADDONS
  // =====================

  async createAddon(data: Omit<NewAddon, 'id' | 'createdAt' | 'updatedAt'>): Promise<Addon> {
    const [addon] = await this.db.insert(addons).values(data).returning();
    return addon;
  }

  async findAddonById(id: string): Promise<Addon | null> {
    const [addon] = await this.db
      .select()
      .from(addons)
      .where(eq(addons.id, id))
      .limit(1);
    return addon || null;
  }

  async findAddonBySlug(slug: string): Promise<Addon | null> {
    const [addon] = await this.db
      .select()
      .from(addons)
      .where(eq(addons.slug, slug))
      .limit(1);
    return addon || null;
  }

  async findAllAddons(): Promise<Addon[]> {
    return this.db
      .select()
      .from(addons)
      .orderBy(addons.sortOrder);
  }

  async findActiveAddons(): Promise<Addon[]> {
    return this.db
      .select()
      .from(addons)
      .where(eq(addons.isActive, true))
      .orderBy(addons.sortOrder);
  }

  async updateAddon(id: string, data: Partial<Addon>): Promise<Addon> {
    const [addon] = await this.db
      .update(addons)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(addons.id, id))
      .returning();
    return addon;
  }

  async deleteAddon(id: string): Promise<void> {
    await this.db.delete(addons).where(eq(addons.id, id));
  }

  // =====================
  // ADDON PLANS
  // =====================

  async createAddonPlan(data: Omit<NewAddonPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<AddonPlan> {
    const [plan] = await this.db.insert(addonPlans).values(data).returning();
    return plan;
  }

  async findAddonPlanById(id: string): Promise<AddonPlan | null> {
    const [plan] = await this.db
      .select()
      .from(addonPlans)
      .where(eq(addonPlans.id, id))
      .limit(1);
    return plan || null;
  }

  async findAddonPlansByAddonId(addonId: string): Promise<AddonPlan[]> {
    return this.db
      .select()
      .from(addonPlans)
      .where(eq(addonPlans.addonId, addonId))
      .orderBy(addonPlans.sortOrder);
  }

  async findActiveAddonPlansByAddonId(addonId: string): Promise<AddonPlan[]> {
    return this.db
      .select()
      .from(addonPlans)
      .where(and(eq(addonPlans.addonId, addonId), eq(addonPlans.isActive, true)))
      .orderBy(addonPlans.sortOrder);
  }

  async findAllAddonPlans(): Promise<AddonPlan[]> {
    return this.db
      .select()
      .from(addonPlans)
      .orderBy(addonPlans.sortOrder);
  }

  async updateAddonPlan(id: string, data: Partial<AddonPlan>): Promise<AddonPlan> {
    const [plan] = await this.db
      .update(addonPlans)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(addonPlans.id, id))
      .returning();
    return plan;
  }

  async deleteAddonPlan(id: string): Promise<void> {
    await this.db.delete(addonPlans).where(eq(addonPlans.id, id));
  }

  // =====================
  // USER ADDON SUBSCRIPTIONS
  // =====================

  async createAddonSubscription(
    data: Omit<NewUserAddonSubscription, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UserAddonSubscription> {
    const [subscription] = await this.db.insert(userAddonSubscriptions).values(data).returning();
    return subscription;
  }

  async findAddonSubscriptionById(id: string): Promise<UserAddonSubscription | null> {
    const [subscription] = await this.db
      .select()
      .from(userAddonSubscriptions)
      .where(eq(userAddonSubscriptions.id, id))
      .limit(1);
    return subscription || null;
  }

  async findActiveAddonSubscription(
    identityId: string,
    addonId: string,
  ): Promise<UserAddonSubscription | null> {
    const [subscription] = await this.db
      .select()
      .from(userAddonSubscriptions)
      .where(
        and(
          eq(userAddonSubscriptions.identityId, identityId),
          eq(userAddonSubscriptions.addonId, addonId),
          or(
            eq(userAddonSubscriptions.status, 'active'),
            eq(userAddonSubscriptions.status, 'trial'),
          ),
        ),
      )
      .limit(1);
    return subscription || null;
  }

  async findAddonSubscriptionsByIdentityId(identityId: string): Promise<UserAddonSubscription[]> {
    return this.db
      .select()
      .from(userAddonSubscriptions)
      .where(eq(userAddonSubscriptions.identityId, identityId))
      .orderBy(desc(userAddonSubscriptions.createdAt));
  }

  async findActiveAddonSubscriptionsByIdentityId(identityId: string): Promise<UserAddonSubscription[]> {
    return this.db
      .select()
      .from(userAddonSubscriptions)
      .where(
        and(
          eq(userAddonSubscriptions.identityId, identityId),
          or(
            eq(userAddonSubscriptions.status, 'active'),
            eq(userAddonSubscriptions.status, 'trial'),
          ),
        ),
      )
      .orderBy(desc(userAddonSubscriptions.createdAt));
  }

  async updateAddonSubscription(
    id: string,
    data: Partial<UserAddonSubscription>,
  ): Promise<UserAddonSubscription> {
    const [subscription] = await this.db
      .update(userAddonSubscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userAddonSubscriptions.id, id))
      .returning();
    return subscription;
  }

  async findAllAddonSubscriptions(
    options: {
      status?: string;
      addonId?: string;
      planId?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ subscriptions: UserAddonSubscription[]; total: number }> {
    const { status, addonId, planId, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) {
      conditions.push(eq(userAddonSubscriptions.status, status as any));
    }
    if (addonId) {
      conditions.push(eq(userAddonSubscriptions.addonId, addonId));
    }
    if (planId) {
      conditions.push(eq(userAddonSubscriptions.planId, planId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [subscriptionsResult, countResult] = await Promise.all([
      this.db
        .select()
        .from(userAddonSubscriptions)
        .where(whereClause)
        .orderBy(desc(userAddonSubscriptions.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(userAddonSubscriptions)
        .where(whereClause),
    ]);

    return {
      subscriptions: subscriptionsResult,
      total: countResult[0]?.count || 0,
    };
  }

  async findExpiringAddonSubscriptions(withinDays: number): Promise<UserAddonSubscription[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + withinDays);

    return this.db
      .select()
      .from(userAddonSubscriptions)
      .where(
        and(
          eq(userAddonSubscriptions.status, 'active'),
          lte(userAddonSubscriptions.endDate, futureDate),
          gte(userAddonSubscriptions.endDate, new Date()),
        ),
      );
  }

  async findExpiredAddonSubscriptions(): Promise<UserAddonSubscription[]> {
    return this.db
      .select()
      .from(userAddonSubscriptions)
      .where(
        and(
          or(
            eq(userAddonSubscriptions.status, 'active'),
            eq(userAddonSubscriptions.status, 'trial'),
          ),
          lte(userAddonSubscriptions.endDate, new Date()),
        ),
      );
  }

  // =====================
  // SUBSCRIPTION HISTORY
  // =====================

  async createAddonHistoryEntry(
    data: Omit<NewAddonSubscriptionHistoryEntry, 'id' | 'createdAt'>,
  ): Promise<void> {
    await this.db.insert(addonSubscriptionHistory).values(data);
  }

  async findAddonSubscriptionHistory(
    identityId: string,
    options: { addonId?: string; page?: number; limit?: number } = {},
  ): Promise<{ history: any[]; total: number }> {
    const { addonId, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const conditions = [eq(addonSubscriptionHistory.identityId, identityId)];
    if (addonId) {
      conditions.push(eq(addonSubscriptionHistory.addonId, addonId));
    }

    const whereClause = and(...conditions);

    const [historyResult, countResult] = await Promise.all([
      this.db
        .select()
        .from(addonSubscriptionHistory)
        .where(whereClause)
        .orderBy(desc(addonSubscriptionHistory.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(addonSubscriptionHistory)
        .where(whereClause),
    ]);

    return {
      history: historyResult,
      total: countResult[0]?.count || 0,
    };
  }

  // =====================
  // STATISTICS
  // =====================

  async getAddonStats(): Promise<{
    totalAddons: number;
    activeAddons: number;
    totalAddonSubscriptions: number;
    activeAddonSubscriptions: number;
    subscriptionsByAddon: { addonId: string; addonName: string; count: number }[];
    revenueThisMonth: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get addon counts
    const [totalAddonsResult, activeAddonsResult] = await Promise.all([
      this.db.select({ count: count() }).from(addons),
      this.db.select({ count: count() }).from(addons).where(eq(addons.isActive, true)),
    ]);

    // Get subscription status counts
    const statusCounts = await this.db
      .select({
        status: userAddonSubscriptions.status,
        count: count(),
      })
      .from(userAddonSubscriptions)
      .groupBy(userAddonSubscriptions.status);

    const statusMap: Record<string, number> = {};
    let totalAddonSubscriptions = 0;
    for (const { status, count: c } of statusCounts) {
      statusMap[status] = c;
      totalAddonSubscriptions += c;
    }

    // Get subscriptions by addon
    const addonCounts = await this.db
      .select({
        addonId: userAddonSubscriptions.addonId,
        addonName: addons.name,
        count: count(),
      })
      .from(userAddonSubscriptions)
      .innerJoin(addons, eq(userAddonSubscriptions.addonId, addons.id))
      .where(
        or(
          eq(userAddonSubscriptions.status, 'active'),
          eq(userAddonSubscriptions.status, 'trial'),
        ),
      )
      .groupBy(userAddonSubscriptions.addonId, addons.name);

    // Calculate revenue this month
    const revenueResult = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${userAddonSubscriptions.priceAtSubscription}), 0)`,
      })
      .from(userAddonSubscriptions)
      .where(
        and(
          gte(userAddonSubscriptions.startDate, startOfMonth),
          or(
            eq(userAddonSubscriptions.status, 'active'),
            eq(userAddonSubscriptions.status, 'trial'),
          ),
        ),
      );

    return {
      totalAddons: totalAddonsResult[0]?.count || 0,
      activeAddons: activeAddonsResult[0]?.count || 0,
      totalAddonSubscriptions,
      activeAddonSubscriptions: (statusMap['active'] || 0) + (statusMap['trial'] || 0),
      subscriptionsByAddon: addonCounts,
      revenueThisMonth: Number(revenueResult[0]?.total) || 0,
    };
  }
}
