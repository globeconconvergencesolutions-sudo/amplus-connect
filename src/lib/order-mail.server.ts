import { BANK_ACCOUNT, BRAND, COMPANY, YARD_DIRECTIONS_URL, whatsappLink } from "@/lib/company";
import { deliveryLabel, isPickupOption } from "@/lib/fulfilment";
import { formatKes } from "@/lib/format";
import { mailConfigured, sendMail } from "@/lib/mail.server";

type MailItem = { name: string; quantity: number; lineTotal?: number };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function firstName(name: string | null | undefined) {
  const part = name?.trim().split(/\s+/)[0];
  return part || "there";
}

function appOrigin() {
  return (process.env["PUBLIC_APP_URL"] ?? "http://localhost:8080").replace(/\/$/, "");
}

function shopUrl() {
  return `${appOrigin()}/`;
}

function telHref() {
  return `tel:${COMPANY.phone.replace(/\s/g, "")}`;
}

/** Customers have no account on the public site, so order mail points at a call or WhatsApp. */
function orderWhatsApp(ref: string, message: string) {
  return whatsappLink(`Hello Amplus, ${message} Order: ${ref}`);
}

function contactHtml(ref: string) {
  const link = `color:${BRAND.orangeDark};font-weight:600`;
  return `<p style="margin:20px 0 0;color:#44403c">Questions about ${escapeHtml(ref)}? Call <a href="${telHref()}" style="${link}">${escapeHtml(COMPANY.phone)}</a> or <a href="${escapeHtml(orderWhatsApp(ref, "I have a question about my order."))}" style="${link}">WhatsApp us</a> quoting your order code.</p>`;
}

function contactText(ref: string) {
  return `Questions about ${ref}? Call ${COMPANY.phone} or WhatsApp us quoting your order code.`;
}

function itemLines(items: MailItem[]) {
  if (items.length === 0) return "• Your selected materials";
  return items
    .map((item) => {
      const total = item.lineTotal != null ? ` — ${formatKes(item.lineTotal)}` : "";
      return `• ${item.quantity} × ${item.name}${total}`;
    })
    .join("\n");
}

function itemListHtml(items: MailItem[]) {
  if (items.length === 0) return "<li>Your selected materials</li>";
  return items
    .map((item) => {
      const total =
        item.lineTotal != null
          ? ` <span style="color:#78716c">${formatKes(item.lineTotal)}</span>`
          : "";
      return `<li style="margin:0 0 6px">${escapeHtml(String(item.quantity))} × ${escapeHtml(item.name)}${total}</li>`;
    })
    .join("");
}

