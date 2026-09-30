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
 * Creates the internal order (server-side pricing) and records a bank-transfer payment.
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

    const email = (claims as { email?: string }).email ?? null;

    const { error: paymentError } = await supabaseAdmin.from("payments").insert({
      order_id: order.id,
      merchant_reference: merchantReference,
      amount_kes: Number(order.total_kes),
      payment_method: "bank_transfer",
      internal_status: "PENDING_PAYMENT",
    });
    if (paymentError) throw new Error(paymentError.message);

    return {
      orderId: order.id,
      merchantReference,
      total: Number(order.total_kes),
      provider: "bank_transfer" as const,
      email,
      amountKes: Number(order.total_kes),
      message: null as string | null,
    };
  });

/**
 * Returns the stored order status. Bank transfers are confirmed by staff, not a gateway.
 */
export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ merchantReference: z.string().min(3) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, total_kes, merchant_reference, user_id, delivery_option, fulfilment_note")
      .eq("merchant_reference", data.merchantReference)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order || order.user_id !== userId) throw new Error("Order not found");

    const { data: payment } = await supabase
      .from("payments")
      .select("confirmation_code, payment_method, provider_status, internal_status")
      .eq("merchant_reference", data.merchantReference)
      .maybeSingle();

    return {
      status: order.status,
      providerStatus: payment?.provider_status ?? payment?.internal_status ?? null,
      confirmationCode: payment?.confirmation_code ?? null,
      paymentMethod: payment?.payment_method ?? null,
      merchantReference: order.merchant_reference,
      totalKes: Number(order.total_kes),
      deliveryOption: order.delivery_option,
      fulfilmentNote: order.fulfilment_note,
    };
  });

export const reportBankPaymentSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        merchantReference: z.string().min(3),
        confirmationCode: z.string().trim().min(4).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, user_id, merchant_reference, total_kes")
      .eq("merchant_reference", data.merchantReference)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order || order.user_id !== userId) throw new Error("Order not found");

    const settled = ["PAID", "FULFILLED", "SHIPPED", "DELIVERED", "CANCELLED"];
    if (settled.includes(order.status)) {
      return { status: order.status };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const note = data.confirmationCode.trim();
    const { error: orderError } = await supabaseAdmin
      .from("orders")
      .update({ status: "PAYMENT_PROCESSING" })
      .eq("id", order.id);
    if (orderError) throw new Error(orderError.message);

    const paymentPatch = {
      internal_status: "PAYMENT_PROCESSING" as const,
      provider_status: "CUSTOMER_REPORTED",
      confirmation_code: note,
      payment_method: "bank_transfer",
      callback_at: new Date().toISOString(),
    };

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("order_id", order.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from("payments")
        .update(paymentPatch)
        .eq("id", existing.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await supabaseAdmin.from("payments").insert({
        order_id: order.id,
        merchant_reference: order.merchant_reference,
        amount_kes: Number(order.total_kes),
        ...paymentPatch,
      });
      if (insertError) throw new Error(insertError.message);
    }

    return { status: "PAYMENT_PROCESSING" as const };
  });

export const confirmBankPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ merchantReference: z.string().min(3) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    if (!(roles ?? []).length) throw new Error("You do not have permission to confirm payments.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applyPaidOrder } = await import("./reconcile.server");

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, merchant_reference")
      .eq("merchant_reference", data.merchantReference)
      .maybeSingle();
    if (!order) throw new Error("Order not found");

    await supabaseAdmin
      .from("payments")
      .update({
        payment_method: "bank_transfer",
        internal_status: "PAID",
        provider_status: "STAFF_CONFIRMED",
        ipn_at: new Date().toISOString(),
      })
      .eq("merchant_reference", data.merchantReference);

    await applyPaidOrder(data.merchantReference);
    return { status: "PAID" as const, merchantReference: data.merchantReference };
  });
