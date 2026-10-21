import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isMissingRelation } from "@/lib/supabase-errors";

const idsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Select at least one item").max(200),
});

async function requireStaff(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
) {
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(roles ?? []).length) throw new Error("Staff access required.");
}

function missingRpcHint(error: { code?: string; message?: string } | null) {
  if (!error) return null;
  if (isMissingRelation(error)) {
    return "Delete helpers are not installed. Run supabase/migrations/20261020120000_admin_deletes.sql (or npm run apply:admin-deletes).";
  }
  if (/Could not find the function|schema cache|PGRST202/i.test(error.message ?? "")) {
    return "Delete helpers are not installed. Run supabase/migrations/20261020120000_admin_deletes.sql (or npm run apply:admin-deletes).";
  }
  return null;
}

async function runDeleteRpc(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  fn: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await admin.rpc(fn, args);
  const hint = missingRpcHint(error);
  if (hint) throw new Error(hint);
  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : Number(data ?? 0);
}

export const deleteInterestLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const deleted = await runDeleteRpc(supabaseAdmin, "admin_delete_interest_leads", {
      p_ids: data.ids,
    });
    return { deleted };
  });

export const deleteContactMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const deleted = await runDeleteRpc(supabaseAdmin, "admin_delete_contact_messages", {
      p_ids: data.ids,
    });
    return { deleted };
  });

export const deleteSupportTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const deleted = await runDeleteRpc(supabaseAdmin, "admin_delete_support_tickets", {
      p_ids: data.ids,
    });
    return { deleted };
  });

export const deleteOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const deleted = await runDeleteRpc(supabaseAdmin, "admin_delete_orders", {
      p_ids: data.ids,
    });
    return { deleted };
  });

export const deleteCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    if (data.ids.includes(context.userId)) {
      throw new Error("You cannot delete your own account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const deleted = await runDeleteRpc(supabaseAdmin, "admin_delete_customers", {
      p_ids: data.ids,
      p_actor: context.userId,
    });
    return { deleted };
  });
