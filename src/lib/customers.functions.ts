import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePhoneKey } from "@/lib/company";
import { isMissingRelation } from "@/lib/supabase-errors";

const CRM_ROLES = ["super_admin", "ecommerce_manager", "rewards_manager"] as const;

async function requireCrmStaff(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
) {
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const list = (roles ?? []).map((row: { role: string }) => row.role);
  if (!list.some((role: string) => (CRM_ROLES as readonly string[]).includes(role))) {
    throw new Error("Staff access required for customers.");
  }
}

function missingCustomersHint(error: { code?: string; message?: string } | null) {
  if (!error) return null;
  if (isMissingRelation(error)) {
    return "CRM customers are not installed. Run supabase/migrations/20261026120000_crm_customers.sql (or npm run apply:crm-customers).";
  }
  return null;
}

const customerInput = z.object({
  fullName: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(7).max(40),
  email: z.string().trim().email().optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

function cleanOptional(value: string | undefined | null) {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCrmStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select(
        "id, full_name, phone, phone_key, email, location, notes, user_id, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    const hint = missingCustomersHint(error);
    if (hint) throw new Error(hint);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const searchCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().trim().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireCrmStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query;
    const phoneKey = normalizePhoneKey(q);
    let query = supabaseAdmin
      .from("customers")
      .select("id, full_name, phone, email, location")
      .order("full_name", { ascending: true })
      .limit(20);

    if (phoneKey.length >= 7) {
      query = query.or(
        `phone_key.eq.${phoneKey},full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
      );
    } else {
      query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    }

    const { data: rows, error } = await query;
    const hint = missingCustomersHint(error);
    if (hint) throw new Error(hint);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => customerInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireCrmStaff(context.supabase, context.userId);
    const phoneKey = normalizePhoneKey(data.phone);
    if (phoneKey.length < 9) throw new Error("Enter a valid phone number.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("id, full_name")
      .eq("phone_key", phoneKey)
      .maybeSingle();
    if (existing) {
      throw new Error(`A customer already exists for this phone (${existing.full_name}).`);
    }

    const email = cleanOptional(data.email);
    const { data: row, error } = await supabaseAdmin
      .from("customers")
      .insert({
        full_name: data.fullName.trim(),
        phone: data.phone.trim(),
        phone_key: phoneKey,
        email,
        location: cleanOptional(data.location),
        notes: cleanOptional(data.notes),
        created_by: context.userId,
      })
      .select("id, full_name, phone, email, location, notes, user_id, created_at")
      .single();
    const hint = missingCustomersHint(error);
    if (hint) throw new Error(hint);
    if (error) {
      if (error.code === "23505")
        throw new Error("A customer with that phone or email already exists.");
      throw new Error(error.message);
    }
    return row;
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => customerInput.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireCrmStaff(context.supabase, context.userId);
    const phoneKey = normalizePhoneKey(data.phone);
    if (phoneKey.length < 9) throw new Error("Enter a valid phone number.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: clash } = await supabaseAdmin
      .from("customers")
      .select("id, full_name")
      .eq("phone_key", phoneKey)
      .neq("id", data.id)
      .maybeSingle();
    if (clash) throw new Error(`Phone already used by ${clash.full_name}.`);

    const { data: row, error } = await supabaseAdmin
      .from("customers")
      .update({
        full_name: data.fullName.trim(),
        phone: data.phone.trim(),
        phone_key: phoneKey,
        email: cleanOptional(data.email),
        location: cleanOptional(data.location),
        notes: cleanOptional(data.notes),
      })
      .eq("id", data.id)
      .select("id, full_name, phone, email, location, notes, user_id, created_at, updated_at")
      .single();
    const hint = missingCustomersHint(error);
    if (hint) throw new Error(hint);
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireCrmStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count: invoiceCount, error: invError } = await supabaseAdmin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", data.id);
    if (invError && !isMissingRelation(invError)) throw new Error(invError.message);
    if ((invoiceCount ?? 0) > 0) {
      throw new Error("This customer has invoices. Remove or reassign those invoices first.");
    }

    const { count: orderCount, error: ordError } = await supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", data.id);
    if (ordError && !isMissingRelation(ordError)) throw new Error(ordError.message);
    if ((orderCount ?? 0) > 0) {
      throw new Error("This customer has orders. Unlink or remove those orders first.");
    }

    const { error } = await supabaseAdmin.from("customers").delete().eq("id", data.id);
    const hint = missingCustomersHint(error);
    if (hint) throw new Error(hint);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getCustomerDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireCrmStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customer, error } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    const hint = missingCustomersHint(error);
    if (hint) throw new Error(hint);
    if (error) throw new Error(error.message);
    if (!customer) throw new Error("Customer not found.");

    const { data: leads } = await supabaseAdmin
      .from("interest_leads")
      .select("id, product_name, status, phone, created_at")
      .eq("customer_id", data.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, status, document_kind, total_kes, issue_date")
      .eq("customer_id", data.id)
      .order("issue_date", { ascending: false })
      .limit(20);

    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, merchant_reference, status, total_kes, created_at, customer_phone")
      .eq("customer_id", data.id)
      .order("created_at", { ascending: false })
      .limit(20);

    return {
      customer,
      leads: leads ?? [],
      invoices: invoices ?? [],
      orders: orders ?? [],
    };
  });

export const convertLeadToCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ leadId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireCrmStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("interest_leads")
      .select("*")
      .eq("id", data.leadId)
      .maybeSingle();
    if (leadError) throw new Error(leadError.message);
    if (!lead) throw new Error("Lead not found.");
    if (lead.customer_id) {
      return { customerId: lead.customer_id, linked: true as const, created: false as const };
    }

    const phoneKey = normalizePhoneKey(lead.phone);
    if (phoneKey.length < 9) throw new Error("Lead phone is invalid; fix it before converting.");

    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("phone_key", phoneKey)
      .maybeSingle();

    let customerId = existing?.id ?? null;
    let created = false;

    if (!customerId) {
      const noteParts = [
        lead.notes ? `Lead notes: ${lead.notes}` : null,
        `From interest: ${lead.product_name}`,
      ].filter(Boolean);
      const { data: createdRow, error: createError } = await supabaseAdmin
        .from("customers")
        .insert({
          full_name: lead.full_name,
          phone: lead.phone,
          phone_key: phoneKey,
          email: lead.email,
          location: lead.location,
          notes: noteParts.join("\n") || null,
          created_by: context.userId,
        })
        .select("id")
        .single();
      const hint = missingCustomersHint(createError);
      if (hint) throw new Error(hint);
      if (createError) throw new Error(createError.message);
      customerId = createdRow.id;
      created = true;
    }

    const { error: linkError } = await supabaseAdmin
      .from("interest_leads")
      .update({ customer_id: customerId, status: "converted" })
      .eq("id", lead.id);
    if (linkError) throw new Error(linkError.message);

    return { customerId, linked: true as const, created };
  });

export const linkLeadToCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ leadId: z.string().uuid(), customerId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireCrmStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: lead, error: leadError } = await supabaseAdmin
      .from("interest_leads")
      .select("id, email, location, notes, customer_id")
      .eq("id", data.leadId)
      .maybeSingle();
    if (leadError) throw new Error(leadError.message);
    if (!lead) throw new Error("Lead not found.");

    const { data: customer, error: custError } = await supabaseAdmin
      .from("customers")
      .select("id, email, location, notes")
      .eq("id", data.customerId)
      .maybeSingle();
    if (custError) throw new Error(custError.message);
    if (!customer) throw new Error("Customer not found.");

    const patch: {
      email?: string;
      location?: string;
      notes?: string;
    } = {};
    if (!customer.email && lead.email) patch.email = lead.email;
    if (!customer.location && lead.location) patch.location = lead.location;
    if (!customer.notes && lead.notes) patch.notes = lead.notes;
    if (Object.keys(patch).length) {
      await supabaseAdmin.from("customers").update(patch).eq("id", customer.id);
    }

    const { error: linkError } = await supabaseAdmin
      .from("interest_leads")
      .update({ customer_id: customer.id, status: "converted" })
      .eq("id", lead.id);
    if (linkError) throw new Error(linkError.message);

    return { ok: true as const, customerId: customer.id };
  });

export const linkOrderToCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ orderId: z.string().uuid(), customerId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireCrmStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, customer_email, customer_phone, customer_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Order not found.");

    const { data: customer, error: custError } = await supabaseAdmin
      .from("customers")
      .select("id, full_name, phone, email, user_id")
      .eq("id", data.customerId)
      .maybeSingle();
    if (custError) throw new Error(custError.message);
    if (!customer) throw new Error("Customer not found.");

    const patch: {
      customer_id: string;
      customer_phone?: string;
      customer_email?: string | null;
      user_id?: string | null;
    } = { customer_id: customer.id };
    if (!order.customer_phone && customer.phone) patch.customer_phone = customer.phone;
    if (!order.customer_email && customer.email) patch.customer_email = customer.email;

    const { data: current } = await supabaseAdmin
      .from("orders")
      .select("user_id")
      .eq("id", order.id)
      .maybeSingle();
    if (!current?.user_id && customer.user_id) patch.user_id = customer.user_id;

    const { error: linkError } = await supabaseAdmin
      .from("orders")
      .update(patch)
      .eq("id", order.id);
    if (linkError) throw new Error(linkError.message);

    return { ok: true as const, customerId: customer.id, customerName: customer.full_name };
  });

/** Match order phone to CRM (create customer if needed), then link. */
export const convertOrderToCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireCrmStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, customer_email, customer_phone, customer_id, user_id, merchant_reference")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Order not found.");
    if (order.customer_id) {
      return { customerId: order.customer_id, linked: true as const, created: false as const };
    }

    const phone = order.customer_phone?.trim() ?? "";
    const phoneKey = normalizePhoneKey(phone);
    if (phoneKey.length < 9) {
      throw new Error("Order has no usable phone — link to an existing customer instead.");
    }

    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("phone_key", phoneKey)
      .maybeSingle();

    let customerId = existing?.id ?? null;
    let created = false;

    if (!customerId) {
      let fullName = order.customer_email?.split("@")[0] || "Customer";
      if (order.user_id) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("id", order.user_id)
          .maybeSingle();
        if (profile?.full_name) fullName = profile.full_name;
      }
      const { data: createdRow, error: createError } = await supabaseAdmin
        .from("customers")
        .insert({
          full_name: fullName,
          phone,
          phone_key: phoneKey,
          email: order.customer_email,
          notes: `From order ${order.merchant_reference}`,
          user_id: order.user_id,
          created_by: context.userId,
        })
        .select("id")
        .single();
      const hint = missingCustomersHint(createError);
      if (hint) throw new Error(hint);
      if (createError) throw new Error(createError.message);
      customerId = createdRow.id;
      created = true;
    }

    const { error: linkError } = await supabaseAdmin
      .from("orders")
      .update({ customer_id: customerId })
      .eq("id", order.id);
    if (linkError) throw new Error(linkError.message);

    return { customerId, linked: true as const, created };
  });

export const createOrderFromCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        customerId: z.string().uuid(),
        lines: z
          .array(
            z.object({
              productId: z.string().uuid(),
              quantity: z.number().int().min(1).max(999),
            }),
          )
          .min(1)
          .max(100),
        notes: z.string().trim().max(1000).optional().or(z.literal("")),
        issuePendingPayment: z.boolean().optional().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireCrmStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: customer, error: custError } = await supabaseAdmin
      .from("customers")
      .select("id, full_name, phone, email, user_id, location")
      .eq("id", data.customerId)
      .maybeSingle();
    if (custError) throw new Error(custError.message);
    if (!customer) throw new Error("Customer not found.");

    const productIds = data.lines.map((line) => line.productId);
    const { data: products, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, name, price_kes, stock, is_active")
      .in("id", productIds);
    if (productError) throw new Error(productError.message);
    if (!products || products.length !== productIds.length) {
      throw new Error("A product is no longer available.");
    }

    let subtotal = 0;
    const items = data.lines.map((line) => {
      const product = products.find((candidate) => candidate.id === line.productId)!;
      if (!product.is_active) throw new Error(`${product.name} is no longer available.`);
      if (product.stock < line.quantity) throw new Error(`Not enough stock for ${product.name}.`);
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

    const merchantReference = `AMP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const note = (data.notes ?? "").trim();
    const deliveryAddress = {
      recipient_name: customer.full_name,
      phone: customer.phone,
      county: "",
      town: customer.location ?? "",
      street: "",
      notes: note || "Staff order from CRM customer",
      landmark: "",
      mode: "pickup",
    };

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: customer.user_id,
        customer_id: customer.id,
        merchant_reference: merchantReference,
        subtotal_kes: subtotal,
        delivery_fee_kes: 0,
        points_redeemed: 0,
        discount_kes: 0,
        total_kes: Math.max(subtotal, 1),
        delivery_option: "pickup",
        delivery_address: deliveryAddress,
        customer_email: customer.email,
        customer_phone: customer.phone,
        status: data.issuePendingPayment ? "PENDING_PAYMENT" : "PAID",
        fulfilment_note: note || null,
      })
      .select("id, merchant_reference, total_kes, status")
      .single();
    if (orderError || !order) throw new Error(orderError?.message ?? "Could not create the order.");

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(items.map((item) => ({ ...item, order_id: order.id })));
    if (itemsError) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      throw new Error(itemsError.message);
    }

    if (data.issuePendingPayment) {
      const { error: paymentError } = await supabaseAdmin.from("payments").insert({
        order_id: order.id,
        merchant_reference: merchantReference,
        amount_kes: Number(order.total_kes),
        payment_method: "bank_transfer",
        internal_status: "PENDING_PAYMENT",
      });
      if (paymentError) throw new Error(paymentError.message);
    } else {
      const { error: stockError } = await supabaseAdmin.rpc("apply_order_stock", {
        p_order_id: order.id,
      });
      if (stockError) console.error("apply_order_stock", stockError);
      await supabaseAdmin.from("payments").insert({
        order_id: order.id,
        merchant_reference: merchantReference,
        amount_kes: Number(order.total_kes),
        payment_method: "bank_transfer",
        internal_status: "PAID",
        provider_status: "PAID",
      });
    }

    return {
      orderId: order.id,
      merchantReference: order.merchant_reference,
      totalKes: Number(order.total_kes),
      status: order.status,
    };
  });
