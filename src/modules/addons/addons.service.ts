import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AddonsRepository } from './addons.repository';
import {
  CreateAddonDto,
  UpdateAddonDto,
  CreateAddonPlanDto,
  UpdateAddonPlanDto,
  SubscribeAddonDto,
  ChangeAddonPlanDto,
  CancelAddonSubscriptionDto,
  UpdateAddonSubscriptionStatusDto,
} from './dto';
import {
  Addon,
  AddonPlan,
  UserAddonSubscription,
} from '@database/schemas/addons.schema';

@Injectable()
export class AddonsService {
  constructor(private readonly addonsRepository: AddonsRepository) {}

  // =====================
  // ADDONS
  // =====================

  async createAddon(dto: CreateAddonDto): Promise<Addon> {
    // Check if slug already exists
    const existingAddon = await this.addonsRepository.findAddonBySlug(dto.slug);
    if (existingAddon) {
      throw new ConflictException({
        code: 'ADDON_SLUG_EXISTS',
        message: `An addon with slug "${dto.slug}" already exists`,
      });
    }

    return this.addonsRepository.createAddon({
      slug: dto.slug,
      name: dto.name,
      description: dto.description,
      shortDescription: dto.shortDescription,
      icon: dto.icon || 'package',
      color: dto.color || 'blue',
      category: dto.category || 'business',
      features: dto.features || [],
      isActive: dto.isActive ?? true,
      isComingSoon: dto.isComingSoon ?? false,
      sortOrder: dto.sortOrder || 0,
    });
  }

