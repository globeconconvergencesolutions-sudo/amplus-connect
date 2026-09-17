import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const lineSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(999) });

const createOrderSchema = z.object({
  lines: z.array(lineSchema).min(1),
  deliveryOption: z.string().min(1),
  deliveryFee: z.number().min(0),
  pointsToRedeem: z.number().int().min(0).default(0),
  address: z.object({
    recipient_name: z.string().min(2),
    phone: z.string().min(7),
    county: z.string().optional().default(""),
    town: z.string().optional().default(""),
    street: z.string().optional().default(""),
    notes: z.string().optional().default(""),
  }),
  origin: z.string().url(),
});

/**
 * Creates the internal order (server-side pricing) and starts a Pesapal payment.
 * Returns the Pesapal redirect URL to load inside the checkout iframe.
 */
export const createOrderAndStartPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createOrderSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    const productIds = data.lines.map((line) => line.productId);
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, name, price_kes, stock, is_active")
      .in("id", productIds);
    if (productError) throw new Error(productError.message);
    if (!products || products.length !== productIds.length) throw new Error("A product is no longer available");

    let subtotal = 0;
    const items = data.lines.map((line) => {
      const product = products.find((candidate) => candidate.id === line.productId)!;
      if (!product.is_active) throw new Error(`${product.name} is no longer available`);
      if (product.stock < line.quantity) throw new Error(`Not enough stock for ${product.name}`);
      const unitPrice = Number(product.price_kes);
      const lineTotal = unitPrice * line.quantity;
      subtotal += lineTotal;
      return {
        product_id: product.id,
        product_name: product.name,
        unit_price_kes: unitPrice,
        quantity: line.quantity,
        line_total_kes: lineTotal,
      };
    });

    const { data: settings } = await supabase
      .from("loyalty_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    const { data: profile } = await supabase
      .from("profiles")
      .select("loyalty_points, phone, full_name")
      .eq("id", userId)
      .maybeSingle();

    const pointValue = Number(settings?.point_value_kes ?? 1);
    const maxPercent = Number(settings?.max_redeem_percent ?? 20);
    const availablePoints = Number(profile?.loyalty_points ?? 0);
    const maxDiscount = (subtotal * maxPercent) / 100;
    const pointsRedeemed = Math.min(
      data.pointsToRedeem,
      availablePoints,
      Math.floor(maxDiscount / Math.max(pointValue, 0.01)),
    );
    const discount = pointsRedeemed * pointValue;
    const total = Math.max(subtotal + data.deliveryFee - discount, 1);
    const merchantReference = `AMP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        merchant_reference: merchantReference,
        subtotal_kes: subtotal,
        delivery_fee_kes: data.deliveryFee,
        points_redeemed: pointsRedeemed,
        discount_kes: discount,
        total_kes: total,
        delivery_option: data.deliveryOption,
        delivery_address: data.address,
        customer_email: (claims as { email?: string }).email ?? null,
        customer_phone: data.address.phone,
      })
      .select("id, merchant_reference, total_kes")
      .single();
    if (orderError || !order) throw new Error(orderError?.message ?? "Could not create the order");

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(items.map((item) => ({ ...item, order_id: order.id })));
    if (itemsError) throw new Error(itemsError.message);

    const { pesapalConfigured, getToken, registerIpn, submitOrder } = await import("./pesapal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (pointsRedeemed > 0) {
      await supabaseAdmin.from("loyalty_transactions").insert({
        user_id: userId,
        order_id: order.id,
        points: -pointsRedeemed,
        kind: "redeemed",
        note: `Redeemed against order ${merchantReference}`,
      });
      await supabaseAdmin
        .from("profiles")
        .update({ loyalty_points: availablePoints - pointsRedeemed })
        .eq("id", userId);
    }

    if (!pesapalConfigured()) {
      return {
        orderId: order.id,
        merchantReference,
        total: Number(order.total_kes),
        redirectUrl: null as string | null,
        message:
          "Payments are not connected yet. The order has been saved and can be paid once the payment keys are added.",
      };
    }

    const token = await getToken();
    const notificationId = await registerIpn(token, `${data.origin}/api/public/pesapal/ipn`);
    const { orderTrackingId, redirectUrl } = await submitOrder(token, {
      merchantReference,
      amount: Number(order.total_kes),
      description: `Amplus order ${merchantReference}`,
      callbackUrl: `${data.origin}/checkout/result?ref=${merchantReference}`,
      cancellationUrl: `${data.origin}/cart`,
      notificationId,
      email: (claims as { email?: string }).email ?? null,
      phone: data.address.phone,
      firstName: profile?.full_name ?? data.address.recipient_name,
    });

    await supabaseAdmin.from("payments").insert({
      order_id: order.id,
      merchant_reference: merchantReference,
      order_tracking_id: orderTrackingId,
      amount_kes: Number(order.total_kes),
      internal_status: "PENDING_PAYMENT",
    });

    return {
      orderId: order.id,
      merchantReference,
      total: Number(order.total_kes),
      redirectUrl,
      message: null as string | null,
    };
  });

/**
 * Authoritative payment check. The callback is never trusted on its own:
 * the status always comes from Pesapal GetTransactionStatus.
 */
export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ merchantReference: z.string().min(3) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, total_kes, merchant_reference, points_awarded, user_id")
      .eq("merchant_reference", data.merchantReference)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order || order.user_id !== userId) throw new Error("Order not found");

    const { reconcileOrder } = await import("./reconcile.server");
    return reconcileOrder(order.merchant_reference, "callback");
  });
