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
  customerId: z.string().uuid().nullable().optional(),
  documentKind: z.enum(["invoice", "proforma"]).default("invoice"),
  referenceText: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  ),
  taxRatePercent: z.number().min(0).max(100).default(16),
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
    document_kind?: string | null;
    reference_text?: string | null;
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
  const kind = invoice.document_kind === "proforma" ? "proforma" : "invoice";
  return {
    invoiceNumber: invoice.invoice_number,
    status: invoice.status,
    documentKind: kind as "invoice" | "proforma",
    referenceText: invoice.reference_text ?? null,
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
      document_kind: data.documentKind,
      reference_text: data.referenceText,
      issue_date: data.issueDate,
      due_date: data.dueDate,
      customer_name: data.customerName,
      customer_email: data.customerEmail,
      customer_phone: data.customerPhone,
      customer_pin: data.customerPin,
      customer_address: data.customerAddress,
      customer_lpo: data.customerLpo,
      customer_id: data.customerId ?? null,
      order_id: data.orderId ?? null,
      subtotal_kes: subtotal,
      tax_rate_percent: data.taxRatePercent,
      tax_kes: tax,
      total_kes: total,
      notes: data.notes,
      remarks: data.remarks,
      delivery_meta: data.deliveryMeta,
      payment_terms: data.paymentTerms ?? "Full payment to be done with order",
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
        "id, invoice_number, status, document_kind, reference_text, customer_id, issue_date, due_date, customer_name, customer_phone, customer_email, total_kes, tax_kes, subtotal_kes, order_id, created_at",
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

    const mapped = mapInvoicePdf(invoice, items ?? []);
    const buffer = await buildInvoicePdf(mapped);
    return {
      filename: invoicePdfFilename(invoice.invoice_number, mapped.documentKind),
      mimeType: "application/pdf",
      base64: buffer.toString("base64"),
    };
  });

/**
 * Emails the PDF when the invoice has an email; otherwise returns a WhatsApp share link
 * so staff can send the downloaded PDF that way.
 */
export const deliverInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        invoiceId: z.string().uuid(),
        /** When true and email exists, send mail. Always returns share hints. */
        sendEmail: z.boolean().optional().default(true),
      })
      .parse(data),
  )
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

    const mapped = mapInvoicePdf(invoice, items ?? []);
    const buffer = await buildInvoicePdf(mapped);
    const filename = invoicePdfFilename(invoice.invoice_number, mapped.documentKind);
    const base64 = buffer.toString("base64");

    const { invoiceWhatsAppShareHref, sendInvoicePdfEmail } =
      await import("@/lib/invoice-mail.server");
    const whatsappHref = invoiceWhatsAppShareHref({
      customerPhone: mapped.customerPhone,
      invoiceNumber: mapped.invoiceNumber,
      documentKind: mapped.documentKind,
      totalKes: mapped.totalKes,
    });

    const hasEmail = Boolean(mapped.customerEmail?.trim());
    let emailSent = false;
    let emailReason: "no_email" | "mail_not_configured" | "send_failed" | undefined;

    if (data.sendEmail && hasEmail) {
      const result = await sendInvoicePdfEmail({
        invoiceNumber: mapped.invoiceNumber,
        documentKind: mapped.documentKind,
        customerName: mapped.customerName,
        customerEmail: mapped.customerEmail,
        customerPhone: mapped.customerPhone,
        issueDate: mapped.issueDate,
        totalKes: mapped.totalKes,
        filename,
        pdfBase64: base64,
      });
      emailSent = result.sent;
      emailReason = result.reason;
      if (!result.sent && result.reason === "mail_not_configured") {
        throw new Error(
          "Email is not configured. Add GMAIL_USER + GMAIL_APP_PASSWORD (or Resend) to send invoice PDFs.",
        );
      }
      if (!result.sent && result.reason === "send_failed") {
        throw new Error("Could not send the invoice email. Try downloading the PDF instead.");
      }
    } else if (!hasEmail) {
      emailReason = "no_email";
    }

    return {
      filename,
      mimeType: "application/pdf",
      base64,
      hasEmail,
      emailSent,
      emailReason,
      customerEmail: mapped.customerEmail,
      customerPhone: mapped.customerPhone,
      whatsappHref,
      invoiceNumber: mapped.invoiceNumber,
    };
  });

export const createInvoiceFromOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        taxRatePercent: z.number().min(0).max(100).optional().default(16),
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
        "id, merchant_reference, customer_email, customer_phone, customer_id, delivery_address, user_id, customers(full_name, email, phone, location), order_items(product_id, product_name, quantity, unit_price_kes)",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Order not found.");

    const crm =
      order.customers && !Array.isArray(order.customers)
        ? (order.customers as {
            full_name: string;
            email: string | null;
            phone: string;
            location: string | null;
          })
        : null;

    let customerName = crm?.full_name || order.customer_email?.split("@")[0] || "Customer";
    let profileEmail: string | null = null;
    if (!crm && order.user_id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", order.user_id)
        .maybeSingle();
      if (profile?.full_name) customerName = profile.full_name;
      profileEmail = profile?.email ?? null;
    }

    let addressText: string | null = crm?.location ?? null;
    if (!addressText && order.delivery_address && typeof order.delivery_address === "object") {
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
      customerEmail: crm?.email || order.customer_email || profileEmail,
      customerPhone: crm?.phone || order.customer_phone || null,
      customerPin: null,
      customerAddress: addressText,
      customerLpo: order.merchant_reference,
      customerId: order.customer_id ?? null,
      documentKind: "invoice",
      referenceText: order.merchant_reference,
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