  async updateAddon(id: string, dto: UpdateAddonDto): Promise<Addon> {
    const addon = await this.addonsRepository.findAddonById(id);
    if (!addon) {
      throw new NotFoundException({
        code: 'ADDON_NOT_FOUND',
        message: 'Addon not found',
      });
    }

    const updateData: Partial<Addon> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.shortDescription !== undefined) updateData.shortDescription = dto.shortDescription;
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.color !== undefined) updateData.color = dto.color;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.features !== undefined) updateData.features = dto.features;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.isComingSoon !== undefined) updateData.isComingSoon = dto.isComingSoon;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

    return this.addonsRepository.updateAddon(id, updateData);
  }

  async deleteAddon(id: string): Promise<void> {
    const addon = await this.addonsRepository.findAddonById(id);
    if (!addon) {
      throw new NotFoundException({
        code: 'ADDON_NOT_FOUND',
        message: 'Addon not found',
      });
    }

    // Soft delete by deactivating
    await this.addonsRepository.updateAddon(id, { isActive: false });
  }

  async findAddonById(id: string): Promise<Addon> {
    const addon = await this.addonsRepository.findAddonById(id);
    if (!addon) {
      throw new NotFoundException({
        code: 'ADDON_NOT_FOUND',
        message: 'Addon not found',
      });
    }
    return addon;
  }

  async findAddonBySlug(slug: string): Promise<Addon> {
    const addon = await this.addonsRepository.findAddonBySlug(slug);
    if (!addon) {
      throw new NotFoundException({
        code: 'ADDON_NOT_FOUND',
        message: 'Addon not found',
      });
    }
    return addon;
  }

  async findAllAddons(): Promise<Addon[]> {
    return this.addonsRepository.findActiveAddons();
  }

  async findAllAddonsAdmin(): Promise<Addon[]> {
    return this.addonsRepository.findAllAddons();
  }

  // =====================
  // ADDON PLANS
  // =====================

  async createAddonPlan(dto: CreateAddonPlanDto): Promise<AddonPlan> {
    // Verify addon exists
    const addon = await this.addonsRepository.findAddonById(dto.addonId);
    if (!addon) {
      throw new NotFoundException({
        code: 'ADDON_NOT_FOUND',
        message: 'Addon not found',
      });
    }

    return this.addonsRepository.createAddonPlan({
      addonId: dto.addonId,
      name: dto.name,
      description: dto.description,
      monthlyPrice: String(dto.monthlyPrice),
      yearlyPrice: String(dto.yearlyPrice),
      currency: dto.currency || 'NGN',
      features: dto.features || [],
      limits: dto.limits || {},
      isPopular: dto.isPopular || false,
      isActive: true,
      trialDays: dto.trialDays || 0,
      sortOrder: dto.sortOrder || 0,
    });
  }

  async updateAddonPlan(id: string, dto: UpdateAddonPlanDto): Promise<AddonPlan> {
    const plan = await this.addonsRepository.findAddonPlanById(id);
    if (!plan) {
      throw new NotFoundException({
        code: 'ADDON_PLAN_NOT_FOUND',
        message: 'Addon plan not found',
      });
    }

    const updateData: Partial<AddonPlan> = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.monthlyPrice !== undefined) updateData.monthlyPrice = String(dto.monthlyPrice);
    if (dto.yearlyPrice !== undefined) updateData.yearlyPrice = String(dto.yearlyPrice);
    if (dto.features !== undefined) updateData.features = dto.features;
    if (dto.limits !== undefined) updateData.limits = dto.limits;
    if (dto.isPopular !== undefined) updateData.isPopular = dto.isPopular;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.trialDays !== undefined) updateData.trialDays = dto.trialDays;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

    return this.addonsRepository.updateAddonPlan(id, updateData);
  }

  async deleteAddonPlan(id: string): Promise<void> {
    const plan = await this.addonsRepository.findAddonPlanById(id);
    if (!plan) {
      throw new NotFoundException({
        code: 'ADDON_PLAN_NOT_FOUND',
        message: 'Addon plan not found',
      });
    }

    // Soft delete by deactivating
    await this.addonsRepository.updateAddonPlan(id, { isActive: false });
  }

  async findAddonPlanById(id: string): Promise<AddonPlan> {
    const plan = await this.addonsRepository.findAddonPlanById(id);
    if (!plan) {
      throw new NotFoundException({
        code: 'ADDON_PLAN_NOT_FOUND',
        message: 'Addon plan not found',
      });
    }
    return plan;
  }

  async findAddonPlans(addonId: string): Promise<AddonPlan[]> {
    // Verify addon exists
    const addon = await this.addonsRepository.findAddonById(addonId);
    if (!addon) {
      throw new NotFoundException({
        code: 'ADDON_NOT_FOUND',
        message: 'Addon not found',
      });
    }

    return this.addonsRepository.findActiveAddonPlansByAddonId(addonId);
  }

  async findAddonPlansAdmin(addonId: string): Promise<AddonPlan[]> {
    return this.addonsRepository.findAddonPlansByAddonId(addonId);
  }

  async findAllAddonPlansAdmin(): Promise<AddonPlan[]> {
    return this.addonsRepository.findAllAddonPlans();
  }

  // =====================
  // ADDON SUBSCRIPTIONS
  // =====================

  async subscribeToAddon(
    identityId: string,
    addonId: string,
    dto: SubscribeAddonDto,
  ): Promise<UserAddonSubscription> {
    // Verify addon exists and is active
    const addon = await this.addonsRepository.findAddonById(addonId);
    if (!addon || !addon.isActive) {
      throw new NotFoundException({
        code: 'ADDON_NOT_FOUND',
        message: 'Addon not found or not available',
      });
    }

    // Check if identity already has an active subscription for this addon
    const existingSubscription = await this.addonsRepository.findActiveAddonSubscription(
      identityId,
      addonId,
    );
    if (existingSubscription) {
      throw new ConflictException({
        code: 'ALREADY_SUBSCRIBED',
        message: 'You already have an active subscription for this addon. Use change-plan to switch plans.',
      });
    }

    // Find the plan
    const plan = await this.addonsRepository.findAddonPlanById(dto.planId);
    if (!plan) {
      throw new NotFoundException({
        code: 'ADDON_PLAN_NOT_FOUND',
        message: 'Addon plan not found',
      });
    }

    // Verify plan belongs to this addon
    if (plan.addonId !== addonId) {
      throw new BadRequestException({
        code: 'PLAN_ADDON_MISMATCH',
        message: 'The selected plan does not belong to this addon',
      });
    }

    // Verify plan is active
    if (!plan.isActive) {
      throw new BadRequestException({
        code: 'PLAN_NOT_AVAILABLE',
        message: 'This plan is no longer available',
      });
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    const price = dto.billingCycle === 'monthly'
      ? parseFloat(plan.monthlyPrice)
      : parseFloat(plan.yearlyPrice);

    // Set end date based on billing cycle
    if (dto.billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // Handle trial period
    let trialEndDate: Date | undefined;
    let status: 'active' | 'trial' = 'active';

    if (plan.trialDays > 0) {
      trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + plan.trialDays);
      status = 'trial';
    }

    // Create subscription
    const subscription = await this.addonsRepository.createAddonSubscription({
      identityId,
      addonId,
      planId: dto.planId,
      status,
      billingCycle: dto.billingCycle,
      priceAtSubscription: String(price),
      currency: plan.currency,
      startDate,
      endDate,
      trialEndDate: trialEndDate || null,
      autoRenewal: dto.autoRenewal ?? true,
    });

    // Log history
    await this.addonsRepository.createAddonHistoryEntry({
      identityId,
      addonId,
      subscriptionId: subscription.id,
      action: 'subscribed',
      toPlanId: dto.planId,
      amount: String(price),
      currency: plan.currency,
      metadata: { billingCycle: dto.billingCycle },
    });

    return subscription;
  }

  async changeAddonPlan(
    identityId: string,
    addonId: string,
    dto: ChangeAddonPlanDto,
  ): Promise<UserAddonSubscription> {
    // Find existing subscription
    const subscription = await this.addonsRepository.findActiveAddonSubscription(
      identityId,
      addonId,
    );
    if (!subscription) {
      throw new NotFoundException({
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'No active subscription found for this addon',
      });
    }

    // Find new plan
    const newPlan = await this.addonsRepository.findAddonPlanById(dto.newPlanId);
    if (!newPlan) {
      throw new NotFoundException({
        code: 'ADDON_PLAN_NOT_FOUND',
        message: 'Addon plan not found',
      });
    }

    // Verify new plan belongs to this addon
    if (newPlan.addonId !== addonId) {
      throw new BadRequestException({
        code: 'PLAN_ADDON_MISMATCH',
        message: 'The selected plan does not belong to this addon',
      });
    }

    // Check if same plan
    if (subscription.planId === dto.newPlanId) {
      throw new BadRequestException({
        code: 'SAME_PLAN',
        message: 'You are already subscribed to this plan',
      });
    }

    const previousPlanId = subscription.planId;
    const billingCycle = dto.billingCycle || subscription.billingCycle;
    const newPrice = billingCycle === 'monthly'
      ? parseFloat(newPlan.monthlyPrice)
      : parseFloat(newPlan.yearlyPrice);

    // Update subscription
    const updatedSubscription = await this.addonsRepository.updateAddonSubscription(
      subscription.id,
      {
        planId: dto.newPlanId,
        billingCycle,
        priceAtSubscription: String(newPrice),
        previousPlanId,
        upgradedAt: new Date(),
      },
    );

    // Log history
    await this.addonsRepository.createAddonHistoryEntry({
      identityId,
      addonId,
      subscriptionId: subscription.id,
      action: 'plan_changed',
      fromPlanId: previousPlanId,
      toPlanId: dto.newPlanId,
      amount: String(newPrice),
      currency: newPlan.currency,
    });

    return updatedSubscription;
  }

  async cancelAddonSubscription(
    identityId: string,
    addonId: string,
    dto?: CancelAddonSubscriptionDto,
  ): Promise<UserAddonSubscription> {
    const subscription = await this.addonsRepository.findActiveAddonSubscription(
      identityId,
      addonId,
    );
    if (!subscription) {
      throw new NotFoundException({
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'No active subscription found for this addon',
      });
    }

    const updatedSubscription = await this.addonsRepository.updateAddonSubscription(
      subscription.id,
      {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: dto?.reason,
        autoRenewal: false,
      },
    );

    // Log history
    await this.addonsRepository.createAddonHistoryEntry({
      identityId,
      addonId,
      subscriptionId: subscription.id,
      action: 'cancelled',
      fromPlanId: subscription.planId,
      reason: dto?.reason,
    });

    return updatedSubscription;
  }

  async toggleAddonAutoRenewal(
    identityId: string,
    addonId: string,
  ): Promise<UserAddonSubscription> {
    const subscription = await this.addonsRepository.findActiveAddonSubscription(
      identityId,
      addonId,
    );
    if (!subscription) {
      throw new NotFoundException({
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'No active subscription found for this addon',
      });
    }

    return this.addonsRepository.updateAddonSubscription(subscription.id, {
      autoRenewal: !subscription.autoRenewal,
    });
  }

  async getAddonSubscription(
    identityId: string,
    addonId: string,
  ): Promise<UserAddonSubscription | null> {
    return this.addonsRepository.findActiveAddonSubscription(identityId, addonId);
  }

  async getIdentityAddonSubscriptions(identityId: string): Promise<UserAddonSubscription[]> {
    return this.addonsRepository.findActiveAddonSubscriptionsByIdentityId(identityId);
  }

  async getAllIdentityAddonSubscriptions(identityId: string): Promise<UserAddonSubscription[]> {
    return this.addonsRepository.findAddonSubscriptionsByIdentityId(identityId);
  }

  async getAddonSubscriptionHistory(
    identityId: string,
    options: { addonId?: string; page?: number; limit?: number } = {},
  ) {
    return this.addonsRepository.findAddonSubscriptionHistory(identityId, options);
  }

  // =====================
  // ADMIN
  // =====================

  async getAllAddonSubscriptions(options: {
    status?: string;
    addonId?: string;
    planId?: string;
    page?: number;
    limit?: number;
  }) {
    return this.addonsRepository.findAllAddonSubscriptions(options);
  }

  async updateAddonSubscriptionStatus(
    subscriptionId: string,
    dto: UpdateAddonSubscriptionStatusDto,
  ): Promise<UserAddonSubscription> {
    const subscription = await this.addonsRepository.findAddonSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'Addon subscription not found',
      });
    }

    const updatedSubscription = await this.addonsRepository.updateAddonSubscription(
      subscriptionId,
      { status: dto.status },
    );

    // Log history
    await this.addonsRepository.createAddonHistoryEntry({
      identityId: subscription.identityId,
      addonId: subscription.addonId,
      subscriptionId: subscription.id,
      action: `status_changed_to_${dto.status}`,
      reason: dto.reason,
    });

    return updatedSubscription;
  }

  async getAddonStats() {
    return this.addonsRepository.getAddonStats();
  }

  // =====================
  // UTILITIES
  // =====================

  async getAddonsWithSubscriptionStatus(identityId: string): Promise<
    Array<Addon & { isSubscribed: boolean; currentPlan?: AddonPlan; subscription?: UserAddonSubscription }>
  > {
    const [addons, subscriptions] = await Promise.all([
      this.addonsRepository.findActiveAddons(),
      this.addonsRepository.findActiveAddonSubscriptionsByIdentityId(identityId),
    ]);

    const subscriptionMap = new Map(subscriptions.map((s) => [s.addonId, s]));

    const result = await Promise.all(
      addons.map(async (addon) => {
        const subscription = subscriptionMap.get(addon.id);
        let currentPlan: AddonPlan | undefined;

        if (subscription) {
          const plan = await this.addonsRepository.findAddonPlanById(subscription.planId);
          if (plan) {
            currentPlan = plan;
          }
        }

        return {
          ...addon,
          isSubscribed: !!subscription,
          currentPlan,
          subscription,
        };
      }),
    );

    return result;
  }
}
