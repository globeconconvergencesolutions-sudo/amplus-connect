import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = [
  "super_admin",
  "content_manager",
  "ecommerce_manager",
  "rewards_manager",
  "viewer",
] as const;

async function requireSuperAdmin(supabase: unknown, userId: string) {
  const client = supabase as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: unknown }> };
        };
      };
    };
  };
  const { data } = await client
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Only super admins can manage staff roles.");
}

/** Grants a role to the profile matching `email`. Super admin only — user_roles has no client-writable RLS policy. */
export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().email(), role: z.enum(ROLES) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", data.email)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("No account found with that email. They must sign up first.");

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: profile.id, role: data.role });
    if (error) {
      if (error.code === "23505") throw new Error("This user already has that role.");
      throw new Error(error.message);
    }
    return { userId: profile.id, email: profile.email, fullName: profile.full_name };
  });

type AdminClient = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

/** Throws if removing `userId`'s super_admin role would leave the portal with none. */
async function assertNotLastSuperAdmin(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin");
  if (error) throw new Error(error.message);
  const others = (data ?? []).filter((row) => row.user_id !== userId);
  if (others.length === 0) throw new Error("You can't remove the last super admin.");
}

/** Revokes a specific role row. Super admin only. */
export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ roleId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: rowError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("id", data.roleId)
      .maybeSingle();
    if (rowError) throw new Error(rowError.message);
    if (!row) return { ok: true };
    if (row.role === "super_admin") {
      if (row.user_id === context.userId) {
        throw new Error("You can't revoke your own super admin role.");
      }
      await assertNotLastSuperAdmin(supabaseAdmin, row.user_id);
    }

    const { error } = await supabaseAdmin.from("user_roles").delete().eq("id", data.roleId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Deletes a staff member's login entirely (auth.users). One auth delete is one Postgres
 * transaction: profiles, user_roles and staff_invites cascade with it, and invoice/customer
 * `created_by` links fall back to null. Refuses accounts with orders — orders cascade on
 * auth.users, so deleting the login would erase sales history.
 */
export const removeStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("You can't delete your own account from here.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    if (rolesError) throw new Error(rolesError.message);
    if (!roleRows?.length) throw new Error("That account is not staff.");
    if (roleRows.some((row) => row.role === "super_admin")) {
      await assertNotLastSuperAdmin(supabaseAdmin, data.userId);
    }

    const { count: orderCount, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.userId);
    if (ordersError) throw new Error(ordersError.message);
    if ((orderCount ?? 0) > 0) {
      throw new Error(
        `This account has ${orderCount} order(s); deleting it would erase them. Revoke the roles instead.`,
      );
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Lists every staff role assignment with the owning profile's name/email. Super admin only. */
export const listStaffRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows, error } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((roleRows ?? []).map((row) => row.user_id)));
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };

    const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return (roleRows ?? []).map((row) => ({
      ...row,
      profile: byId.get(row.user_id) ?? null,
    }));
  });
