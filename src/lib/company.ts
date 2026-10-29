function publicEnv(key: string, fallback: string): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
  const fromVite = env?.[key];
  if (typeof fromVite === "string" && fromVite.trim()) return fromVite.trim();
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  if (typeof fromProcess === "string" && fromProcess.trim()) return fromProcess.trim();
  return fallback;
}

/** Brand hexes shared by emails / PDF (site uses CSS tokens). */
export const BRAND = {
  purple: "#401850",
  purpleDeep: "#2E1038",
  orange: "#F4911E",
  orangeDark: "#D87830",
  paper: "#FAF7F2",
  muted: "#78716C",
  ink: "#1C1917",
  border: "#E7E0D6",
} as const;

export const COMPANY = {
  name: "Amplus Construction Solutions",
  legalName: publicEnv("VITE_COMPANY_LEGAL_NAME", "Amplus Construction Solutions Ltd"),
  shortName: "Amplus",
  tagline: "BUILDING BETTER TOMORROW, NOW",
  website: publicEnv("VITE_COMPANY_WEBSITE", "https://www.amplusconstructionsolutions.com"),
  phone: publicEnv("VITE_COMPANY_PHONE", "+254 723 507 050"),
  phoneAlt: publicEnv("VITE_COMPANY_PHONE_ALT", "+254 720 849 888"),
  email: publicEnv("VITE_COMPANY_EMAIL", "dm@amplusconstructionsolutions.com"),
  address: publicEnv("VITE_COMPANY_ADDRESS", "Amplus House, Mombasa Road, Nairobi, Kenya"),
  postal: publicEnv("VITE_COMPANY_POSTAL", "P. O. Box 37910-00100"),
  hours: publicEnv("VITE_COMPANY_HOURS", "Mon – Fri, 8:00 – 17:30 · Sat, 8:00 – 13:00"),
  mapQuery: publicEnv("VITE_COMPANY_MAP_QUERY", "Mombasa Road, Nairobi, Kenya"),
  /** KRA PIN shown on invoices. */
  pin: publicEnv("VITE_COMPANY_PIN", "P052539280U"),
  /** Optional 254… digits. Empty means derive from phone. */
  whatsapp: publicEnv("VITE_COMPANY_WHATSAPP", ""),
  /** Public Facebook page (International social; on-site name stays Construction). */
  facebook: publicEnv("VITE_COMPANY_FACEBOOK", "https://www.facebook.com/share/19XaKKGVF2/"),
};

/**
 * Amplus encourages collection from the yard and runs no deliveries for now.
 * Flip to false to bring back drop points and site pins at checkout.
 */
export const COLLECTION_ONLY = true;

/** Google Maps directions to the Amplus yard. */
export const YARD_DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(COMPANY.address)}`;

export const DELIVERY_OPTIONS = [
  { id: "nairobi-standard", label: "Nairobi metro delivery (2 working days)", fee: 1500 },
  { id: "nairobi-express", label: "Nairobi express delivery (next day)", fee: 3000 },
  { id: "upcountry", label: "Upcountry delivery (3 – 5 working days)", fee: 4500 },
  { id: "pickup", label: "Collect from Amplus yard, Mombasa Road", fee: 0 },
];

export const BANK_ACCOUNT = {
  accountName: publicEnv("VITE_BANK_ACCOUNT_NAME", "Amplus Construction Solutions Ltd"),
  bankName: publicEnv("VITE_BANK_NAME", "Equity Bank"),
  branch: publicEnv("VITE_BANK_BRANCH", "Mombasa road"),
  accountNumber: publicEnv("VITE_BANK_ACCOUNT_NUMBER", "1080287515296"),
  paybill: publicEnv("VITE_BANK_PAYBILL", "247247"),
};

export const CHECKOUT_PAYMENT_NOTE = `You will get Lipa na M-Pesa Pay Bill steps (${BANK_ACCOUNT.paybill}) and Equity bank details on the next page.`;

/** Digits only, Kenya format for wa.me. */
export function phoneToWhatsAppE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0") && digits.length >= 9) return `254${digits.slice(1)}`;
  return digits;
}

/** Normalize phone for CRM uniqueness (digits only, Kenya 254…). */
export function normalizePhoneKey(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length >= 9) digits = `254${digits.slice(1)}`;
  else if (digits.length === 9) digits = `254${digits}`;
  return digits;
}

export function companyContactStrip(): string {
  const phones = [COMPANY.phone, COMPANY.phoneAlt].filter(Boolean).join("|");
  const site = COMPANY.website.replace(/^https?:\/\//, "");
  return `${site}|${COMPANY.email}|${phones}|${COMPANY.postal}`;
}

export function supportLinks(input?: {
  ticketNumber?: string;
  orderRef?: string;
  amountKes?: number;
}) {
  const lines = ["Hello Amplus, I need support."];
  if (input?.ticketNumber) lines.push(`Ticket: ${input.ticketNumber}`);
  if (input?.orderRef) lines.push(`Order: ${input.orderRef}`);
  if (input?.amountKes != null) {
    lines.push(`Amount: KES ${Math.round(input.amountKes).toLocaleString("en-KE")}`);
  }
  if (input?.ticketNumber || input?.orderRef) {
    lines.push("Please follow up on this ticket.");
  }
  return {
    callHref: `tel:${COMPANY.phone.replace(/\s/g, "")}`,
    whatsappHref: whatsappLink(lines.join(" ")),
  };
}

/** wa.me link to the Amplus line with a prefilled message. */
export function whatsappLink(text: string): string {
  const whatsappSource = COMPANY.whatsapp || COMPANY.phone;
  return `https://wa.me/${phoneToWhatsAppE164(whatsappSource)}?text=${encodeURIComponent(text)}`;
}

const PHONE_SPEC_KEYS = new Set([
  "order line",
  "also call",
  "phone",
  "telephone",
  "tel",
  "call",
  "mobile",
  "whatsapp",
]);

const EMAIL_SPEC_KEYS = new Set(["email", "e-mail", "mail"]);

/** Poster numbers baked into Sato product copy before contacts moved to env. */
const LEGACY_COMPANY_PHONES = [
  "0768 844 045",
  "0723 507 050",
  "+254 723 507 050",
  "0768844045",
  "0723507050",
  "+254723507050",
];

export function companySpecKind(key: string): "phone" | "email" | null {
  const normalized = key.trim().toLowerCase();
  if (PHONE_SPEC_KEYS.has(normalized)) return "phone";
  if (EMAIL_SPEC_KEYS.has(normalized)) return "email";
  return null;
}

/** Swap retired yard numbers in product copy for the live company line. */
export function withCompanyContacts(text: string): string {
  let next = text;
  for (const legacy of LEGACY_COMPANY_PHONES) {
    if (!legacy || legacy === COMPANY.phone) continue;
    next = next.split(legacy).join(COMPANY.phone);
  }
  return next;
}

export function customerCallHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.replace(/\s/g, "");
  if (trimmed.length < 7) return null;
  return `tel:${trimmed}`;
}

export function customerWhatsAppHref(
  phone: string | null | undefined,
  text: string,
): string | null {
  if (!phone) return null;
  const e164 = phoneToWhatsAppE164(phone);
  if (e164.length < 10) return null;
  return `https://wa.me/${e164}?text=${encodeURIComponent(text)}`;
}
