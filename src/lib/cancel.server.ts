import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isMissingRelation } from "@/lib/supabase-errors";
import type { CartLine } from "@/lib/cart";

export type CancelledOrderItem = {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_kes: number;
};

export type CancelOrderResult = {
  already: boolean;
  pointsRestored: number;
  merchantReference: string;
  cartLines: CartLine[];
};

function isMissingRpc(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "PGRST202" || /cancel_unpaid_order/i.test(error.message ?? "");
}

type RpcPayload = {
  ok?: boolean;
  already?: boolean;
  points_restored?: number;
  merchant_reference?: string;
  items?: CancelledOrderItem[];
};

async function hydrateCartLines(items: CancelledOrderItem[]): Promise<CartLine[]> {
  const ids = items.map((item) => item.product_id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, slug, price_kes, unit, image_url, is_active")
    .in("id", ids);
  const byId = new Map((products ?? []).map((row) => [row.id, row]));
  const lines: CartLine[] = [];
  for (const item of items) {
    if (!item.product_id) continue;
    const product = byId.get(item.product_id);
    if (!product?.is_active) continue;
    lines.push({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      unitPrice: Number(product.price_kes),
      unit: product.unit,
      imageUrl: product.image_url,
      quantity: item.quantity,
    });
  }
  return lines;
}

function parseItems(raw: unknown): CancelledOrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const quantity = Number(item["quantity"]);
    const unitPrice = Number(item["unit_price_kes"]);
    if (!Number.isFinite(quantity) || quantity < 1) return [];
    return [
      {
        product_id: typeof item["product_id"] === "string" ? item["product_id"] : null,
        product_name: String(item["product_name"] ?? "Item"),
        quantity,
        unit_price_kes: Number.isFinite(unitPrice) ? unitPrice : 0,
      },
    ];
  });
}

async function cancelInApp(orderId: string, allowProcessing: boolean): Promise<CancelOrderResult> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, status, points_redeemed, merchant_reference")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("Order not found");

  const { data: itemRows } = await supabaseAdmin
    .from("order_items")
    .select("product_id, product_name, quantity, unit_price_kes")
    .eq("order_id", orderId);
  const items = (itemRows ?? []) as CancelledOrderItem[];
  const cartLines = await hydrateCartLines(items);

  if (order.status === "CANCELLED") {
    return {
      already: true,
      pointsRestored: 0,
      merchantReference: order.merchant_reference,
      cartLines,
    };
  }

  const blocked = ["PAID", "FULFILLED", "SHIPPED", "DELIVERED", "REFUND_REQUESTED"];
  if (blocked.includes(order.status)) {
    throw new Error("This order is already paid or fulfilled and cannot be cancelled");
  }
  if (order.status === "PAYMENT_PROCESSING" && !allowProcessing) {
    throw new Error("This order is waiting for payment confirmation");
  }
  const allowed = ["PENDING_PAYMENT", "PAYMENT_FAILED", "PAYMENT_PROCESSING", "PAYMENT_REVERSED"];
  if (!allowed.includes(order.status)) {
    throw new Error("This order cannot be cancelled");
  }

  await supabaseAdmin.rpc("reverse_order_stock", { p_order_id: orderId });

  let pointsRestored = 0;
  if (order.points_redeemed > 0) {
    const { data: existing } = await supabaseAdmin
      .from("loyalty_transactions")
      .select("id")
      .eq("order_id", orderId)
      .eq("kind", "redeem_restored")
      .maybeSingle();
    if (!existing) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("loyalty_points")
        .eq("id", order.user_id)
        .maybeSingle();
      await supabaseAdmin
        .from("profiles")
        .update({ loyalty_points: Number(profile?.loyalty_points ?? 0) + order.points_redeemed })
        .eq("id", order.user_id);
      await supabaseAdmin.from("loyalty_transactions").insert({
        user_id: order.user_id,
        order_id: orderId,
        points: order.points_redeemed,
        kind: "redeem_restored",
        note: `Restored after cancelling ${order.merchant_reference}`,
      });
      pointsRestored = order.points_redeemed;
    }
  }

  await supabaseAdmin
    .from("payments")
    .update({
      internal_status: "CANCELLED",
      provider_status: "CANCELLED",
    })
    .eq("order_id", orderId);

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      status: "CANCELLED",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (updateError && !/cancelled_at/i.test(updateError.message)) {
    throw new Error(updateError.message);
  }
  if (updateError) {
    const { error: fallback } = await supabaseAdmin
      .from("orders")
      .update({ status: "CANCELLED" })
      .eq("id", orderId);
    if (fallback) throw new Error(fallback.message);
  }

  return {
    already: false,
    pointsRestored,
    merchantReference: order.merchant_reference,
    cartLines,
  };
}

export async function cancelUnpaidOrderRecord(
  orderId: string,
  allowProcessing: boolean,
): Promise<CancelOrderResult> {
  const { data, error } = await supabaseAdmin.rpc("cancel_unpaid_order", {
    p_order_id: orderId,
    p_allow_processing: allowProcessing,
  });
  if (isMissingRpc(error) || isMissingRelation(error)) {
    return cancelInApp(orderId, allowProcessing);
  }
  if (error) throw new Error(error.message);
  const payload = (data ?? {}) as RpcPayload;
  const items = parseItems(payload.items);
  return {
    already: Boolean(payload.already),
    pointsRestored: Number(payload.points_restored ?? 0),
    merchantReference: String(payload.merchant_reference ?? ""),
    cartLines: await hydrateCartLines(items),
  };
}

export async function sendDueAbandonedReminders(origin: string) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: due, error } = await supabaseAdmin
    .from("orders")
    .select("id, customer_email, merchant_reference, total_kes, user_id, reminder_sent_at")
    .eq("status", "PENDING_PAYMENT")
    .is("reminder_sent_at", null)
    .lt("created_at", cutoff)
    .not("customer_email", "is", null)
    .limit(40);
  if (error) {
    if (isMissingRelation(error) || /reminder_sent_at/i.test(error.message)) {
      return { sent: 0, skipped: 0, reason: "schema" as const };
    }
    throw new Error(error.message);
  }

  const { notifyAbandonedOrder } = await import("@/lib/order-mail.server");
  let sent = 0;
  let skipped = 0;
  for (const order of due ?? []) {
    if (!order.customer_email) {
      skipped += 1;
      continue;
    }
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("orders")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", order.id)
      .is("reminder_sent_at", null)
      .eq("status", "PENDING_PAYMENT")
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) {
      skipped += 1;
      continue;
    }

    const [{ data: items }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("order_items").select("product_name, quantity").eq("order_id", order.id),
      supabaseAdmin.from("profiles").select("full_name").eq("id", order.user_id).maybeSingle(),
    ]);

    const ok = await notifyAbandonedOrder({
      customerEmail: order.customer_email,
      customerName: profile?.full_name ?? null,
      merchantReference: order.merchant_reference,
      totalKes: Number(order.total_kes),
      items: (items ?? []).map((item) => ({ name: item.product_name, quantity: item.quantity })),
      payUrl: `${origin.replace(/\/$/, "")}/account?tab=orders`,
    });
    if (!ok) {
      await supabaseAdmin.from("orders").update({ reminder_sent_at: null }).eq("id", order.id);
      skipped += 1;
      continue;
    }
    sent += 1;
  }

  return { sent, skipped, reason: null as string | null };
}
