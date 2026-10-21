import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  DeliveryBand,
  DeliveryDropPoint,
  DeliveryQuote,
  DeliverySettings,
} from "@/lib/delivery";
import { haversineKm, pickBand, roadKm } from "@/lib/delivery";

export const quoteInputSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("pickup") }),
  z.object({ mode: z.literal("drop_point"), dropPointId: z.string().uuid() }),
  z.object({
    mode: z.literal("site_pin"),
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
  }),
]);

export type QuoteInput = z.infer<typeof quoteInputSchema>;

async function loadCatalog() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const settingsRes = await supabaseAdmin
    .from("delivery_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (settingsRes.error) throw new Error(settingsRes.error.message);
  const bandsRes = await supabaseAdmin
    .from("delivery_bands")
    .select("*")
    .order("sort_order", { ascending: true });
  if (bandsRes.error) throw new Error(bandsRes.error.message);
  const pointsRes = await supabaseAdmin
    .from("delivery_drop_points")
    .select("*")
    .eq("is_active", true);
  if (pointsRes.error) throw new Error(pointsRes.error.message);
  return {
    settings: settingsRes.data as DeliverySettings | null,
    bands: (bandsRes.data ?? []) as DeliveryBand[],
    points: (pointsRes.data ?? []) as DeliveryDropPoint[],
  };
}

export async function computeDeliveryQuote(input: QuoteInput): Promise<DeliveryQuote> {
  if (input.mode === "pickup") {
    return {
      allowed: true,
      mode: "pickup",
      feeKes: 0,
      km: 0,
      etaDays: 0,
      message: null,
      dropPointId: null,
      lat: null,
      lng: null,
    };
  }

  const { settings, bands, points } = await loadCatalog();
  if (!settings || bands.length === 0) {
    return {
      allowed: false,
      mode: input.mode,
      feeKes: 0,
      km: 0,
      etaDays: 0,
      message:
        "Delivery pricing is not set up yet. Choose yard collection, or ask staff to apply the delivery SQL.",
      dropPointId: null,
      lat: null,
      lng: null,
    };
  }

  let dest = { lat: 0, lng: 0 };
  let dropPoint: DeliveryDropPoint | null = null;
  if (input.mode === "drop_point") {
    dropPoint = points.find((row) => row.id === input.dropPointId) ?? null;
    if (!dropPoint) {
      return {
        allowed: false,
        mode: "drop_point",
        feeKes: 0,
        km: 0,
        etaDays: 0,
        message: "That drop point is no longer available.",
        dropPointId: input.dropPointId,
        lat: null,
        lng: null,
      };
    }
    dest = { lat: Number(dropPoint.lat), lng: Number(dropPoint.lng) };
  } else {
    dest = { lat: input.lat, lng: input.lng };
  }

  const km = roadKm(
    haversineKm({ lat: Number(settings.hq_lat), lng: Number(settings.hq_lng) }, dest),
    Number(settings.road_factor),
  );
  const roundedKm = Math.round(km * 10) / 10;

  if (dropPoint?.fee_override_kes != null) {
    return {
      allowed: true,
      mode: "drop_point",
      feeKes: Number(dropPoint.fee_override_kes),
      km: roundedKm,
      etaDays: dropPoint.eta_days_override ?? 2,
      message: null,
      dropPointId: dropPoint.id,
      lat: dest.lat,
      lng: dest.lng,
    };
  }

  if (roundedKm > Number(settings.max_km)) {
    const phone = settings.quote_phone?.trim();
    return {
      allowed: false,
      mode: input.mode,
      feeKes: 0,
      km: roundedKm,
      etaDays: 0,
      message: phone
        ? `This location is about ${roundedKm} km from the yard (beyond our standard radius). Call ${phone} for a custom truck quote.`
        : `This location is about ${roundedKm} km from the yard. Call Amplus for a custom truck quote.`,
      dropPointId: dropPoint?.id ?? null,
      lat: dest.lat,
      lng: dest.lng,
    };
  }

  const band = pickBand(roundedKm, bands);
  if (!band) {
    return {
      allowed: false,
      mode: input.mode,
      feeKes: 0,
      km: roundedKm,
      etaDays: 0,
      message: "No delivery band covers this distance. Call the yard for a quote.",
      dropPointId: dropPoint?.id ?? null,
      lat: dest.lat,
      lng: dest.lng,
    };
  }

  return {
    allowed: true,
    mode: input.mode,
    feeKes: Number(band.fee_kes),
    km: roundedKm,
    etaDays: band.eta_days,
    message: null,
    dropPointId: dropPoint?.id ?? null,
    lat: dest.lat,
    lng: dest.lng,
  };
}

export const quoteDelivery = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => quoteInputSchema.parse(data))
  .handler(async ({ data }) => computeDeliveryQuote(data));

const placeSearchSchema = z.object({
  query: z.string().trim().min(2).max(120),
});

export type KenyaPlace = { lat: number; lng: number; label: string };

/** Nominatim blocks browser calls that omit a User-Agent, so the shop searches from the server. */
export const searchKenyaPlace = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => placeSearchSchema.parse(data))
  .handler(async ({ data }): Promise<KenyaPlace[]> => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("countrycodes", "ke");
    url.searchParams.set("limit", "5");
    url.searchParams.set("q", data.query);
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "AmplusConnect/1.0 (yard delivery search)",
      },
    });
    if (!res.ok) {
      throw new Error("Place search is busy. Drop a pin on the map.");
    }
    const rows = (await res.json()) as { lat?: string; lon?: string; display_name?: string }[];
    return rows
      .map((row) => ({
        lat: Number(row.lat),
        lng: Number(row.lon),
        label: row.display_name?.trim() || data.query,
      }))
      .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));
  });
