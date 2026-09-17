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

/** Revokes a specific role row. Super admin only. */
export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ roleId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").delete().eq("id", data.roleId);
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
