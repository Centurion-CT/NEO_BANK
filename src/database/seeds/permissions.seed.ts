import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../schemas';
import { roles, permissions, rolePermissions } from '../schemas/permissions.schema';

/**
 * Default Roles Configuration
 * Based on Phase 1A Identity & Authentication Foundation
 */
const defaultRoles = [
  // System roles
  {
    roleCode: 'SUPER_ADMIN',
    name: 'Super Administrator',
    roleCategory: 'SYSTEM' as const,
    type: 'super_admin' as const,
    description: 'Full system access with all permissions',
    isSystemRole: true,
  },
  {
    roleCode: 'ADMIN',
    name: 'Administrator',
    roleCategory: 'SYSTEM' as const,
    type: 'admin' as const,
    description: 'Administrative access for managing users and operations',
    isSystemRole: true,
  },
  {
    roleCode: 'COMPLIANCE',
    name: 'Compliance Officer',
    roleCategory: 'SYSTEM' as const,
    type: null,
    description: 'Compliance and regulatory oversight',
    isSystemRole: true,
  },
  {
    roleCode: 'AUDITOR',
    name: 'Auditor',
    roleCategory: 'SYSTEM' as const,
    type: null,
    description: 'Read-only access for audit and review purposes',
    isSystemRole: true,
  },

  // Operational roles
  {
    roleCode: 'SUPPORT_AGENT',
    name: 'Support Agent',
    roleCategory: 'OPERATIONAL' as const,
    type: 'support_agent' as const,
    description: 'Customer support access for handling user issues',
    isSystemRole: true,
  },
  {
    roleCode: 'BANK_STAFF',
    name: 'Bank Staff',
    roleCategory: 'OPERATIONAL' as const,
    type: null,
    description: 'Branch staff for in-person operations',
    isSystemRole: true,
  },
  {
    roleCode: 'AGENT',
    name: 'Agent',
    roleCategory: 'OPERATIONAL' as const,
    type: null,
    description: 'Agent banking operator for assisted transactions',
    isSystemRole: true,
  },
  {
    roleCode: 'PARTNER_USER',
    name: 'Partner User',
    roleCategory: 'OPERATIONAL' as const,
    type: null,
    description: 'External partner with API access',
    isSystemRole: true,
  },

  // Personal roles
  {
    roleCode: 'USER',
    name: 'User',
    roleCategory: 'PERSONAL' as const,
    type: 'user' as const,
    description: 'Standard user role with basic features',
    isSystemRole: true,
  },

  // Business roles
  {
    roleCode: 'BUSINESS_OWNER',
    name: 'Business Owner',
    roleCategory: 'BUSINESS' as const,
    type: null,
    description: 'Owner of a business tenant with full tenant control',
    isSystemRole: true,
  },
  {
    roleCode: 'BUSINESS_STAFF',
    name: 'Business Staff',
    roleCategory: 'BUSINESS' as const,
    type: null,
    description: 'Staff member within a business tenant',
    isSystemRole: true,
  },
];

/**
 * Default Permissions Configuration
 * Based on Phase 1A Role & Permission Model
 */
