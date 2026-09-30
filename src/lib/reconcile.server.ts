import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getToken, getTransactionStatus, mapStatus, pesapalConfigured } from "./pesapal.server";
import { mapPaystackStatus, paystackConfigured, verifyTransaction } from "./paystack.server";
import { notifyOrderPaid } from "./order-mail.server";

export type ReconcileResult = {
  status: string;
  providerStatus: string | null;
  confirmationCode: string | null;
  paymentMethod: string | null;
  merchantReference: string;
};

/**
 * Idempotently brings an internal order in line with the gateway.
 * Paystack is used when the payment was started there (or Paystack is the
 * only configured PoC gateway); otherwise Pesapal.
 */
export async function reconcileOrder(
  merchantReference: string,
  source: "callback" | "ipn",
  orderTrackingIdHint?: string,
): Promise<ReconcileResult> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, status, total_kes, points_awarded, merchant_reference, customer_email")
    .eq("merchant_reference", merchantReference)
    .maybeSingle();
  if (!order) throw new Error("Order not found");

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("merchant_reference", merchantReference)
    .maybeSingle();

  const usePaystack =
    paystackConfigured() &&
    (payment?.payment_method === "paystack" || (!payment && paystackConfigured()));

  if (usePaystack) {
    const charge = await verifyTransaction(merchantReference);
    const providerStatus = (charge.status ?? "pending").toUpperCase();
    const internalStatus = mapPaystackStatus(charge.status);
    const confirmationCode = charge.reference ?? payment?.confirmation_code ?? null;
    const displayMethod = charge.channel ?? "paystack";
    const timestampField =
      source === "ipn" ? { ipn_at: new Date().toISOString() } : { callback_at: new Date().toISOString() };

    if (payment) {
      await supabaseAdmin
        .from("payments")
        .update({
          payment_method: "paystack",
          confirmation_code: confirmationCode,
          provider_status: providerStatus,
          internal_status: internalStatus,
          provider_response: JSON.parse(JSON.stringify(charge)),
          ...timestampField,
        })
        .eq("id", payment.id);
    } else {
      await supabaseAdmin.from("payments").insert({
        order_id: order.id,
        merchant_reference: merchantReference,
        amount_kes: Number(order.total_kes),
        payment_method: "paystack",
        confirmation_code: confirmationCode,
        provider_status: providerStatus,
        internal_status: internalStatus,
        provider_response: JSON.parse(JSON.stringify(charge)),
        ...timestampField,
      });
    }

    await applySettlement(order, merchantReference, internalStatus);

    return {
      status: settledStatus(order.status, internalStatus),
      providerStatus,
      confirmationCode,
      paymentMethod: displayMethod,
      merchantReference,
    };
  }

  const trackingId = orderTrackingIdHint ?? payment?.order_tracking_id ?? null;
  if (!pesapalConfigured() || !trackingId) {
    return {
      status: order.status,
      providerStatus: payment?.provider_status ?? null,
      confirmationCode: payment?.confirmation_code ?? null,
      paymentMethod: payment?.payment_method ?? null,
      merchantReference,
    };
  }

  const token = await getToken();
  const status = await getTransactionStatus(token, trackingId);
  const providerStatus = (status.payment_status_description ?? "PENDING").toUpperCase();
  const internalStatus = mapStatus(providerStatus);

  const timestampField = source === "ipn" ? { ipn_at: new Date().toISOString() } : { callback_at: new Date().toISOString() };

  if (payment) {
    await supabaseAdmin
      .from("payments")
      .update({
        order_tracking_id: trackingId,
        payment_method: status.payment_method ?? payment.payment_method,
        masked_account: status.payment_account ?? payment.masked_account,
        confirmation_code: status.confirmation_code ?? payment.confirmation_code,
        provider_status: providerStatus,
        internal_status: internalStatus,
        provider_response: JSON.parse(JSON.stringify(status)),
        ...timestampField,
      })
      .eq("id", payment.id);
  } else {
    await supabaseAdmin.from("payments").insert({
      order_id: order.id,
      merchant_reference: merchantReference,
      order_tracking_id: trackingId,
      amount_kes: Number(order.total_kes),
      payment_method: status.payment_method ?? null,
      masked_account: status.payment_account ?? null,
      confirmation_code: status.confirmation_code ?? null,
      provider_status: providerStatus,
      internal_status: internalStatus,
      provider_response: JSON.parse(JSON.stringify(status)),
      ...timestampField,
    });
  }

  await applySettlement(order, merchantReference, internalStatus);

  return {
    status: settledStatus(order.status, internalStatus),
    providerStatus,
    confirmationCode: status.confirmation_code ?? null,
    paymentMethod: status.payment_method ?? null,
    merchantReference,
  };
}

