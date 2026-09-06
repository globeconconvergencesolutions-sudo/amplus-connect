import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getToken, getTransactionStatus, mapStatus, pesapalConfigured } from "./pesapal.server";

export type ReconcileResult = {
  status: string;
  providerStatus: string | null;
  confirmationCode: string | null;
  paymentMethod: string | null;
  merchantReference: string;
};

/**
 * Idempotently brings an internal order in line with the authoritative
 * Pesapal transaction status. Safe to call from both the callback and the IPN.
 */
export async function reconcileOrder(
  merchantReference: string,
  source: "callback" | "ipn",
  orderTrackingIdHint?: string,
): Promise<ReconcileResult> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, status, total_kes, points_awarded, merchant_reference")
    .eq("merchant_reference", merchantReference)
    .maybeSingle();
  if (!order) throw new Error("Order not found");

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("merchant_reference", merchantReference)
    .maybeSingle();

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

  // Never move an order backwards out of a settled state.
  const settled = ["PAID", "FULFILLED", "SHIPPED", "DELIVERED", "CANCELLED"];
  if (!settled.includes(order.status) || internalStatus === "PAYMENT_REVERSED") {
    await supabaseAdmin.from("orders").update({ status: internalStatus }).eq("id", order.id);
  }

  if (internalStatus === "PAID" && !order.points_awarded) {
    const { data: settings } = await supabaseAdmin
      .from("loyalty_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    const kesPerPoint = Number(settings?.kes_per_point ?? 100);
    const earned = Math.floor(Number(order.total_kes) / Math.max(kesPerPoint, 1));

    // unique(order_id, kind) makes repeated notifications harmless
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
  }

  return {
    status: internalStatus,
    providerStatus,
    confirmationCode: status.confirmation_code ?? null,
    paymentMethod: status.payment_method ?? null,
    merchantReference,
  };
}
