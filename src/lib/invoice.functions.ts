import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isMissingRelation } from "@/lib/supabase-errors";
import { buildInvoicePdf, invoicePdfFilename } from "@/lib/invoice-pdf.server";

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

const emptyToNull = (value: unknown) => {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

const lineSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1).max(400),
  quantity: z.number().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(40).default("pc"),
  unitPriceKes: z.number().min(0).max(100_000_000),
});

const invoiceBodySchema = z.object({
  customerName: z.string().trim().min(2).max(200),
  customerEmail: z.preprocess(emptyToNull, z.string().trim().email().max(160).nullable()),
  customerPhone: z.preprocess(emptyToNull, z.string().trim().max(40).nullable()),
  customerPin: z.preprocess(emptyToNull, z.string().trim().max(40).nullable()),
  customerAddress: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
  customerLpo: z.preprocess(emptyToNull, z.string().trim().max(80).nullable()),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  ),
  taxRatePercent: z.number().min(0).max(100).default(0),
  notes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
  remarks: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
  deliveryMeta: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
  paymentTerms: z.preprocess(emptyToNull, z.string().trim().max(200).nullable()),
  orderId: z.string().uuid().nullable().optional(),
  items: z.array(lineSchema).min(1).max(100),
  issueNow: z.boolean().optional().default(true),
});

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function computeTotals(items: z.infer<typeof lineSchema>[], taxRatePercent: number) {
  const lines = items.map((item, index) => {
    const lineTotal = round2(item.quantity * item.unitPriceKes);
    return {
      product_id: item.productId ?? null,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit || "pc",
      unit_price_kes: round2(item.unitPriceKes),
      line_total_kes: lineTotal,
      sort_order: index,
    };
  });
  const subtotal = round2(lines.reduce((s, row) => s + row.line_total_kes, 0));
  const tax = round2(subtotal * (taxRatePercent / 100));
  const total = round2(subtotal + tax);
  return { lines, subtotal, tax, total };
}

function missingInvoicesError(error: { code?: string; message?: string } | null) {
  if (!isMissingRelation(error)) return null;
  return "Invoices are not installed yet. Run supabase/migrations/20261019140000_invoices.sql (or npm run apply:invoices).";
}

async function allocateInvoiceNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<string> {
  const { data, error } = await admin.rpc("allocate_invoice_number");
  if (!error && data != null) return String(data);

  const { data: rows } = await admin
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", "9%")
    .order("invoice_number", { ascending: false })
    .limit(1);
  const last = rows?.[0]?.invoice_number as string | undefined;
  if (last && /^\d+$/.test(last)) return String(BigInt(last) + 1n);
  return String(9002003500 + Math.floor(Math.random() * 80));
}

function mapInvoicePdf(
  invoice: {
    invoice_number: string;
    status: string;
    issue_date: string;
    due_date: string | null;
    customer_name: string;
    customer_email: string | null;
    customer_phone: string | null;
    customer_pin: string | null;
    customer_address: string | null;
    customer_lpo: string | null;
    notes: string | null;
    remarks: string | null;
    delivery_meta: string | null;
    payment_terms: string | null;
    tax_rate_percent: number;
    subtotal_kes: number;
    tax_kes: number;
    total_kes: number;
  },
  items: {
    description: string;
    quantity: number;
    unit: string;
    unit_price_kes: number;
    line_total_kes: number;
  }[],
) {
  return {
    invoiceNumber: invoice.invoice_number,
    status: invoice.status,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    customerName: invoice.customer_name,
    customerEmail: invoice.customer_email,
    customerPhone: invoice.customer_phone,
    customerPin: invoice.customer_pin,
    customerAddress: invoice.customer_address,
    customerLpo: invoice.customer_lpo,
    notes: invoice.notes,
    remarks: invoice.remarks,
    deliveryMeta: invoice.delivery_meta,
    paymentTerms: invoice.payment_terms,
    taxRatePercent: Number(invoice.tax_rate_percent),
    subtotalKes: Number(invoice.subtotal_kes),
    taxKes: Number(invoice.tax_kes),
    totalKes: Number(invoice.total_kes),
    items: items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unit: item.unit,
      unitPriceKes: Number(item.unit_price_kes),
      lineTotalKes: Number(item.line_total_kes),
    })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertInvoice(admin: any, userId: string, data: z.infer<typeof invoiceBodySchema>) {
  const { lines, subtotal, tax, total } = computeTotals(data.items, data.taxRatePercent);
  const invoiceNumber = await allocateInvoiceNumber(admin);
  const status = data.issueNow ? "issued" : "draft";

  const { data: invoice, error } = await admin
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      status,
      issue_date: data.issueDate,
      due_date: data.dueDate,
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      customer_pin: data.customerPin,
      customer_address: data.customerAddress,
      customer_lpo: data.customerLpo,
      order_id: data.orderId ?? null,
      subtotal_kes: subtotal,
      tax_rate_percent: data.taxRatePercent,
      tax_kes: tax,
      total_kes: total,
      notes: data.notes,
      remarks: data.remarks,
      delivery_meta: data.deliveryMeta,
      payment_terms: data.paymentTerms ?? "Advance payment / as agreed",
      created_by: userId,
    })
    .select("*")
    .single();

  const missing = missingInvoicesError(error);
  if (missing) throw new Error(missing);
  if (error || !invoice) throw new Error(error?.message ?? "Could not create invoice.");

  const { error: itemsError } = await admin
    .from("invoice_items")
    .insert(lines.map((line) => ({ ...line, invoice_id: invoice.id })));
  if (itemsError) {
    await admin.from("invoices").delete().eq("id", invoice.id);
    throw new Error(itemsError.message);
  }

  return {
    id: invoice.id as string,
    invoiceNumber: invoice.invoice_number as string,
    status: invoice.status as string,
  };
}

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .select(
        "id, invoice_number, status, issue_date, due_date, customer_name, customer_phone, customer_email, total_kes, tax_kes, subtotal_kes, order_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    const missing = missingInvoicesError(error);
    if (missing) throw new Error(missing);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ invoiceId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", data.invoiceId)
      .maybeSingle();
    const missing = missingInvoicesError(error);
    if (missing) throw new Error(missing);
    if (error) throw new Error(error.message);
    if (!invoice) throw new Error("Invoice not found.");

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("sort_order", { ascending: true });
    if (itemsError) throw new Error(itemsError.message);

    return { invoice, items: items ?? [] };
  });