const defaultPermissions = [
  // Users/Profile permissions (Self-service)
  { code: 'VIEW_OWN_PROFILE', name: 'View Own Profile', description: 'View personal profile data', category: 'users' as const },
  { code: 'EDIT_OWN_PROFILE', name: 'Edit Own Profile', description: 'Edit personal profile data', category: 'users' as const },
  { code: 'MANAGE_CREDENTIALS', name: 'Manage Credentials', description: 'Change PIN, password, manage MFA', category: 'users' as const },
  { code: 'MANAGE_DEVICES', name: 'Manage Devices', description: 'View and manage registered devices', category: 'users' as const },

  // KYC permissions (Self-service)
  { code: 'SUBMIT_PERSONAL_KYC', name: 'Submit Personal KYC', description: 'Submit personal KYC documents', category: 'kyc' as const },
  { code: 'VIEW_OWN_KYC_STATUS', name: 'View Own KYC Status', description: 'View own KYC verification status', category: 'kyc' as const },

  // Transaction permissions (Self-service)
  { code: 'VIEW_OWN_TRANSACTIONS', name: 'View Own Transactions', description: 'View own transaction history', category: 'transactions' as const },
  { code: 'INITIATE_TRANSACTIONS', name: 'Initiate Transactions', description: 'Initiate transfers and payments', category: 'transactions' as const },

  // Business permissions (Tenant-scoped)
  { code: 'SUBMIT_BUSINESS_KYC', name: 'Submit Business KYC', description: 'Submit business KYC documents', category: 'kyc' as const },
  { code: 'MANAGE_TENANT', name: 'Manage Tenant', description: 'Manage tenant settings and configuration', category: 'tenants' as const },
  { code: 'INVITE_STAFF', name: 'Invite Staff', description: 'Invite staff members to the tenant', category: 'tenants' as const },
  { code: 'MANAGE_STAFF_ROLES', name: 'Manage Staff Roles', description: 'Assign and revoke staff roles within tenant', category: 'tenants' as const },
  { code: 'VIEW_BUSINESS_TRANSACTIONS', name: 'View Business Transactions', description: 'View all tenant transactions', category: 'transactions' as const },

  // Agent permissions (Property-scoped)
  { code: 'ASSIST_TRANSACTIONS', name: 'Assist Transactions', description: 'Process customer transactions at agent location', category: 'transactions' as const },
  { code: 'ASSIST_KYC', name: 'Assist KYC', description: 'Help customers with KYC submission', category: 'kyc' as const },
  { code: 'VIEW_ASSIGNED_CUSTOMERS', name: 'View Assigned Customers', description: 'View customers assigned to agent location', category: 'users' as const },

  // Admin permissions (Global)
  { code: 'users.read', name: 'Read Users', description: 'View user profiles and data', category: 'users' as const },
  { code: 'users.write', name: 'Write Users', description: 'Create and update user accounts', category: 'users' as const },
  { code: 'users.delete', name: 'Delete Users', description: 'Delete user accounts', category: 'users' as const },
  { code: 'kyc.review', name: 'Review KYC', description: 'Review and approve KYC submissions', category: 'kyc' as const },
  { code: 'transactions.view', name: 'View Transactions', description: 'View transaction history and details', category: 'transactions' as const },
  { code: 'transactions.reverse', name: 'Reverse Transactions', description: 'Reverse completed transactions', category: 'transactions' as const },
  { code: 'sessions.manage', name: 'Manage Sessions', description: 'View and revoke user sessions', category: 'sessions' as const },
  { code: 'audit.view', name: 'View Audit Logs', description: 'View system audit logs', category: 'audit' as const },
  { code: 'settings.manage', name: 'Manage Settings', description: 'Manage system settings', category: 'settings' as const },
  { code: 'subscriptions.manage', name: 'Manage Subscriptions', description: 'Manage subscription plans and user subscriptions', category: 'subscriptions' as const },
  { code: 'permissions.manage', name: 'Manage Permissions', description: 'Manage roles and permissions', category: 'permissions' as const },

  // Tenant management (Admin)
  { code: 'tenants.read', name: 'View Tenants', description: 'View all tenants in the system', category: 'tenants' as const },
  { code: 'tenants.write', name: 'Manage Tenants', description: 'Create and update tenants', category: 'tenants' as const },

  // Property management (Admin)
  { code: 'properties.read', name: 'View Properties', description: 'View all properties in the system', category: 'properties' as const },
  { code: 'properties.write', name: 'Manage Properties', description: 'Create and update properties', category: 'properties' as const },
];

/**
 * Role-Permission Mappings
 * Defines which permissions each role gets
 */
