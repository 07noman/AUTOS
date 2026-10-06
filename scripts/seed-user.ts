/**
 * Seed a demo user and tenant into the Postgres database.
 * Run with: tsx scripts/seed-user.ts
 *
 * Requires DATABASE_URL in environment (or .env at workspace root).
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { tenants, users } from '../apps/api/drizzle/schema.js';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function main() {
  console.log('🌱  Seeding demo user…');

  // ── Tenant ────────────────────────────────────────────────────────────────
  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const [existing] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, TENANT_ID))
    .limit(1);

  if (!existing) {
    await db.insert(tenants).values({
      id: TENANT_ID,
      name: 'GENX Demo Store',
      code: 'genx-demo',
      businessType: 'retail',
      email: 'store@genx.com',
      currency: 'USD',
      timezone: 'UTC',
    });
    console.log('✅  Tenant created: GENX Demo Store');
  } else {
    console.log('ℹ️   Tenant already exists — skipping.');
  }

  // ── User ──────────────────────────────────────────────────────────────────
  const EMAIL = 'demo@genx.com';
  const PASSWORD = 'password';

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, EMAIL))
    .limit(1);

  if (!existingUser) {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    await db.insert(users).values({
      tenantId: TENANT_ID,
      email: EMAIL,
      passwordHash,
      name: 'Demo User',
      role: 'owner',
      isActive: 1,
    });
    console.log(`✅  User created: ${EMAIL} / ${PASSWORD}`);
  } else {
    // Update password to match spec in case hash differs
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    await db.update(users).set({ passwordHash }).where(eq(users.email, EMAIL));
    console.log(`ℹ️   User ${EMAIL} already exists — password updated.`);
  }

  console.log('\n🎉  Seeding complete!');
  console.log(`    Email   : ${EMAIL}`);
  console.log(`    Password: ${PASSWORD}`);
  await client.end();
}

main().catch((err) => {
  console.error('❌  Seeding failed:', err);
  process.exit(1);
});
