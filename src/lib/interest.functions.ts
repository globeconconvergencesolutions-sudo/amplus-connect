import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isMissingRelation } from "@/lib/supabase-errors";

const phoneSchema = z
  .string()
  .trim()
  .min(9, "Enter a valid phone number")
  .max(32)
  .regex(/^[\d+\s().-]{9,32}$/, "Enter a valid phone number");

const emptyToNull = (value: unknown) => {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

const submitSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().trim().min(1).max(200),
  productSlug: z.string().trim().min(1).max(200).nullable().optional(),
  productUnit: z.string().trim().min(1).max(40).nullable().optional(),
  unitPriceKes: z.number().nonnegative().nullable().optional(),
  fullName: z.string().trim().min(2, "Enter your name").max(120),
  phone: phoneSchema,
  location: z.string().trim().min(2, "Enter your location").max(200),
  email: z.preprocess(
    emptyToNull,
    z.string().trim().email("Enter a valid email").max(160).nullable(),
  ),
  quantity: z.preprocess((value) => {
    if (value == null || value === "") return null;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(n, 1_000_000);
  }, z.number().positive().max(1_000_000).nullable()),
  notes: z.preprocess(
    emptyToNull,
    z.string().trim().max(2000, "Keep notes under 2000 characters").nullable(),
  ),
  /** Honeypot — bots fill this; humans leave it empty. */
  website: z.string().max(200).optional().default(""),
});

export const submitInterestLead = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    if (data.website) {
      return {
        ok: true as const,
        leadId: null as string | null,
        mailedStaff: false,
        mailedCustomer: false,
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, name, slug, unit, price_kes, is_active")
      .eq("id", data.productId)
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (!product || !product.is_active) {
      throw new Error("That product is no longer available. Browse the shop and try another item.");
    }

    const payload = {
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      product_unit: product.unit,
      unit_price_kes: Number(product.price_kes),
      full_name: data.fullName,
      phone: data.phone,
      location: data.location,
      email: data.email,
      quantity: data.quantity,
      notes: data.notes,
      status: "new" as const,
    };

    const { data: lead, error } = await supabaseAdmin
      .from("interest_leads")
      .insert(payload)
      .select("id")
      .single();

    if (isMissingRelation(error)) {
      throw new Error(
        "Interest leads are not installed yet. Run supabase/migrations/20261019120000_interest_leads.sql in the Supabase SQL editor.",
      );
    }
    if (error || !lead)
      throw new Error(error?.message ?? "Could not save your interest. Please try again.");

    const mailPayload = {
      id: lead.id,
      productName: product.name,
      productSlug: product.slug,
      productUnit: product.unit,
      unitPriceKes: Number(product.price_kes),
      fullName: data.fullName,
      phone: data.phone,
      location: data.location,
      email: data.email,
      quantity: data.quantity,
      notes: data.notes,
    };

    const { notifyInterestCustomer, notifyInterestStaff } =
      await import("@/lib/interest-mail.server");
    const [mailedStaff, mailedCustomer] = await Promise.all([
      notifyInterestStaff(mailPayload),
      data.email ? notifyInterestCustomer(mailPayload) : Promise.resolve(false),
    ]);

    return {
      ok: true as const,
      leadId: lead.id,
      mailedStaff,
      mailedCustomer,
    };
  });
