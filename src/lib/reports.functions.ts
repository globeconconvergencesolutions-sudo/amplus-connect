import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isMissingRelation } from "@/lib/supabase-errors";
import {
  buildStockSalesWorkbook,
  reportFilename,
  type ReportLead,
  type ReportOrderLine,
  type ReportProduct,
} from "@/lib/reports.workbook.server";

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

function startOfDayIso(date: string) {
  return `${date}T00:00:00.000Z`;
}

function endOfDayIso(date: string) {
  return `${date}T23:59:59.999Z`;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIsoDate(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const filterSchema = z.object({
  mode: z.enum(["all", "brand", "category"]),
  brand: z.string().trim().max(120).optional().default(""),
  categoryId: z.string().uuid().optional().nullable(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function familyLabel(
  mode: "all" | "brand" | "category",
  brand: string,
  categoryName: string | null,
) {
  if (mode === "brand" && brand) return brand;
  if (mode === "category" && categoryName) return categoryName;
  if (mode === "category") return "Category";
  return "All products";
}

function productMatchesFamily(
  product: { id: string; name: string; brand: string | null; category_id: string | null },
  mode: "all" | "brand" | "category",
  brand: string,
  categoryId: string | null | undefined,
) {
  if (mode === "all") return true;
  if (mode === "category") {
    return Boolean(categoryId) && product.category_id === categoryId;
  }
  const needle = brand.trim().toLowerCase();
  if (!needle) return false;
  const brandHit = (product.brand ?? "").toLowerCase() === needle;
  const nameHit = product.name.toLowerCase().includes(needle);
  return brandHit || nameHit;
}

export const listReportFilters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: products, error: productError }, { data: categories, error: catError }] =
      await Promise.all([
        supabaseAdmin.from("products").select("brand").order("brand"),
        supabaseAdmin.from("categories").select("id, name, slug").order("name"),
      ]);
    if (productError) throw new Error(productError.message);
    if (catError) throw new Error(catError.message);

    const brands = [
      ...new Set(
        (products ?? []).map((row) => (row.brand ?? "").trim()).filter((brand) => brand.length > 0),
      ),
    ].sort((a, b) => a.localeCompare(b));

    return {
      brands,
      categories: categories ?? [],
      defaults: {
        fromDate: daysAgoIsoDate(30),
        toDate: todayIsoDate(),
      },
    };
  });

export const generateStockSalesReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => filterSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireStaff(context.supabase, context.userId);

    if (data.fromDate > data.toDate) {
      throw new Error("From date must be on or before the to date.");
    }
    if (data.mode === "brand" && !data.brand.trim()) {
      throw new Error("Choose a brand / product family.");
    }
    if (data.mode === "category" && !data.categoryId) {
      throw new Error("Choose a category.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: productRows, error: productError } = await supabaseAdmin
      .from("products")
      .select(
        "id, name, slug, brand, unit, price_kes, stock, is_active, category_id, categories(name)",
      )
      .order("name");
    if (productError) throw new Error(productError.message);

    type ProductRow = {
      id: string;
      name: string;
      slug: string;
      brand: string | null;
      unit: string;
      price_kes: number;
      stock: number;
      is_active: boolean;
      category_id: string | null;
      categories: { name: string } | { name: string }[] | null;
    };

    const allProducts = (productRows ?? []) as unknown as ProductRow[];
    const matched = allProducts.filter((product) =>
      productMatchesFamily(product, data.mode, data.brand, data.categoryId),
    );

    const categoryName =
      data.mode === "category"
        ? (() => {
            const hit = allProducts.find((p) => p.category_id === data.categoryId);
            const cat = hit?.categories;
            if (Array.isArray(cat)) return cat[0]?.name ?? null;
            return cat?.name ?? null;
          })()
        : null;

    const label = familyLabel(data.mode, data.brand.trim(), categoryName);
    const productIds = new Set(matched.map((p) => p.id));

    const products: ReportProduct[] = matched.map((p) => {
      const cat = p.categories;
      const category_name = Array.isArray(cat) ? (cat[0]?.name ?? null) : (cat?.name ?? null);
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand: p.brand,
        unit: p.unit,
        price_kes: Number(p.price_kes),
        stock: Number(p.stock),
        is_active: p.is_active,
        category_name,
      };
    });

    const fromIso = startOfDayIso(data.fromDate);
    const toIso = endOfDayIso(data.toDate);

    const { data: orders, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        "id, merchant_reference, status, created_at, customer_email, customer_phone, user_id, order_items(id, product_id, product_name, quantity, unit_price_kes, line_total_kes)",
      )
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: true });
    if (orderError) throw new Error(orderError.message);

    const userIds = [
      ...new Set((orders ?? []).map((order) => order.user_id).filter(Boolean)),
    ] as string[];
    const profileById = new Map<string, string | null>();
    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (profileError) throw new Error(profileError.message);
      for (const profile of profiles ?? []) {
        profileById.set(profile.id, profile.full_name);
      }
    }

    const brandNeedle = data.brand.trim().toLowerCase();
    const lines: ReportOrderLine[] = [];
    for (const order of orders ?? []) {
      const items = order.order_items ?? [];
      for (const item of items) {
        const inFamily =
          data.mode === "all"
            ? true
            : item.product_id
              ? productIds.has(item.product_id)
              : data.mode === "brand" &&
                Boolean(brandNeedle) &&
                item.product_name.toLowerCase().includes(brandNeedle);

        if (!inFamily) continue;

        lines.push({
          orderId: order.id,
          merchantReference: order.merchant_reference,
          status: order.status,
          createdAt: order.created_at,
          customerEmail: order.customer_email,
          customerPhone: order.customer_phone,
          customerName: profileById.get(order.user_id) ?? null,
          productId: item.product_id,
          productName: item.product_name,
          quantity: Number(item.quantity),
          unitPriceKes: Number(item.unit_price_kes),
          lineTotalKes: Number(item.line_total_kes),
        });
      }
    }

    let leads: ReportLead[] = [];
    {
      const { data: leadRows, error: leadError } = await supabaseAdmin
        .from("interest_leads")
        .select(
          "created_at, full_name, phone, email, location, product_name, product_id, quantity, status, notes",
        )
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true });
      if (isMissingRelation(leadError)) {
        leads = [];
      } else if (leadError) {
        throw new Error(leadError.message);
      } else {
        leads = (leadRows ?? [])
          .filter((lead) => {
            if (data.mode === "all") return true;
            if (lead.product_id && productIds.has(lead.product_id)) return true;
            if (data.mode === "brand" && data.brand.trim()) {
              return lead.product_name.toLowerCase().includes(data.brand.trim().toLowerCase());
            }
            return false;
          })
          .map((lead) => ({
            createdAt: lead.created_at,
            fullName: lead.full_name,
            phone: lead.phone,
            email: lead.email,
            location: lead.location,
            productName: lead.product_name,
            quantity: lead.quantity == null ? null : Number(lead.quantity),
            status: lead.status,
            notes: lead.notes,
          }));
      }
    }

    const generatedAt = new Date();
    const buffer = await buildStockSalesWorkbook({
      familyLabel: label,
      fromDate: data.fromDate,
      toDate: data.toDate,
      generatedAt,
      products,
      lines,
      leads,
    });

    const filename = reportFilename(label, data.fromDate, data.toDate);

    return {
      filename,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: buffer.toString("base64"),
      meta: {
        familyLabel: label,
        productCount: products.length,
        salesLineCount: lines.filter((l) =>
          ["PAID", "FULFILLED", "SHIPPED", "DELIVERED"].includes(l.status),
        ).length,
        openLineCount: lines.filter((l) =>
          ["PENDING_PAYMENT", "PAYMENT_PROCESSING"].includes(l.status),
        ).length,
        leadCount: leads.length,
      },
    };
  });