export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => invoiceBodySchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return insertInvoice(supabaseAdmin, context.userId, data);
  });

export const updateInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        invoiceId: z.string().uuid(),
        status: z.enum(["draft", "issued", "paid", "void"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("invoices")
      .select("id, status")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!existing) throw new Error("Invoice not found.");
    if (existing.status === "void") throw new Error("Void invoices cannot be changed.");

    const { error } = await supabaseAdmin
      .from("invoices")
      .update({ status: data.status })
      .eq("id", data.invoiceId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const downloadInvoicePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ invoiceId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", data.invoiceId)
      .maybeSingle();
    const missing = missingInvoicesError(error);
    if (missing) throw new Error(missing);
    if (error) throw new Error(error.message);
    if (!invoice) throw new Error("Invoice not found.");

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("sort_order", { ascending: true });
    if (itemsError) throw new Error(itemsError.message);

    const buffer = await buildInvoicePdf(mapInvoicePdf(invoice, items ?? []));
    return {
      filename: invoicePdfFilename(invoice.invoice_number),
      mimeType: "application/pdf",
      base64: buffer.toString("base64"),
    };
  });

export const createInvoiceFromOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        taxRatePercent: z.number().min(0).max(100).optional().default(0),
        issueNow: z.boolean().optional().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, merchant_reference, customer_email, customer_phone, delivery_address, user_id, order_items(product_id, product_name, quantity, unit_price_kes)",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found.");

    let customerName = order.customer_email?.split("@")[0] || "Customer";
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", order.user_id)
      .maybeSingle();
    if (profile?.full_name) customerName = profile.full_name;

    let addressText: string | null = null;
    if (order.delivery_address && typeof order.delivery_address === "object") {
      const a = order.delivery_address as Record<string, unknown>;
      addressText = [a["street"], a["town"], a["county"], a["notes"]]
        .filter((v) => typeof v === "string" && v.trim())
        .join(", ");
    }

    const items = (order.order_items ?? []).map((item) => ({
      productId: item.product_id,
      description: item.product_name,
      quantity: Number(item.quantity),
      unit: "pc",
      unitPriceKes: Number(item.unit_price_kes),
    }));
    if (items.length === 0) throw new Error("That order has no line items.");

    return insertInvoice(supabaseAdmin, context.userId, {
      customerName,
      customerEmail: order.customer_email || profile?.email || null,
      customerPhone: order.customer_phone || null,
      customerPin: null,
      customerAddress: addressText,
      customerLpo: order.merchant_reference,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: null,
      taxRatePercent: data.taxRatePercent,
      notes: `Generated from order ${order.merchant_reference}.`,
      remarks: null,
      deliveryMeta: null,
      paymentTerms: "As per order",
      orderId: order.id,
      items,
      issueNow: data.issueNow,
    });
  });

export const listProductsForInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("id, name, unit, price_kes, brand, stock, is_active")
      .eq("is_active", true)
      .order("name")
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listRecentOrdersForInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id, merchant_reference, customer_email, total_kes, status, created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
