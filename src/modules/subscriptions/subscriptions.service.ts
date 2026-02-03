import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SubscriptionsRepository } from './subscriptions.repository';
import { SubscribeDto } from './dto/subscribe.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CreatePlanDto, UpdatePlanDto } from './dto/create-plan.dto';
import { UpdateSubscriptionStatusDto } from './dto/update-status.dto';
import { SubscriptionPlan, UserSubscription } from '@database/schemas/subscriptions.schema';

// Plan type ordering for upgrade/downgrade logic
const PLAN_TYPE_ORDER = ['basic', 'verified', 'premium', 'business'];

@Injectable()
export class SubscriptionsService {
  constructor(private readonly subscriptionsRepository: SubscriptionsRepository) {}

  // =====================
  // PLANS
  // =====================

  async createPlan(dto: CreatePlanDto): Promise<SubscriptionPlan> {
    // Check if plan type already exists
    const existingPlan = await this.subscriptionsRepository.findPlanByType(dto.type);
    if (existingPlan) {
      throw new ConflictException({
        code: 'PLAN_TYPE_EXISTS',
        message: `A plan with type "${dto.type}" already exists`,
      });
    }

    return this.subscriptionsRepository.createPlan({
      name: dto.name,
      type: dto.type,
      description: dto.description,
      monthlyPrice: String(dto.monthlyPrice),
      yearlyPrice: String(dto.yearlyPrice),
      currency: dto.currency || 'NGN',
      features: dto.features || [],
      dailyTransactionLimit: dto.dailyTransactionLimit ? String(dto.dailyTransactionLimit) : null,
      monthlyTransactionLimit: dto.monthlyTransactionLimit ? String(dto.monthlyTransactionLimit) : null,
      maxTransfersPerDay: dto.maxTransfersPerDay,
      maxAccountsAllowed: dto.maxAccountsAllowed || 1,
      isPopular: dto.isPopular || false,
      isActive: true,
      trialDays: dto.trialDays || 0,
      sortOrder: dto.sortOrder || 0,
    });
  }

