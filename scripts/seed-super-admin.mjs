// Bootstraps (or re-bootstraps) a super_admin user directly against the live
// Supabase project, bypassing the chicken-and-egg problem where assignRole()
// (src/lib/admin.functions.ts) requires an existing super_admin to grant roles.
//
// Usage:
//   node --env-file=.env scripts/seed-super-admin.mjs <email>
//   npm run seed:admin -- <email>
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
// Safe to re-run: if the auth user already exists it's reused; if the
// super_admin role row already exists the insert is skipped.

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node --env-file=.env scripts/seed-super-admin.mjs <email>');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env first.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function generateTempPassword() {
  return randomBytes(18).toString('base64url');
}

async function findProfileByEmail(email) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', email)
    .maybeSingle();
  if (error) throw new Error(`Looking up profile failed: ${error.message}`);
  return data;
}

async function createAuthUser(email) {
  const tempPassword = generateTempPassword();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (error) throw new Error(`Creating auth user failed: ${error.message}`);
  return { userId: data.user.id, tempPassword };
}

async function waitForProfile(email, attempts = 5, delayMs = 500) {
  for (let i = 0; i < attempts; i++) {
    const profile = await findProfileByEmail(email);
    if (profile) return profile;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(
    `Auth user was created but no matching profiles row appeared for ${email}. ` +
      'Check the handle_new_user trigger (supabase/full_setup.sql).',
  );
}

async function grantSuperAdmin(userId) {
  const { error } = await supabaseAdmin
    .from('user_roles')
    .insert({ user_id: userId, role: 'super_admin' });
  if (error) {
    if (error.code === '23505') return false; // already has the role
    throw new Error(`Granting super_admin failed: ${error.message}`);
  }
  return true;
}

async function main() {
  let profile = await findProfileByEmail(email);
  let tempPassword;

  if (!profile) {
    console.log(`No existing account for ${email}. Creating one...`);
    const created = await createAuthUser(email);
    tempPassword = created.tempPassword;
    profile = await waitForProfile(email);
  } else {
    console.log(`Found existing account for ${email} (user id ${profile.id}).`);
  }

  const granted = await grantSuperAdmin(profile.id);

  console.log('');
  console.log('----------------------------------------');
  console.log(`Email:       ${email}`);
  console.log(`User ID:     ${profile.id}`);
  console.log(`super_admin: ${granted ? 'granted just now' : 'already had it'}`);
  if (tempPassword) {
    console.log(`Temp password: ${tempPassword}`);
    console.log('(Shown once. Log in and change it, or use "Forgot password" instead.)');
  }
  console.log('----------------------------------------');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
