import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import * as schema from '../schemas';
import { tenants } from '../schemas/tenants.schema';
import { properties, identityProperties } from '../schemas/properties.schema';
import { identities } from '../schemas/identities.schema';

/**
 * System Tenant Configuration
 * The bank's internal tenant for system operations
 */
const systemTenant = {
  tenantType: 'PARTNER' as const, // INTERNAL type doesn't exist, using PARTNER for system
  legalName: 'BANK_SYSTEM',
  status: 'ACTIVE' as const,
};

/**
 * Virtual Properties (Digital Channels)
 * These are the digital touchpoints where users can access the system
 */
const virtualProperties = [
  {
    propertyCode: 'MOBILE_APP_ANDROID',
    name: 'Mobile App (Android)',
    propertyType: 'VIRTUAL' as const,
    propertySubtype: 'MOBILE_APP' as const,
    isAssignable: true,
    allowsAgentAccess: false,
    metadata: { platform: 'android', version: '1.0.0' },
  },
  {
    propertyCode: 'MOBILE_APP_IOS',
    name: 'Mobile App (iOS)',
    propertyType: 'VIRTUAL' as const,
    propertySubtype: 'MOBILE_APP' as const,
    isAssignable: true,
    allowsAgentAccess: false,
    metadata: { platform: 'ios', version: '1.0.0' },
  },
  {
    propertyCode: 'WEB_APP',
    name: 'Web Application',
    propertyType: 'VIRTUAL' as const,
    propertySubtype: 'WEB_APP' as const,
    isAssignable: true,
    allowsAgentAccess: false,
    metadata: { platform: 'web' },
  },
  {
    propertyCode: 'USSD_CHANNEL',
    name: 'USSD Banking Channel',
    propertyType: 'VIRTUAL' as const,
    propertySubtype: 'USSD_CHANNEL' as const,
    isAssignable: true,
    allowsAgentAccess: false,
    metadata: { shortCode: '*737#' },
  },
  {
    propertyCode: 'PARTNER_API',
    name: 'Partner API Gateway',
    propertyType: 'VIRTUAL' as const,
    propertySubtype: 'PARTNER_CHANNEL' as const,
    isAssignable: true,
    allowsAgentAccess: false,
    metadata: { apiVersion: 'v1' },
  },
  {
    propertyCode: 'INTERNAL_SYSTEM',
    name: 'Internal System',
    propertyType: 'VIRTUAL' as const,
    propertySubtype: 'INTERNAL_SYSTEM' as const,
    isAssignable: false,
    allowsAgentAccess: false,
    metadata: { internal: true },
  },
];

/**
 * Physical Properties (Sample Branches)
 * These are example physical locations - adjust for your actual branches
 */
const physicalProperties = [
  {
    propertyCode: 'BRANCH_HQ',
    name: 'Head Office Branch',
    propertyType: 'PHYSICAL' as const,
    propertySubtype: 'BRANCH' as const,
    isAssignable: true,
    allowsAgentAccess: false,
    metadata: {
      address: 'Head Office, Lagos',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
    },
  },
  {
    propertyCode: 'BRANCH_IKEJA',
    name: 'Ikeja Branch',
    propertyType: 'PHYSICAL' as const,
    propertySubtype: 'BRANCH' as const,
    isAssignable: true,
    allowsAgentAccess: false,
    metadata: {
      address: 'Ikeja, Lagos',
      city: 'Ikeja',
      state: 'Lagos',
      country: 'Nigeria',
    },
  },
  {
    propertyCode: 'BRANCH_VI',
    name: 'Victoria Island Branch',
    propertyType: 'PHYSICAL' as const,
    propertySubtype: 'BRANCH' as const,
    isAssignable: true,
    allowsAgentAccess: false,
    metadata: {
      address: 'Victoria Island, Lagos',
      city: 'Victoria Island',
      state: 'Lagos',
      country: 'Nigeria',
    },
  },
  {
    propertyCode: 'AGENT_SAMPLE_001',
    name: 'Sample Agent Location 1',
    propertyType: 'PHYSICAL' as const,
    propertySubtype: 'AGENT_LOCATION' as const,
    isAssignable: true,
    allowsAgentAccess: true,
    metadata: {
      agentCode: 'AGT001',
      address: 'Surulere, Lagos',
      city: 'Surulere',
      state: 'Lagos',
      country: 'Nigeria',
    },
  },
];

/**
 * Seed Tenants and Properties
 * Creates system tenant and all virtual/physical properties
 */
export async function seedTenantsAndProperties(db: NodePgDatabase<typeof schema>): Promise<void> {
  console.log('🌱 Seeding tenants and properties...');

  // Create system tenant
  const existingTenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.legalName, systemTenant.legalName))
    .limit(1);

  let systemTenantId: string;

  if (existingTenant.length === 0) {
    const [newTenant] = await db.insert(tenants).values(systemTenant).returning();
    systemTenantId = newTenant.id;
    console.log(`  ✅ Created system tenant: ${systemTenant.legalName}`);
  } else {
    systemTenantId = existingTenant[0].id;
    console.log(`  ⏭️  System tenant already exists: ${systemTenant.legalName}`);
  }

  // Create virtual properties
  console.log('\n  📱 Creating virtual properties...');
  for (const propData of virtualProperties) {
    const existingProp = await db
      .select()
      .from(properties)
      .where(eq(properties.propertyCode, propData.propertyCode))
      .limit(1);

    if (existingProp.length === 0) {
      await db.insert(properties).values({
        ...propData,
        tenantId: null, // Bank-owned properties
        status: 'ACTIVE',
      });
      console.log(`    ✅ Created property: ${propData.name} (${propData.propertyCode})`);
    } else {
      console.log(`    ⏭️  Property already exists: ${propData.name}`);
    }
  }

  // Create physical properties
  console.log('\n  🏢 Creating physical properties...');
  for (const propData of physicalProperties) {
    const existingProp = await db
      .select()
      .from(properties)
      .where(eq(properties.propertyCode, propData.propertyCode))
      .limit(1);

    if (existingProp.length === 0) {
      await db.insert(properties).values({
        ...propData,
        tenantId: null, // Bank-owned properties
        status: 'ACTIVE',
      });
      console.log(`    ✅ Created property: ${propData.name} (${propData.propertyCode})`);
    } else {
      console.log(`    ⏭️  Property already exists: ${propData.name}`);
    }
  }

  console.log('\n✅ Tenants and properties seeding complete');
}

/**
 * Get the default property for a channel type
 * Used during registration to assign users to a property
 */
export function getDefaultPropertyCode(channel: 'web' | 'mobile_android' | 'mobile_ios' | 'ussd' | 'api'): string {
  switch (channel) {
    case 'web':
      return 'WEB_APP';
    case 'mobile_android':
      return 'MOBILE_APP_ANDROID';
    case 'mobile_ios':
      return 'MOBILE_APP_IOS';
    case 'ussd':
      return 'USSD_CHANNEL';
    case 'api':
      return 'PARTNER_API';
    default:
      return 'WEB_APP';
  }
}

/**
 * Standalone seed runner
 * Can be run directly: npx ts-node src/database/seeds/tenants-properties.seed.ts
 */
export async function runSeed(): Promise<void> {
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const dotenv = await import('dotenv');
  dotenv.config();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  try {
    await seedTenantsAndProperties(db);
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
