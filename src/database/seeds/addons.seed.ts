import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../schemas';
import { addons, addonPlans } from '../schemas/addons.schema';

/**
 * Default Addons
 * Available addon products for subscription
 */
const defaultAddons = [
  {
    slug: 'erp',
    name: 'ERP System',
    description: 'Complete enterprise resource planning solution for your business. Manage inventory, sales, purchases, and more from a single platform.',
    shortDescription: 'Complete enterprise resource planning solution',
    icon: 'boxes',
    color: 'blue',
    category: 'business',
    features: [
      'Inventory Management',
      'Purchase Orders',
      'Sales Management',
      'Financial Reporting',
      'Multi-branch Support',
      'Staff Management',
      'Supplier Management',
      'Customer Management',
    ],
    isActive: true,
    isComingSoon: false,
    sortOrder: 1,
  },
];

/**
 * Default Addon Plans
 * Pricing tiers for each addon
 */
const defaultAddonPlans: Record<string, Array<{
  name: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  currency: string;
  features: string[];
  limits: Record<string, number>;
  isPopular: boolean;
  isActive: boolean;
  trialDays: number;
  sortOrder: number;
}>> = {
  erp: [
    {
      name: 'Starter',
      description: 'Perfect for small businesses getting started with ERP',
      monthlyPrice: '5000',
      yearlyPrice: '50000',
      currency: 'NGN',
      features: [
        'Up to 5 users',
        '1 branch location',
        'Basic inventory tracking',
        'Sales & purchase orders',
        'Basic financial reports',
        'Email support',
      ],
      limits: { users: 5, branches: 1, products: 500 },
      isPopular: false,
      isActive: true,
      trialDays: 14,
      sortOrder: 1,
    },
    {
      name: 'Professional',
      description: 'Advanced features for growing businesses',
      monthlyPrice: '15000',
      yearlyPrice: '150000',
      currency: 'NGN',
      features: [
        'Up to 20 users',
        'Up to 5 branch locations',
        'Advanced inventory management',
        'Multi-currency support',
        'Advanced financial reports',
        'Priority support',
        'API access',
        'Custom fields',
      ],
      limits: { users: 20, branches: 5, products: 5000 },
      isPopular: true,
      isActive: true,
      trialDays: 14,
      sortOrder: 2,
    },
    {
      name: 'Enterprise',
      description: 'Full-featured solution for large organizations',
      monthlyPrice: '50000',
      yearlyPrice: '500000',
      currency: 'NGN',
      features: [
        'Unlimited users',
        'Unlimited branches',
        'Full inventory suite',
        'Multi-currency & multi-language',
        'Custom reports & dashboards',
        '24/7 dedicated support',
        'Full API access',
        'Custom integrations',
        'Audit logs',
        'Role-based permissions',
      ],
      limits: { users: -1, branches: -1, products: -1 },
      isPopular: false,
      isActive: true,
      trialDays: 30,
      sortOrder: 3,
    },
  ],
};

/**
 * Seed Addons
 * Creates default addons if they don't exist
 */
export async function seedAddons(db: NodePgDatabase<typeof schema>): Promise<void> {
  console.log('🌱 Seeding addons...');

  for (const addonData of defaultAddons) {
    const existingAddon = await db
      .select()
      .from(addons)
      .where(eq(addons.slug, addonData.slug))
      .limit(1);

    let addonId: string;

    if (existingAddon.length === 0) {
      const [newAddon] = await db.insert(addons).values(addonData).returning();
      addonId = newAddon.id;
      console.log(`  ✅ Created addon: ${addonData.name} (${addonData.slug})`);
    } else {
      // Update existing addon with new data (except slug)
      await db
        .update(addons)
        .set({
          ...addonData,
          updatedAt: new Date(),
        })
        .where(eq(addons.slug, addonData.slug));
      addonId = existingAddon[0].id;
      console.log(`  ⏭️  Addon already exists, updated: ${addonData.name}`);
    }

    // Seed plans for this addon
    const plans = defaultAddonPlans[addonData.slug] || [];
    for (const planData of plans) {
      const existingPlan = await db
        .select()
        .from(addonPlans)
        .where(eq(addonPlans.addonId, addonId))
        .limit(100);

      const existingPlanByName = existingPlan.find(p => p.name === planData.name);

      if (!existingPlanByName) {
        await db.insert(addonPlans).values({
          ...planData,
          addonId,
        });
        console.log(`    ✅ Created plan: ${planData.name}`);
      } else {
        await db
          .update(addonPlans)
          .set({
            ...planData,
            addonId,
            updatedAt: new Date(),
          })
          .where(eq(addonPlans.id, existingPlanByName.id));
        console.log(`    ⏭️  Plan already exists, updated: ${planData.name}`);
      }
    }
  }

  console.log('✅ Addons seeding complete');
}

/**
 * Standalone seed runner
 * Can be run directly: npx ts-node src/database/seeds/addons.seed.ts
 */
export async function runSeed(): Promise<void> {
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  try {
    await seedAddons(db);
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
