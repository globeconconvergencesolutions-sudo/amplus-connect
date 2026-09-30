function publicEnv(key: string, fallback: string): string {
  const fromVite = import.meta.env[key];
  if (typeof fromVite === "string" && fromVite.trim()) return fromVite.trim();
  const fromProcess = process.env[key];
  if (typeof fromProcess === "string" && fromProcess.trim()) return fromProcess.trim();
  return fallback;
}

export const COMPANY = {
  name: "Amplus Construction Solutions",
  shortName: "Amplus",
  tagline: "Build with certainty",
  phone: publicEnv("VITE_COMPANY_PHONE", "+254 700 000 000"),
  email: publicEnv("VITE_COMPANY_EMAIL", "hello@amplus.co.ke"),
  address: publicEnv("VITE_COMPANY_ADDRESS", "Amplus House, Mombasa Road, Nairobi, Kenya"),
  hours: publicEnv("VITE_COMPANY_HOURS", "Mon – Fri, 8:00 – 17:30 · Sat, 8:00 – 13:00"),
  mapQuery: publicEnv("VITE_COMPANY_MAP_QUERY", "Mombasa Road, Nairobi, Kenya"),
  /** Optional 254… digits. Empty means derive from phone. */
  whatsapp: publicEnv("VITE_COMPANY_WHATSAPP", ""),
};

export const DELIVERY_OPTIONS = [
  { id: "nairobi-standard", label: "Nairobi metro delivery (2 working days)", fee: 1500 },
  { id: "nairobi-express", label: "Nairobi express delivery (next day)", fee: 3000 },
  { id: "upcountry", label: "Upcountry delivery (3 – 5 working days)", fee: 4500 },
  { id: "pickup", label: "Collect from Amplus yard, Mombasa Road", fee: 0 },
];

export const BANK_ACCOUNT = {
  accountName: publicEnv("VITE_BANK_ACCOUNT_NAME", "Amplus Construction Solutions Ltd"),
  bankName: publicEnv("VITE_BANK_NAME", "Equity Bank"),
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
  const text = lines.join(" ");
  const whatsappSource = COMPANY.whatsapp || COMPANY.phone;
  return {
    callHref: `tel:${COMPANY.phone.replace(/\s/g, "")}`,
    whatsappHref: `https://wa.me/${phoneToWhatsAppE164(whatsappSource)}?text=${encodeURIComponent(text)}`,
  };
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
