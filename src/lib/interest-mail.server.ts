import { BRAND, COMPANY, YARD_DIRECTIONS_URL, whatsappLink } from "@/lib/company";
import { formatKes } from "@/lib/format";
import { mailConfigured, sendMail } from "@/lib/mail.server";

export type InterestLeadMail = {
  id: string;
  productName: string;
  productSlug: string | null;
  productUnit: string | null;
  unitPriceKes: number | null;
  fullName: string;
  phone: string;
  location: string;
  email: string | null;
  quantity: number | null;
  notes: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function firstName(name: string) {
  const part = name.trim().split(/\s+/)[0];
  return part || "there";
}

function appOrigin() {
  return (process.env["PUBLIC_APP_URL"] ?? "http://localhost:8080").replace(/\/$/, "");
}

function staffNotifyTo(): string[] {
  const configured =
    process.env["INTEREST_NOTIFY_EMAIL"]?.trim() ||
    process.env["ORDER_NOTIFY_EMAIL"]?.trim() ||
    COMPANY.email;
  return configured
    .split(/[,;]+/)
    .map((row) => row.trim())
    .filter(Boolean);
}

function productLine(lead: InterestLeadMail) {
  const price =
    lead.unitPriceKes != null
      ? ` · ${formatKes(lead.unitPriceKes)} / ${lead.productUnit ?? "unit"}`
      : "";
  return `${lead.productName}${price}`;
}

function adminLeadsUrl() {
  return `${appOrigin()}/admin/leads`;
}

function productUrl(slug: string | null) {
  if (!slug) return appOrigin();
  return `${appOrigin()}/products/${encodeURIComponent(slug)}`;
}

function brandedShell(input: {
  preheader: string;
  eyebrow: string;
  title: string;
  greeting: string;
  intro: string;
  bodyHtml: string;
  bodyText: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const cta =
    input.ctaHref && input.ctaLabel
      ? `<p style="margin:28px 0 0"><a href="${escapeHtml(input.ctaHref)}" style="display:inline-block;background:${BRAND.orange};color:#ffffff;padding:12px 22px;text-decoration:none;border-radius:6px;font-weight:600">${escapeHtml(input.ctaLabel)}</a></p>`
      : "";
  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:${BRAND.paper};font-family:Georgia,'Times New Roman',serif">
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper};padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border}">
          <tr>
            <td style="background:${BRAND.purple};color:#faf6f1;padding:22px 28px">
              <p style="margin:0;letter-spacing:0.18em;font-size:11px;text-transform:uppercase;color:${BRAND.orange}">Amplus Construction Solutions</p>
              <p style="margin:8px 0 0;font-size:20px;font-weight:700">${escapeHtml(input.eyebrow)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;color:${BRAND.ink};line-height:1.55;font-size:15px">
              <p style="margin:0 0 12px">Hi ${escapeHtml(input.greeting)},</p>
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escapeHtml(input.title)}</h1>
              <p style="margin:0 0 16px;color:#44403c">${escapeHtml(input.intro)}</p>
              ${input.bodyHtml}
              ${cta}
              <p style="margin:28px 0 0;font-size:13px;color:#78716c">Need help? Call <a href="tel:${COMPANY.phone.replace(/\s/g, "")}" style="color:#78716c">${escapeHtml(COMPANY.phone)}</a> or reply to this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #e7e0d6;color:#78716c;font-size:12px;line-height:1.5">
              ${escapeHtml(COMPANY.name)}<br/>
              ${escapeHtml(COMPANY.address)}<br/>
              ${escapeHtml(COMPANY.hours)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${input.greeting},`,
    "",
    input.title,
    input.intro,
    "",
    input.bodyText,
    "",
    input.ctaHref ? `${input.ctaLabel ?? "Open"}: ${input.ctaHref}` : "",
    "",
    COMPANY.name,
    COMPANY.phone,
    COMPANY.address,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { html, text };
}

function detailRows(lead: InterestLeadMail) {
  const rows: [string, string][] = [
    ["Product", productLine(lead)],
    ["Name", lead.fullName],
    ["Phone", lead.phone],
    ["Location", lead.location],
  ];
  if (lead.email) rows.push(["Email", lead.email]);
  if (lead.quantity != null) {
    rows.push(["Quantity", `${lead.quantity}${lead.productUnit ? ` ${lead.productUnit}` : ""}`]);
  }
  if (lead.notes) rows.push(["Notes", lead.notes]);
  return rows;
}

function detailsHtml(lead: InterestLeadMail) {
  const cells = detailRows(lead)
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:8px 0;vertical-align:top;width:110px;color:#78716c;font-size:12px;text-transform:uppercase;letter-spacing:0.06em">${escapeHtml(label)}</td>
          <td style="padding:8px 0;color:${BRAND.ink};font-size:15px;white-space:pre-wrap">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" style="background:#faf6f1;border-radius:8px;padding:0">
    <tr><td style="padding:16px 18px"><table role="presentation" width="100%">${cells}</table></td></tr>
  </table>`;
}

function detailsText(lead: InterestLeadMail) {
  return detailRows(lead)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

/** Staff alert for every new expression of interest. */
export async function notifyInterestStaff(lead: InterestLeadMail): Promise<boolean> {
  if (!mailConfigured()) return false;
  const to = staffNotifyTo();
  if (to.length === 0) return false;

  const branded = brandedShell({
    preheader: `New interest · ${lead.productName} · ${lead.fullName}`,
    eyebrow: "New expression of interest",
    title: "A customer wants this product",
    greeting: "team",
    intro:
      "Someone filled the interest form on the shop. Call or WhatsApp them while the lead is warm.",
    bodyHtml: detailsHtml(lead),
    bodyText: detailsText(lead),
    ctaLabel: "Open leads inbox",
    ctaHref: adminLeadsUrl(),
  });

  return sendMail({
    to,
    subject: `Interest · ${lead.productName} · ${lead.fullName}`,
    text: branded.text,
    html: branded.html,
  });
}

/** Yard collection block: Amplus encourages collection over delivery. */
function collectionHtml() {
  return `<p style="margin:20px 0 0;padding:12px 14px;background:#faf6f1;border-radius:8px;color:#44403c"><strong>Collect from the yard</strong><br />${escapeHtml(COMPANY.address)}<br />${escapeHtml(COMPANY.hours)}<br /><a href="${YARD_DIRECTIONS_URL}" style="color:${BRAND.orangeDark};font-weight:600">Get directions</a></p>`;
}

function collectionText() {
  return `Collect from the yard: ${COMPANY.address} · ${COMPANY.hours}\nDirections: ${YARD_DIRECTIONS_URL}`;
}

/** Customer acknowledgement when they left an email. */
export async function notifyInterestCustomer(lead: InterestLeadMail): Promise<boolean> {
  if (!mailConfigured() || !lead.email) return false;

  const branded = brandedShell({
    preheader: `We received your interest in ${lead.productName}`,
    eyebrow: "We got your request",
    title: `Thanks, ${firstName(lead.fullName)}`,
    greeting: firstName(lead.fullName),
    intro: `Thanks for your interest in ${lead.productName}. An Amplus advisor will reach you on ${lead.phone} to confirm availability, pricing, and a time to collect from our yard.`,
    bodyHtml: `${detailsHtml(lead)}${collectionHtml()}<p style="margin:20px 0 0;color:#44403c">No account needed — we will call or WhatsApp you. Prefer to talk now? Call <a href="tel:${COMPANY.phone.replace(/\s/g, "")}" style="color:${BRAND.orangeDark};font-weight:600">${escapeHtml(COMPANY.phone)}</a>, or <a href="${escapeHtml(productUrl(lead.productSlug))}" style="color:${BRAND.orangeDark};font-weight:600">view the product online</a>.</p>`,
    bodyText: `${detailsText(lead)}\n\n${collectionText()}\n\nNo account needed — we will call or WhatsApp you. Prefer to talk now? Call ${COMPANY.phone}. Product: ${productUrl(lead.productSlug)}`,
    ctaLabel: "WhatsApp us now",
    ctaHref: whatsappLink(
      `Hello Amplus, I sent an enquiry about ${lead.productName}. My name is ${lead.fullName}.`,
    ),
  });

  return sendMail({
    to: lead.email,
    subject: `We received your interest · ${lead.productName}`,
    text: branded.text,
    html: branded.html,
  });
}