function settledStatus(current: string, next: string): string {
  const settled = ["PAID", "FULFILLED", "SHIPPED", "DELIVERED", "CANCELLED"];
  if (settled.includes(current) && next !== "PAYMENT_REVERSED") return current;
  return next;
}

async function applySettlement(
  order: {
    id: string;
    user_id: string;
    status: string;
    total_kes: number | string;
    points_awarded: boolean | null;
    customer_email: string | null;
  },
  merchantReference: string,
  internalStatus: ReturnType<typeof mapStatus> | ReturnType<typeof mapPaystackStatus>,
) {
  const settled = ["PAID", "FULFILLED", "SHIPPED", "DELIVERED", "CANCELLED"];
  if (!settled.includes(order.status) || internalStatus === "PAYMENT_REVERSED") {
    await supabaseAdmin.from("orders").update({ status: internalStatus }).eq("id", order.id);
  }

  if (internalStatus === "PAYMENT_REVERSED") {
    const { error: reverseError } = await supabaseAdmin.rpc("reverse_order_stock", {
      p_order_id: order.id,
    });
    if (reverseError) console.error("reverse_order_stock", reverseError);
  }

  if (internalStatus === "PAID") {
    const { error: stockError } = await supabaseAdmin.rpc("apply_order_stock", {
      p_order_id: order.id,
    });
    if (stockError) console.error("apply_order_stock", stockError);
  }

  if (internalStatus === "PAID" && !order.points_awarded) {
    const { data: settings } = await supabaseAdmin
      .from("loyalty_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    const kesPerPoint = Number(settings?.kes_per_point ?? 100);
    const earned = Math.floor(Number(order.total_kes) / Math.max(kesPerPoint, 1));

    const { error: txError } = await supabaseAdmin.from("loyalty_transactions").insert({
      user_id: order.user_id,
      order_id: order.id,
      points: earned,
      kind: "earned",
      note: `Earned on order ${merchantReference}`,
    });

    if (!txError) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("loyalty_points")
        .eq("id", order.user_id)
        .maybeSingle();
      const newBalance = Number(profile?.loyalty_points ?? 0) + earned;
      const silver = Number(settings?.silver_threshold ?? 500);
      const gold = Number(settings?.gold_threshold ?? 2000);
      const tier = newBalance >= gold ? "gold" : newBalance >= silver ? "silver" : "bronze";
      await supabaseAdmin
        .from("profiles")
        .update({ loyalty_points: newBalance, tier })
        .eq("id", order.user_id);
    }

    await supabaseAdmin.from("orders").update({ points_awarded: true }).eq("id", order.id);

    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("product_name, quantity, line_total_kes")
      .eq("order_id", order.id);
    const { data: fullOrder } = await supabaseAdmin
      .from("orders")
      .select("delivery_option, customer_email")
      .eq("id", order.id)
      .maybeSingle();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", order.user_id)
      .maybeSingle();
    await notifyOrderPaid({
      merchantReference,
      totalKes: Number(order.total_kes),
      customerEmail: fullOrder?.customer_email ?? order.customer_email,
      customerName: profile?.full_name ?? null,
      deliveryOption: fullOrder?.delivery_option ?? null,
      items: (items ?? []).map((item) => ({
        name: item.product_name,
        quantity: item.quantity,
        lineTotal: Number(item.line_total_kes),
      })),
    });
  }
}

export async function applyPaidOrder(merchantReference: string) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, status, total_kes, points_awarded, merchant_reference, customer_email")
    .eq("merchant_reference", merchantReference)
    .maybeSingle();
  if (!order) throw new Error("Order not found");
  await applySettlement(order, merchantReference, "PAID");
  return order;
}