const rolePermissionMappings: Record<string, string[]> = {
  // Super Admin - All permissions
  SUPER_ADMIN: [
    'users.read', 'users.write', 'users.delete',
    'kyc.review',
    'transactions.view', 'transactions.reverse',
    'sessions.manage',
    'audit.view',
    'settings.manage',
    'subscriptions.manage',
    'permissions.manage',
    'tenants.read', 'tenants.write',
    'properties.read', 'properties.write',
  ],

  // Admin - Most admin permissions except dangerous ones
  ADMIN: [
    'users.read', 'users.write',
    'kyc.review',
    'transactions.view',
    'sessions.manage',
    'audit.view',
    'tenants.read',
    'properties.read',
  ],

  // Compliance - Read-only + KYC review
  COMPLIANCE: [
    'users.read',
    'kyc.review',
    'transactions.view',
    'audit.view',
    'tenants.read',
    'properties.read',
  ],

  // Auditor - Read-only access
  AUDITOR: [
    'users.read',
    'transactions.view',
    'audit.view',
    'tenants.read',
    'properties.read',
  ],

  // Support Agent - Limited admin access
  SUPPORT_AGENT: [
    'users.read',
    'kyc.review',
    'transactions.view',
  ],

  // Bank Staff - Branch operations
  BANK_STAFF: [
    'users.read',
    'kyc.review',
    'transactions.view',
    'ASSIST_TRANSACTIONS',
    'ASSIST_KYC',
  ],

  // Agent - Agent banking operations (property-scoped)
  AGENT: [
    'ASSIST_TRANSACTIONS',
    'ASSIST_KYC',
    'VIEW_ASSIGNED_CUSTOMERS',
  ],

  // Partner User - API access
  PARTNER_USER: [
    'transactions.view',
  ],

  // Standard User - Self-service permissions
  USER: [
    'VIEW_OWN_PROFILE',
    'EDIT_OWN_PROFILE',
    'MANAGE_CREDENTIALS',
    'MANAGE_DEVICES',
    'SUBMIT_PERSONAL_KYC',
    'VIEW_OWN_KYC_STATUS',
    'VIEW_OWN_TRANSACTIONS',
    'INITIATE_TRANSACTIONS',
  ],

  // Business Owner - Tenant management (tenant-scoped)
  BUSINESS_OWNER: [
    'VIEW_OWN_PROFILE',
    'EDIT_OWN_PROFILE',
    'MANAGE_CREDENTIALS',
    'MANAGE_DEVICES',
    'SUBMIT_BUSINESS_KYC',
    'MANAGE_TENANT',
    'INVITE_STAFF',
    'MANAGE_STAFF_ROLES',
    'VIEW_BUSINESS_TRANSACTIONS',
    'INITIATE_TRANSACTIONS',
  ],

  // Business Staff - Limited tenant access (tenant-scoped)
  BUSINESS_STAFF: [
    'VIEW_OWN_PROFILE',
    'EDIT_OWN_PROFILE',
    'MANAGE_CREDENTIALS',
    'VIEW_BUSINESS_TRANSACTIONS',
    'INITIATE_TRANSACTIONS',
  ],
};

/**
 * Seed Permissions
 * Creates default roles and permissions if they don't exist
 */
export async function seedPermissions(db: NodePgDatabase<typeof schema>): Promise<void> {
  console.log('🌱 Seeding permissions...');

  // Create default roles
  const createdRoles: Record<string, string> = {};
  for (const roleData of defaultRoles) {
    const existingRole = await db
      .select()
      .from(roles)
      .where(eq(roles.roleCode, roleData.roleCode))
      .limit(1);

    if (existingRole.length === 0) {
      const [newRole] = await db.insert(roles).values(roleData).returning();
      createdRoles[roleData.roleCode] = newRole.id;
      console.log(`  ✅ Created role: ${roleData.name} (${roleData.roleCode})`);
    } else {
      createdRoles[roleData.roleCode] = existingRole[0].id;
      console.log(`  ⏭️  Role already exists: ${roleData.name}`);
    }
  }

  // Create default permissions
  const createdPermissions: Record<string, string> = {};
  for (const permData of defaultPermissions) {
    const existingPerm = await db
      .select()
      .from(permissions)
      .where(eq(permissions.code, permData.code))
      .limit(1);

    if (existingPerm.length === 0) {
      const [newPerm] = await db.insert(permissions).values(permData).returning();
      createdPermissions[permData.code] = newPerm.id;
      console.log(`  ✅ Created permission: ${permData.code}`);
    } else {
      createdPermissions[permData.code] = existingPerm[0].id;
      console.log(`  ⏭️  Permission already exists: ${permData.code}`);
    }
  }

  // Assign permissions to roles
  for (const [roleCode, permissionCodes] of Object.entries(rolePermissionMappings)) {
    const roleId = createdRoles[roleCode];
    if (!roleId) {
      console.log(`  ⚠️  Role ${roleCode} not found, skipping permission assignment`);
      continue;
    }

    let assignedCount = 0;
    for (const permCode of permissionCodes) {
      const permId = createdPermissions[permCode];
      if (!permId) {
        console.log(`  ⚠️  Permission ${permCode} not found for role ${roleCode}`);
        continue;
      }

      try {
        await db
          .insert(rolePermissions)
          .values({ roleId, permissionId: permId })
          .onConflictDoNothing();
        assignedCount++;
      } catch {
        // Ignore duplicate constraint errors
      }
    }
    console.log(`  ✅ Assigned ${assignedCount} permissions to ${roleCode}`);
  }

  console.log('✅ Permissions seeding complete');
}

/**
 * Standalone seed runner
 * Can be run directly: npx ts-node src/database/seeds/permissions.seed.ts
 */
export async function runSeed(): Promise<void> {
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  try {
    await seedPermissions(db);
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
