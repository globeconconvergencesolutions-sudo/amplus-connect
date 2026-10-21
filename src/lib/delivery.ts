export const DELIVERY_MODES = ["pickup", "drop_point", "site_pin"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export type DeliverySettings = {
  id: number;
  hq_label: string;
  hq_lat: number;
  hq_lng: number;
  road_factor: number;
  max_km: number;
  quote_phone: string | null;
};

export type DeliveryBand = {
  id: string;
  km_from: number;
  km_to: number;
  fee_kes: number;
  eta_days: number;
  sort_order: number;
};

export type DeliveryDropPoint = {
  id: string;
  name: string;
  county: string;
  town: string;
  landmark: string;
  lat: number;
  lng: number;
  fee_override_kes: number | null;
  eta_days_override: number | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
};

export type DeliveryAddress = {
  recipient_name: string;
  phone: string;
  county: string;
  town: string;
  street: string;
  notes: string;
  landmark?: string;
  lat?: number;
  lng?: number;
  km?: number;
  eta_days?: number;
  drop_point_id?: string;
  drop_point_name?: string;
  mode?: DeliveryMode;
};

export type DeliveryQuote = {
  allowed: boolean;
  mode: DeliveryMode;
  feeKes: number;
  km: number;
  etaDays: number;
  message: string | null;
  dropPointId: string | null;
  lat: number | null;
  lng: number | null;
};

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(x)));
}

export function roadKm(straightKm: number, roadFactor: number) {
  return straightKm * Math.max(1, roadFactor);
}

export function pickBand(km: number, bands: DeliveryBand[]): DeliveryBand | null {
  const sorted = [...bands].sort((a, b) => a.sort_order - b.sort_order || a.km_from - b.km_from);
  return sorted.find((band) => km >= Number(band.km_from) && km < Number(band.km_to)) ?? null;
}

export function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function parseDeliveryAddress(value: unknown): DeliveryAddress | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const parsed: DeliveryAddress = {
    recipient_name: String(row["recipient_name"] ?? ""),
    phone: String(row["phone"] ?? ""),
    county: String(row["county"] ?? ""),
    town: String(row["town"] ?? ""),
    street: String(row["street"] ?? ""),
    notes: String(row["notes"] ?? ""),
  };
  const landmark = row["landmark"];
  if (typeof landmark === "string" && landmark.trim()) parsed.landmark = landmark;
  const lat = row["lat"];
  const lng = row["lng"];
  if (typeof lat === "number" && typeof lng === "number") {
    parsed.lat = lat;
    parsed.lng = lng;
  }
  const km = row["km"];
  if (typeof km === "number") parsed.km = km;
  const eta = row["eta_days"];
  if (typeof eta === "number") parsed.eta_days = eta;
  const dropId = row["drop_point_id"];
  if (typeof dropId === "string") parsed.drop_point_id = dropId;
  const dropName = row["drop_point_name"];
  if (typeof dropName === "string") parsed.drop_point_name = dropName;
  const mode = row["mode"];
  if (typeof mode === "string" && DELIVERY_MODES.includes(mode as DeliveryMode)) {
    parsed.mode = mode as DeliveryMode;
  }
  return parsed;
}

export function formatDeliveryDestination(
  option: string | null | undefined,
  address?: unknown,
): string {
  const parsed = parseDeliveryAddress(address);
  if (option === "pickup" || parsed?.mode === "pickup") {
    return "Collect from Amplus yard, Mombasa Road";
  }
  if (parsed?.drop_point_name) {
    const bits = [parsed.drop_point_name, parsed.landmark, parsed.town, parsed.county].filter(
      Boolean,
    );
    return [...new Set(bits)].join(" · ");
  }
  if (parsed?.landmark || parsed?.town || parsed?.county) {
    return [parsed.landmark || parsed.street, parsed.town, parsed.county]
      .filter(Boolean)
      .join(", ");
  }
  if (option === "drop_point") return "Delivery to a drop point";
  if (option === "site_pin") return "Site / pin delivery";
  return option?.replaceAll("-", " ") || "Delivery";
}

export const KENYA_COUNTIES = [
  "Baringo",
  "Bomet",
  "Bungoma",
  "Busia",
  "Elgeyo-Marakwet",
  "Embu",
  "Garissa",
  "Homa Bay",
  "Isiolo",
  "Kajiado",
  "Kakamega",
  "Kericho",
  "Kiambu",
  "Kilifi",
  "Kirinyaga",
  "Kisii",
  "Kisumu",
  "Kitui",
  "Kwale",
  "Laikipia",
  "Lamu",
  "Machakos",
  "Makueni",
  "Mandera",
  "Marsabit",
  "Meru",
  "Migori",
  "Mombasa",
  "Murang'a",
  "Nairobi",
  "Nakuru",
  "Nandi",
  "Narok",
  "Nyamira",
  "Nyandarua",
  "Nyeri",
  "Samburu",
  "Siaya",
  "Taita-Taveta",
  "Tana River",
  "Tharaka-Nithi",
  "Trans Nzoia",
  "Turkana",
  "Uasin Gishu",
  "Vihiga",
  "Wajir",
  "West Pokot",
] as const;
