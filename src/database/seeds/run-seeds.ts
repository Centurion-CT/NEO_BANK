import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, and } from 'drizzle-orm';
import * as argon2 from 'argon2';
import * as schema from '../schemas';
import {
  identities,
  personProfiles,
  authPrincipals,
  authSecrets,
  kycProfiles,
  roles,
  userRoles,
  identityRoles,
} from '../schemas';

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  console.log('Checking for existing admin user...');

  // Check if admin email already exists
  const [existingPrincipal] = await db
    .select()
    .from(authPrincipals)
    .where(
      and(
        eq(authPrincipals.principalType, 'email'),
        eq(authPrincipals.principalValue, 'admin@bankapp.com'),
      ),
    )
    .limit(1);

  if (existingPrincipal) {
    console.log('Admin user already exists. Checking for updates...');

    // Get the identity ID
    const adminIdentityId = existingPrincipal.identityId;

    // Check if admin role exists
    let [adminRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.type, 'admin'))
      .limit(1);

    if (!adminRole) {
      console.log('Creating admin role...');
      [adminRole] = await db
        .insert(roles)
        .values({
          roleCode: 'ADMIN',
          name: 'Administrator',
          roleCategory: 'SYSTEM',
          type: 'admin',
          description: 'System administrator with full access',
          isSystemRole: true,
          isActive: true,
        })
        .returning();
    }

    // Check if scoped identity role exists
    const [existingScopedRole] = await db
      .select()
      .from(identityRoles)
      .where(
        and(
          eq(identityRoles.identityId, adminIdentityId),
          eq(identityRoles.roleId, adminRole.id),
          eq(identityRoles.scope, 'GLOBAL'),
        ),
      )
      .limit(1);

    if (!existingScopedRole) {
      console.log('Adding scoped GLOBAL admin role...');
      await db.insert(identityRoles).values({
        identityId: adminIdentityId,
        roleId: adminRole.id,
        scope: 'GLOBAL',
        scopeRefId: null,
        status: 'ACTIVE',
        assignedBy: adminIdentityId,
        assignedAt: new Date(),
      });
      console.log('Scoped admin role added.');
    } else {
      console.log('Scoped admin role already exists.');
    }

    // Check if password exists, add if missing
    const [existingPassword] = await db
      .select()
      .from(authSecrets)
      .where(
        and(
          eq(authSecrets.identityId, adminIdentityId),
          eq(authSecrets.secretType, 'password'),
        ),
      )
      .limit(1);

    if (!existingPassword) {
      console.log('Adding password for admin...');
      const passwordHash = await argon2.hash('Admin@123', {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
      await db.insert(authSecrets).values({
        identityId: adminIdentityId,
        secretType: 'password',
        secretHash: passwordHash,
        failedAttempts: 0,
      });
      console.log('Password added: Admin@123');
    } else {
      console.log('Password already exists.');
    }

    console.log('=========================================');
    console.log('Admin user update complete!');
    console.log('=========================================');
    console.log('Email:    admin@bankapp.com');
    console.log('Password: Admin@123');
    console.log('PIN:      123456');
    console.log('=========================================');

    await pool.end();
    return;
  }

  console.log('Creating admin identity...');

  // Create identity
  const [identity] = await db
    .insert(identities)
    .values({
      identityType: 'natural_person',
      status: 'active',
      riskLevel: 'low',
    })
    .returning();

  // Create person profile
  await db.insert(personProfiles).values({
    identityId: identity.id,
    firstName: 'System',
    lastName: 'Admin',
    nationality: 'NG',
  });

  // Create auth principals (email and phone)
  await db.insert(authPrincipals).values([
    {
      identityId: identity.id,
      principalType: 'email',
      principalValue: 'admin@bankapp.com',
      isPrimary: true,
      isVerified: true,
      isActive: true,
      verifiedAt: new Date(),
    },
    {
      identityId: identity.id,
      principalType: 'phone',
      principalValue: '+2340000000000',
      isPrimary: false,
      isVerified: true,
      isActive: true,
      verifiedAt: new Date(),
    },
  ]);

  // Create PIN and Password hashes
  const pinHash = await argon2.hash('123456', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const passwordHash = await argon2.hash('Admin@123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Create auth secrets (PIN and Password)
  await db.insert(authSecrets).values([
    {
      identityId: identity.id,
      secretType: 'pin',
      secretHash: pinHash,
      failedAttempts: 0,
    },
    {
      identityId: identity.id,
      secretType: 'password',
      secretHash: passwordHash,
      failedAttempts: 0,
    },
  ]);

  // Create KYC profile
  await db.insert(kycProfiles).values({
    identityId: identity.id,
    kycTier: 'tier_3',
    status: 'approved',
  });

  // Check if admin role exists
  let [adminRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.type, 'admin'))
    .limit(1);

  // Create admin role if it doesn't exist
  if (!adminRole) {
    console.log('Creating admin role...');
    [adminRole] = await db
      .insert(roles)
      .values({
        roleCode: 'ADMIN',
        name: 'Administrator',
        roleCategory: 'SYSTEM',
        type: 'admin',
        description: 'System administrator with full access',
        isSystemRole: true,
        isActive: true,
      })
      .returning();
  }

  // Assign admin role to identity (legacy userRoles table)
  await db.insert(userRoles).values({
    identityId: identity.id,
    roleId: adminRole.id,
    assignedBy: identity.id,
    assignedAt: new Date(),
  });

  // Assign admin role with GLOBAL scope (new identityRoles table)
  await db.insert(identityRoles).values({
    identityId: identity.id,
    roleId: adminRole.id,
    scope: 'GLOBAL',
    scopeRefId: null,
    status: 'ACTIVE',
    assignedBy: identity.id,
    assignedAt: new Date(),
  });

  console.log('=========================================');
  console.log('Admin user created successfully!');
  console.log('=========================================');
  console.log('Email:    admin@bankapp.com');
  console.log('Password: Admin@123');
  console.log('PIN:      123456');
  console.log('=========================================');

  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
