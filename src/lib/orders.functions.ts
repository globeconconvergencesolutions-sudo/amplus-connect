import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const cancelMyUnpaidOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("id, user_id, status")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order || order.user_id !== context.userId) throw new Error("Order not found");
    if (order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_FAILED") {
      throw new Error("Only unpaid orders can be cancelled from your account.");
    }
    const { cancelUnpaidOrderRecord } = await import("@/lib/cancel.server");
    return cancelUnpaidOrderRecord(order.id, false);
  });

export const staffCancelUnpaidOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        allowProcessing: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    if (!(roles ?? []).length) throw new Error("Staff access required.");
    const { cancelUnpaidOrderRecord } = await import("@/lib/cancel.server");
    return cancelUnpaidOrderRecord(data.orderId, data.allowProcessing);
  });

export const sendDueOrderReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ origin: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    if (!(roles ?? []).length) throw new Error("Staff access required.");
    const { mailConfigured } = await import("@/lib/mail.server");
    if (!mailConfigured()) {
      throw new Error("Add GMAIL_USER and GMAIL_APP_PASSWORD (or Resend) to send reminders.");
    }
    const { sendDueAbandonedReminders } = await import("@/lib/cancel.server");
    return sendDueAbandonedReminders(data.origin);
  });

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    if (!(roles ?? []).length) throw new Error("Staff access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (orders ?? []).map((row) => row.id);
    const { data: payments, error: payError } = ids.length
      ? await supabaseAdmin.from("payments").select("*").in("order_id", ids)
      : { data: [] as never[], error: null };
    if (payError) throw new Error(payError.message);

    const payRows = payments ?? [];
    const byOrder = new Map<string, (typeof payRows)[number][]>();
    for (const payment of payRows) {
      const list = byOrder.get(payment.order_id) ?? [];
      list.push(payment);
      byOrder.set(payment.order_id, list);
    }

    return (orders ?? []).map((order) => ({
      ...order,
      payments: byOrder.get(order.id) ?? [],
    }));
  });

export const staffAdvanceFulfilment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        note: z.string().trim().max(500).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    if (!(roles ?? []).length) throw new Error("Staff access required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { nextFulfilment } = await import("@/lib/fulfilment");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, status, delivery_option, merchant_reference, total_kes, customer_email, user_id, fulfilment_note",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found");

    const next = nextFulfilment(order.status, order.delivery_option);
    if (!next) throw new Error("This order has no further delivery step.");

    const now = new Date().toISOString();
    const note = data.note.trim() || order.fulfilment_note || null;
    const patch: {
      status: typeof next.status;
      fulfilment_note: string | null;
      prepared_at?: string;
      shipped_at?: string;
      delivered_at?: string;
    } = {
      status: next.status,
      fulfilment_note: note,
    };
    if (next.status === "FULFILLED") patch.prepared_at = now;
    if (next.status === "SHIPPED") patch.shipped_at = now;
    if (next.status === "DELIVERED") patch.delivered_at = now;

    let { error: updateError } = await supabaseAdmin.from("orders").update(patch).eq("id", order.id);
    if (updateError && /prepared_at|shipped_at|delivered_at/i.test(updateError.message)) {
      const fallback = await supabaseAdmin
        .from("orders")
        .update({ status: next.status, fulfilment_note: note })
        .eq("id", order.id);
      updateError = fallback.error;
    }
    if (updateError) throw new Error(updateError.message);

    const [{ data: items }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("order_items").select("product_name, quantity, line_total_kes").eq("order_id", order.id),
      supabaseAdmin.from("profiles").select("full_name").eq("id", order.user_id).maybeSingle(),
    ]);
    const { notifyFulfilmentStage } = await import("@/lib/order-mail.server");
    await notifyFulfilmentStage({
      customerEmail: order.customer_email,
      customerName: profile?.full_name ?? null,
      merchantReference: order.merchant_reference,
      totalKes: Number(order.total_kes),
      deliveryOption: order.delivery_option,
      status: next.status,
      note,
      items: (items ?? []).map((item) => ({
        name: item.product_name,
        quantity: item.quantity,
        lineTotal: Number(item.line_total_kes),
      })),
    });

    return { status: next.status, label: next.label };
  });
