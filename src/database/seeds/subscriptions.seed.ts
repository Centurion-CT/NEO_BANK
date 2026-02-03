import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../schemas';
import { subscriptionPlans } from '../schemas/subscriptions.schema';

/**
 * Default Subscription Plans
 * Based on system design requirements
 */
const defaultPlans = [
  {
    name: 'Basic',
    type: 'basic' as const,
    description: 'Perfect for getting started with basic banking features',
    monthlyPrice: '0',
    yearlyPrice: '0',
    currency: 'NGN',
    features: [
      'Basic account access',
      'Up to 10 transfers per day',
      'Daily limit: ₦100,000',
      'Standard customer support',
      'Mobile app access',
    ],
    dailyTransactionLimit: '100000',
    monthlyTransactionLimit: '2000000',
    maxTransfersPerDay: 10,
    maxAccountsAllowed: 1,
    isPopular: false,
    isActive: true,
    trialDays: 0,
    sortOrder: 1,
  },
  {
    name: 'Verified',
    type: 'verified' as const,
    description: 'Enhanced features for verified users with higher limits',
    monthlyPrice: '500',
    yearlyPrice: '5000',
    currency: 'NGN',
    features: [
      'All Basic features',
      'Up to 50 transfers per day',
      'Daily limit: ₦500,000',
      'Priority customer support',
      'Account statements',
      'Transaction analytics',
    ],
    dailyTransactionLimit: '500000',
    monthlyTransactionLimit: '10000000',
    maxTransfersPerDay: 50,
    maxAccountsAllowed: 2,
    isPopular: false,
    isActive: true,
    trialDays: 7,
    sortOrder: 2,
  },
  {
    name: 'Premium',
    type: 'premium' as const,
    description: 'Full access with premium features and maximum limits',
    monthlyPrice: '2000',
    yearlyPrice: '20000',
    currency: 'NGN',
    features: [
      'All Verified features',
      'Unlimited transfers',
      'Daily limit: ₦2,000,000',
      '24/7 Premium support',
      'Advanced analytics',
      'API access',
      'Priority transactions',
      'Dedicated account manager',
    ],
    dailyTransactionLimit: '2000000',
    monthlyTransactionLimit: '50000000',
    maxTransfersPerDay: -1, // Unlimited
    maxAccountsAllowed: 5,
    isPopular: true,
    isActive: true,
    trialDays: 14,
    sortOrder: 3,
  },
  {
    name: 'Business',
    type: 'business' as const,
    description: 'Enterprise-grade solution for businesses with maximum capabilities',
    monthlyPrice: '10000',
    yearlyPrice: '100000',
    currency: 'NGN',
    features: [
      'All Premium features',
      'Unlimited transfers',
      'Daily limit: ₦10,000,000',
      'Dedicated business support',
      'Multi-user access',
      'Bulk transfers',
      'Custom API limits',
      'White-label options',
      'Compliance reports',
      'Audit logs',
    ],
    dailyTransactionLimit: '10000000',
    monthlyTransactionLimit: '200000000',
    maxTransfersPerDay: -1, // Unlimited
    maxAccountsAllowed: 20,
    isPopular: false,
    isActive: true,
    trialDays: 30,
    sortOrder: 4,
  },
];

/**
 * Seed Subscription Plans
 * Creates default subscription plans if they don't exist
 */
export async function seedSubscriptions(db: NodePgDatabase<typeof schema>): Promise<void> {
  console.log('🌱 Seeding subscription plans...');

  for (const planData of defaultPlans) {
    const existingPlan = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.type, planData.type))
      .limit(1);

    if (existingPlan.length === 0) {
      await db.insert(subscriptionPlans).values(planData);
      console.log(`  ✅ Created plan: ${planData.name} (${planData.type})`);
    } else {
      // Update existing plan with new data (except type)
      await db
        .update(subscriptionPlans)
        .set({
          ...planData,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionPlans.type, planData.type));
      console.log(`  ⏭️  Plan already exists, updated: ${planData.name}`);
    }
  }

  console.log('✅ Subscription plans seeding complete');
}

/**
 * Standalone seed runner
 * Can be run directly: npx ts-node src/database/seeds/subscriptions.seed.ts
 */
export async function runSeed(): Promise<void> {
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  try {
    await seedSubscriptions(db);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