function brandedEmail(input: {
  preheader: string;
  eyebrow: string;
  title: string;
  greeting: string;
  intro: string;
  orderRef: string;
  totalKes?: number;
  items: MailItem[];
  extraHtml?: string;
  extraText?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const total =
    input.totalKes != null
      ? `<p style="margin:16px 0 0;font-size:15px">Total <strong>${formatKes(input.totalKes)}</strong></p>`
      : "";
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
              <table role="presentation" width="100%" style="background:#faf6f1;border-radius:8px;padding:0">
                <tr>
                  <td style="padding:16px 18px">
                    <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#a16207">Order</p>
                    <p style="margin:4px 0 0;font-family:ui-monospace,Consolas,monospace;font-size:14px;font-weight:700">${escapeHtml(input.orderRef)}</p>
                    ${total}
                    <ul style="margin:14px 0 0;padding-left:18px;color:#44403c">${itemListHtml(input.items)}</ul>
                  </td>
                </tr>
              </table>
              ${input.extraHtml ?? ""}
              ${cta}
              <p style="margin:28px 0 0;font-size:13px;color:#78716c">Need help? Call <a href="${telHref()}" style="color:#78716c">${escapeHtml(COMPANY.phone)}</a>, <a href="${escapeHtml(orderWhatsApp(input.orderRef, "I need help with my order."))}" style="color:#78716c">WhatsApp us</a>, or reply to this email.</p>
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
    `Order: ${input.orderRef}`,
    input.totalKes != null ? `Total: ${formatKes(input.totalKes)}` : "",
    "",
    itemLines(input.items),
    "",
    input.extraText ?? "",
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

type PaidOrderMail = {
  merchantReference: string;
  totalKes: number;
  customerEmail: string | null;
  customerName: string | null;
  deliveryOption: string | null;
  items: { name: string; quantity: number; lineTotal: number }[];
};

export async function notifyOrderPaid(order: PaidOrderMail): Promise<void> {
  if (!mailConfigured() || !order.customerEmail) return;
  const pickup = isPickupOption(order.deliveryOption);
  const next = pickup
    ? `We will pack your materials for collection at the yard (${COMPANY.address}) and email you the moment they are ready.`
    : `We will prepare ${deliveryLabel(order.deliveryOption)} and update you at each step.`;
  const branded = brandedEmail({
    preheader: `Payment confirmed for ${order.merchantReference}`,
    eyebrow: "Payment confirmed",
    title: "Thank you — your order is paid",
    greeting: firstName(order.customerName),
    intro: `We have matched payment for ${order.merchantReference}. ${next}`,
    orderRef: order.merchantReference,
    totalKes: order.totalKes,
    items: order.items,
    extraHtml: contactHtml(order.merchantReference),
    extraText: contactText(order.merchantReference),
    ctaLabel: "WhatsApp us about this order",
    ctaHref: orderWhatsApp(order.merchantReference, "I have a question about my order."),
  });
  const recipients = new Set<string>([order.customerEmail]);
  if (process.env["ORDER_NOTIFY_EMAIL"]) recipients.add(process.env["ORDER_NOTIFY_EMAIL"]);
  await sendMail({
    to: [...recipients],
    subject: `Payment confirmed · ${order.merchantReference}`,
    text: branded.text,
    html: branded.html,
  });
}

type AbandonedMail = {
  customerEmail: string;
  customerName: string | null;
  merchantReference: string;
  totalKes: number;
  items: { name: string; quantity: number }[];
};

export async function notifyAbandonedOrder(order: AbandonedMail): Promise<boolean> {
  if (!mailConfigured()) return false;
  const branded = brandedEmail({
    preheader: `Complete payment for ${order.merchantReference}`,
    eyebrow: "Your materials are waiting",
    title: "Finish payment when you are ready",
    greeting: firstName(order.customerName),
    intro: `Order ${order.merchantReference} is still awaiting payment. Lipa na M-Pesa Pay Bill ${BANK_ACCOUNT.paybill} (account ${BANK_ACCOUNT.accountNumber}) or transfer via ${BANK_ACCOUNT.bankName}.`,
    orderRef: order.merchantReference,
    totalKes: order.totalKes,
    items: order.items,
    extraHtml: `<p style="margin:20px 0 0;color:#44403c">Already paid? WhatsApp us your M-Pesa or bank reference and we will match it. Changed your mind? Call <a href="${telHref()}" style="color:${BRAND.orangeDark};font-weight:600">${escapeHtml(COMPANY.phone)}</a> and we will cancel the order.</p>`,
    extraText: `Pay Bill ${BANK_ACCOUNT.paybill}. Account ${BANK_ACCOUNT.accountNumber}. Already paid? WhatsApp us your M-Pesa or bank reference. Changed your mind? Call ${COMPANY.phone} and we will cancel the order.`,
    ctaLabel: "Send payment reference on WhatsApp",
    ctaHref: orderWhatsApp(
      order.merchantReference,
      `I have paid ${formatKes(order.totalKes)}. M-Pesa / bank reference:`,
    ),
  });
  return sendMail({
    to: order.customerEmail,
    subject: `Your ${order.items[0]?.name ?? "Amplus"} order is still waiting`,
    text: branded.text,
    html: branded.html,
  });
}

export type FulfilmentMailStatus = "FULFILLED" | "SHIPPED" | "DELIVERED";

type FulfilmentMail = {
  customerEmail: string | null;
  customerName: string | null;
  merchantReference: string;
  totalKes: number;
  deliveryOption: string | null;
  status: FulfilmentMailStatus;
  note: string | null;
  items: MailItem[];
};

export async function notifyFulfilmentStage(order: FulfilmentMail): Promise<void> {
  if (!mailConfigured() || !order.customerEmail) return;
  const pickup = isPickupOption(order.deliveryOption);
  const copy =
    order.status === "FULFILLED" && pickup
      ? {
          eyebrow: "Ready for collection",
          title: "Your order is ready at the yard",
          intro: `Bring order ${order.merchantReference} to ${COMPANY.address} during ${COMPANY.hours}.`,
          subject: `Ready for collection · ${order.merchantReference}`,
        }
      : order.status === "FULFILLED"
        ? {
            eyebrow: "Being prepared",
            title: "We are packing your materials",
            intro: `The yard is preparing ${order.merchantReference} for ${deliveryLabel(order.deliveryOption)}.`,
            subject: `Being prepared · ${order.merchantReference}`,
          }
        : order.status === "SHIPPED"
          ? {
              eyebrow: "Out for delivery",
              title: "Your order is on the way",
              intro: `Keep your phone on. The driver may call about ${order.merchantReference}.`,
              subject: `Out for delivery · ${order.merchantReference}`,
            }
          : pickup
            ? {
                eyebrow: "Collected",
                title: "Thank you for collecting your order",
                intro: `${order.merchantReference} has been marked collected. We hope the site goes smoothly.`,
                subject: `Collected · ${order.merchantReference}`,
              }
            : {
                eyebrow: "Delivered",
                title: "Your materials have been delivered",
                intro: `${order.merchantReference} is marked delivered. If anything is missing, call us the same day.`,
                subject: `Delivered · ${order.merchantReference}`,
              };

  const noteHtml = order.note
    ? `<p style="margin:20px 0 0;padding:12px 14px;background:#faf6f1;border-radius:8px"><strong>Yard note:</strong> ${escapeHtml(order.note)}</p>`
    : "";
  const readyForCollection = pickup && order.status === "FULFILLED";
  const readyHtml = readyForCollection
    ? `<p style="margin:20px 0 0;color:#44403c">Call ${escapeHtml(COMPANY.phone)} before you set off and bring order ${escapeHtml(order.merchantReference)}. <a href="${YARD_DIRECTIONS_URL}" style="color:${BRAND.orangeDark};font-weight:600">Get directions to the yard</a></p>`
    : "";
  const cta = readyForCollection
    ? {
        ctaLabel: "WhatsApp before you set off",
        ctaHref: orderWhatsApp(order.merchantReference, "I am coming to collect my order."),
      }
    : order.status === "DELIVERED"
      ? { ctaLabel: "Enquire about more materials", ctaHref: shopUrl() }
      : {
          ctaLabel: "WhatsApp us about this order",
          ctaHref: orderWhatsApp(order.merchantReference, "I have a question about my order."),
        };
  const branded = brandedEmail({
    preheader: copy.title,
    eyebrow: copy.eyebrow,
    title: copy.title,
    greeting: firstName(order.customerName),
    intro: copy.intro,
    orderRef: order.merchantReference,
    totalKes: order.totalKes,
    items: order.items,
    extraHtml: `${noteHtml}${readyHtml}${contactHtml(order.merchantReference)}`,
    extraText: [
      order.note ? `Yard note: ${order.note}` : "",
      readyForCollection
        ? `Call ${COMPANY.phone} before you set off. Directions: ${YARD_DIRECTIONS_URL}`
        : "",
      contactText(order.merchantReference),
    ]
      .filter(Boolean)
      .join("\n"),
    ...cta,
  });
  await sendMail({
    to: order.customerEmail,
    subject: copy.subject,
    text: branded.text,
    html: branded.html,
  });
}
