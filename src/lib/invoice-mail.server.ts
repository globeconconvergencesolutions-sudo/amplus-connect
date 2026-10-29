import { BRAND, COMPANY, customerWhatsAppHref } from "@/lib/company";
import { formatKes } from "@/lib/format";
import { mailConfigured, sendMail } from "@/lib/mail.server";

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

export type InvoiceMailPayload = {
  invoiceNumber: string;
  documentKind: "invoice" | "proforma";
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  issueDate: string;
  totalKes: number;
  filename: string;
  pdfBase64: string;
};

export function invoiceWhatsAppShareHref(input: {
  customerPhone: string | null;
  invoiceNumber: string;
  documentKind: "invoice" | "proforma";
  totalKes: number;
}): string | null {
  const kind = input.documentKind === "proforma" ? "proforma invoice" : "invoice";
  const text = [
    `Hello ${COMPANY.shortName} shared ${kind} ${input.invoiceNumber}.`,
    `Total: ${formatKes(input.totalKes)}.`,
    `We will also send the PDF separately / attach it here.`,
    `Questions? Call ${COMPANY.phone}.`,
  ].join(" ");
  return customerWhatsAppHref(input.customerPhone, text);
}

/** Sends the invoice PDF to the customer when an email exists. */
export async function sendInvoicePdfEmail(input: InvoiceMailPayload): Promise<{
  sent: boolean;
  reason?: "no_email" | "mail_not_configured" | "send_failed";
}> {
  const to = input.customerEmail?.trim();
  if (!to) return { sent: false, reason: "no_email" };
  if (!mailConfigured()) return { sent: false, reason: "mail_not_configured" };

  const kindLabel = input.documentKind === "proforma" ? "Proforma invoice" : "Invoice";
  const greeting = firstName(input.customerName);
  const subject = `${kindLabel} ${input.invoiceNumber} · ${COMPANY.shortName}`;
  const intro = `Please find your ${kindLabel.toLowerCase()} attached as a PDF.`;
  const bodyHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#78716c">Document</td><td style="padding:6px 0;text-align:right;font-weight:600">${escapeHtml(kindLabel)} ${escapeHtml(input.invoiceNumber)}</td></tr>
      <tr><td style="padding:6px 0;color:#78716c">Date</td><td style="padding:6px 0;text-align:right">${escapeHtml(input.issueDate)}</td></tr>
      <tr><td style="padding:6px 0;color:#78716c">Total</td><td style="padding:6px 0;text-align:right;font-weight:700;color:${BRAND.purple}">${escapeHtml(formatKes(input.totalKes))}</td></tr>
    </table>
    <p style="margin:20px 0 0;color:#44403c">Bank details are printed on the PDF under Payment instructions.</p>
  `;
  const bodyText = [
    `Document: ${kindLabel} ${input.invoiceNumber}`,
    `Date: ${input.issueDate}`,
    `Total: ${formatKes(input.totalKes)}`,
    "",
    "Bank details are on the attached PDF.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:${BRAND.paper};font-family:Barlow,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper};padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border}">
        <tr>
          <td style="background:${BRAND.purple};color:#faf6f1;padding:22px 28px">
            <p style="margin:0;letter-spacing:0.18em;font-size:11px;text-transform:uppercase;color:${BRAND.orange}">${escapeHtml(COMPANY.name)}</p>
            <p style="margin:8px 0 0;font-size:20px;font-weight:700">${escapeHtml(kindLabel)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:${BRAND.ink};line-height:1.55;font-size:15px">
            <p style="margin:0 0 12px">Hi ${escapeHtml(greeting)},</p>
            <p style="margin:0 0 16px;color:#44403c">${escapeHtml(intro)}</p>
            ${bodyHtml}
            <p style="margin:28px 0 0;font-size:13px;color:#78716c">Need help? Call <a href="tel:${COMPANY.phone.replace(/\s/g, "")}" style="color:#78716c">${escapeHtml(COMPANY.phone)}</a>.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 24px;border-top:1px solid ${BRAND.border};color:#78716c;font-size:12px;line-height:1.5">
            ${escapeHtml(COMPANY.legalName)}<br/>${escapeHtml(COMPANY.address)}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [`Hi ${greeting},`, "", intro, "", bodyText, "", COMPANY.name, COMPANY.phone].join(
    "\n",
  );

  const ok = await sendMail({
    to,
    subject,
    text,
    html,
    attachments: [
      {
        filename: input.filename,
        content: input.pdfBase64,
        contentType: "application/pdf",
        encoding: "base64",
      },
    ],
  });

  return ok ? { sent: true } : { sent: false, reason: "send_failed" };
}