  async updatePlan(id: string, dto: UpdatePlanDto): Promise<SubscriptionPlan> {
    const plan = await this.subscriptionsRepository.findPlanById(id);
    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Subscription plan not found',
      });
    }

    const updateData: Partial<SubscriptionPlan> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.monthlyPrice !== undefined) updateData.monthlyPrice = String(dto.monthlyPrice);
    if (dto.yearlyPrice !== undefined) updateData.yearlyPrice = String(dto.yearlyPrice);
    if (dto.features !== undefined) updateData.features = dto.features;
    if (dto.dailyTransactionLimit !== undefined) {
      updateData.dailyTransactionLimit = String(dto.dailyTransactionLimit);
    }
    if (dto.monthlyTransactionLimit !== undefined) {
      updateData.monthlyTransactionLimit = String(dto.monthlyTransactionLimit);
    }
    if (dto.maxTransfersPerDay !== undefined) updateData.maxTransfersPerDay = dto.maxTransfersPerDay;
    if (dto.maxAccountsAllowed !== undefined) updateData.maxAccountsAllowed = dto.maxAccountsAllowed;
    if (dto.isPopular !== undefined) updateData.isPopular = dto.isPopular;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.trialDays !== undefined) updateData.trialDays = dto.trialDays;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

    return this.subscriptionsRepository.updatePlan(id, updateData);
  }

  async deletePlan(id: string): Promise<void> {
    const plan = await this.subscriptionsRepository.findPlanById(id);
    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Subscription plan not found',
      });
    }

    // Don't allow deleting the basic plan
    if (plan.type === 'basic') {
      throw new ForbiddenException({
        code: 'CANNOT_DELETE_BASIC_PLAN',
        message: 'Cannot delete the basic plan',
      });
    }

    // Soft delete by deactivating
    await this.subscriptionsRepository.updatePlan(id, { isActive: false });
  }

  async findPlanById(id: string): Promise<SubscriptionPlan> {
    const plan = await this.subscriptionsRepository.findPlanById(id);
    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Subscription plan not found',
      });
    }
    return plan;
  }

  async findAllPlans(): Promise<SubscriptionPlan[]> {
    return this.subscriptionsRepository.findActivePlans();
  }

  async findAllPlansAdmin(): Promise<SubscriptionPlan[]> {
    return this.subscriptionsRepository.findAllPlans();
  }

  // =====================
  // IDENTITY SUBSCRIPTIONS
  // =====================

  async subscribe(identityId: string, dto: SubscribeDto): Promise<UserSubscription> {
    // Check if identity already has an active subscription
    const existingSubscription = await this.subscriptionsRepository.findActiveSubscriptionByIdentityId(identityId);
    if (existingSubscription) {
      throw new ConflictException({
        code: 'ALREADY_SUBSCRIBED',
        message: 'You already have an active subscription. Use change-plan to switch plans.',
      });
    }

    // Find the plan
    const plan = await this.subscriptionsRepository.findPlanById(dto.planId);
    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Subscription plan not found',
      });
    }

    if (!plan.isActive) {
      throw new BadRequestException({
        code: 'PLAN_INACTIVE',
        message: 'This plan is no longer available',
      });
    }

    // Calculate price and dates
    const price = dto.billingCycle === 'yearly'
      ? Number(plan.yearlyPrice)
      : Number(plan.monthlyPrice);

    const startDate = new Date();
    const endDate = new Date();
    if (dto.billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Handle trial period
    let status: 'active' | 'trial' = 'active';
    let trialEndDate: Date | null = null;
    if (plan.trialDays > 0 && price > 0) {
      status = 'trial';
      trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + plan.trialDays);
    }

    // Create subscription
    const subscription = await this.subscriptionsRepository.createSubscription({
      identityId,
      planId: dto.planId,
      status,
      billingCycle: dto.billingCycle,
      priceAtSubscription: String(price),
      currency: plan.currency,
      startDate,
      endDate,
      trialEndDate,
      autoRenewal: dto.autoRenewal ?? true,
    });

    // Record in history
    await this.subscriptionsRepository.createHistoryEntry({
      identityId,
      subscriptionId: subscription.id,
      action: 'subscribed',
      toPlanId: dto.planId,
      amount: String(price),
      currency: plan.currency,
    });

    return subscription;
  }

  async getIdentitySubscription(identityId: string): Promise<UserSubscription | null> {
    return this.subscriptionsRepository.findActiveSubscriptionByIdentityId(identityId);
  }

  async getIdentitySubscriptionWithPlan(identityId: string): Promise<{
    subscription: UserSubscription | null;
    plan: SubscriptionPlan | null;
  }> {
    const subscription = await this.subscriptionsRepository.findActiveSubscriptionByIdentityId(identityId);
    if (!subscription) {
      return { subscription: null, plan: null };
    }

    const plan = await this.subscriptionsRepository.findPlanById(subscription.planId);
    return { subscription, plan };
  }

  async changePlan(identityId: string, dto: ChangePlanDto): Promise<UserSubscription> {
    // Get current subscription
    const currentSubscription = await this.subscriptionsRepository.findActiveSubscriptionByIdentityId(identityId);
    if (!currentSubscription) {
      throw new NotFoundException({
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'You do not have an active subscription. Use subscribe to get started.',
      });
    }

    // Get the new plan
    const newPlan = await this.subscriptionsRepository.findPlanById(dto.newPlanId);
    if (!newPlan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Subscription plan not found',
      });
    }

    if (!newPlan.isActive) {
      throw new BadRequestException({
        code: 'PLAN_INACTIVE',
        message: 'This plan is no longer available',
      });
    }

    if (currentSubscription.planId === dto.newPlanId) {
      throw new BadRequestException({
        code: 'SAME_PLAN',
        message: 'You are already on this plan',
      });
    }

    // Get current plan for comparison
    const currentPlan = await this.subscriptionsRepository.findPlanById(currentSubscription.planId);

    // Determine if upgrade or downgrade
    const currentPlanIndex = PLAN_TYPE_ORDER.indexOf(currentPlan?.type || 'basic');
    const newPlanIndex = PLAN_TYPE_ORDER.indexOf(newPlan.type);
    const isUpgrade = newPlanIndex > currentPlanIndex;

    // Calculate new price
    const billingCycle = dto.billingCycle || currentSubscription.billingCycle;
    const price = billingCycle === 'yearly'
      ? Number(newPlan.yearlyPrice)
      : Number(newPlan.monthlyPrice);

    // Calculate prorated amount for upgrades
    let proratedAmount = 0;
    if (isUpgrade) {
      proratedAmount = this.calculateProratedAmount(
        currentSubscription,
        Number(newPlan.monthlyPrice),
        Number(newPlan.yearlyPrice),
        billingCycle,
      );
    }

    // Calculate new end date
    const endDate = new Date();
    if (billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Update subscription
    const updatedSubscription = await this.subscriptionsRepository.updateSubscription(
      currentSubscription.id,
      {
        planId: dto.newPlanId,
        previousPlanId: currentSubscription.planId,
        billingCycle,
        priceAtSubscription: String(price),
        endDate,
        upgradedAt: new Date(),
        status: 'active',
      },
    );

    // Record in history
    await this.subscriptionsRepository.createHistoryEntry({
      identityId,
      subscriptionId: currentSubscription.id,
      action: isUpgrade ? 'upgraded' : 'downgraded',
      fromPlanId: currentSubscription.planId,
      toPlanId: dto.newPlanId,
      amount: String(proratedAmount || price),
      currency: newPlan.currency,
      metadata: { isUpgrade, proratedAmount },
    });

    return updatedSubscription;
  }

  async cancelSubscription(identityId: string, dto: CancelSubscriptionDto): Promise<UserSubscription> {
    const subscription = await this.subscriptionsRepository.findActiveSubscriptionByIdentityId(identityId);
    if (!subscription) {
      throw new NotFoundException({
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'You do not have an active subscription',
      });
    }

    // Update subscription
    const updatedSubscription = await this.subscriptionsRepository.updateSubscription(
      subscription.id,
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: dto.reason,
        autoRenewal: false,
      },
    );

    // Record in history
    await this.subscriptionsRepository.createHistoryEntry({
      identityId,
      subscriptionId: subscription.id,
      action: 'cancelled',
      fromPlanId: subscription.planId,
      reason: dto.reason,
    });

    return updatedSubscription;
  }

  async toggleAutoRenewal(identityId: string, autoRenewal: boolean): Promise<UserSubscription> {
    const subscription = await this.subscriptionsRepository.findActiveSubscriptionByIdentityId(identityId);
    if (!subscription) {
      throw new NotFoundException({
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'You do not have an active subscription',
      });
    }

    return this.subscriptionsRepository.updateSubscription(subscription.id, { autoRenewal });
  }

  async getSubscriptionHistory(
    identityId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ history: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page = 1, limit = 20 } = options;
    const { history, total } = await this.subscriptionsRepository.findSubscriptionHistory(identityId, { page, limit });

    return {
      history,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // =====================
  // ADMIN
  // =====================

  async listAllSubscriptions(
    options: { status?: string; planId?: string; page?: number; limit?: number } = {},
  ): Promise<{
    subscriptions: UserSubscription[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20 } = options;
    const { subscriptions, total } = await this.subscriptionsRepository.findAllSubscriptions(options);

    return {
      subscriptions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateSubscriptionStatus(
    subscriptionId: string,
    dto: UpdateSubscriptionStatusDto,
  ): Promise<UserSubscription> {
    const subscription = await this.subscriptionsRepository.findSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'Subscription not found',
      });
    }

    const updatedSubscription = await this.subscriptionsRepository.updateSubscription(
      subscriptionId,
      { status: dto.status },
    );

    // Record status change in history
    await this.subscriptionsRepository.createHistoryEntry({
      identityId: subscription.identityId,
      subscriptionId,
      action: `status_changed_to_${dto.status}`,
      reason: dto.reason,
      metadata: { previousStatus: subscription.status },
    });

    return updatedSubscription;
  }

  async getSubscriptionStats(): Promise<any> {
    return this.subscriptionsRepository.getSubscriptionStats();
  }

  // =====================
  // HELPERS
  // =====================

  private calculateProratedAmount(
    currentSubscription: UserSubscription,
    newMonthlyPrice: number,
    newYearlyPrice: number,
    billingCycle: 'monthly' | 'yearly',
  ): number {
    const now = new Date();
    const endDate = new Date(currentSubscription.endDate);
    const startDate = new Date(currentSubscription.startDate);

    // Calculate remaining days in current billing period
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Calculate credit from current plan
    const currentPrice = Number(currentSubscription.priceAtSubscription);
    const dailyRate = currentPrice / totalDays;
    const credit = dailyRate * remainingDays;

    // Calculate new price
    const newPrice = billingCycle === 'yearly' ? newYearlyPrice : newMonthlyPrice;

    // Calculate prorated amount (new price minus credit)
    const proratedAmount = Math.max(0, newPrice - credit);

    return Math.round(proratedAmount * 100) / 100; // Round to 2 decimal places
  }

  canUpgrade(currentPlanType: string, newPlanType: string): boolean {
    const currentIndex = PLAN_TYPE_ORDER.indexOf(currentPlanType);
    const newIndex = PLAN_TYPE_ORDER.indexOf(newPlanType);
    return newIndex > currentIndex;
  }

  canDowngrade(currentPlanType: string, newPlanType: string): boolean {
    const currentIndex = PLAN_TYPE_ORDER.indexOf(currentPlanType);
    const newIndex = PLAN_TYPE_ORDER.indexOf(newPlanType);
    return newIndex < currentIndex;
  }
}
