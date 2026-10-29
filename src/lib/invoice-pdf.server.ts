import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { BANK_ACCOUNT, BRAND, COMPANY, companyContactStrip } from "@/lib/company";

export type InvoicePdfItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceKes: number;
  lineTotalKes: number;
};

export type InvoicePdfInput = {
  invoiceNumber: string;
  status: string;
  documentKind: "invoice" | "proforma";
  referenceText: string | null;
  issueDate: string;
  dueDate: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerPin: string | null;
  customerAddress: string | null;
  customerLpo: string | null;
  notes: string | null;
  remarks: string | null;
  deliveryMeta: string | null;
  paymentTerms: string | null;
  taxRatePercent: number;
  subtotalKes: number;
  taxKes: number;
  totalKes: number;
  items: InvoicePdfItem[];
};

/** Intrinsic size of src/assets/brand/amplus-construction-logo.png */
const LOGO_INTRINSIC = { w: 642, h: 284 };

function money(value: number) {
  return Math.round(Number(value) || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function qty(value: number) {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? String(n) : n.toLocaleString("en-KE", { maximumFractionDigits: 3 });
}

function formatLongDate(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  return `${day}${suffix} ${month} ${d.getFullYear()}`;
}

function formatShortDate(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB");
}

function collectBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function resolveLogoPath() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return join(here, "../assets/brand/amplus-construction-logo.png");
  } catch {
    const require = createRequire(import.meta.url);
    return join(process.cwd(), "src/assets/brand/amplus-construction-logo.png");
  }
}

export function invoicePdfFilename(invoiceNumber: string, kind: string) {
  const prefix = kind === "proforma" ? "Amplus-Proforma" : "Amplus-Invoice";
  return `${prefix}-${invoiceNumber}.pdf`;
}

/**
 * A4 sales invoice matching live Amplus Construction templates (Firmbridge / 428).
 * Contact strip stays at the TOP (same as sample PDFs), then logo → KRA PIN → title.
 */
export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 28, bottom: 48, left: 42, right: 42 },
    info: {
      Title: `${input.documentKind === "proforma" ? "Proforma" : "Invoice"} ${input.invoiceNumber}`,
      Author: COMPANY.legalName,
      Subject: `Sales document for ${input.customerName}`,
      Creator: COMPANY.name,
    },
  });
  const done = collectBuffer(doc);

  const pageWidth = doc.page.width;
  const left = doc.page.margins.left;
  const right = pageWidth - doc.page.margins.right;
  const contentWidth = right - left;
  const purple = BRAND.purple;
  const orange = BRAND.orange;
  const muted = BRAND.muted;
  const ink = BRAND.ink;
  const pageBottom = doc.page.height - doc.page.margins.bottom;

  function ensureSpace(needed: number) {
    if (y + needed <= pageBottom) return;
    doc.addPage();
    y = doc.page.margins.top;
  }

  // Top contact strip — Firmbridge / 428 layout (not footer)
  doc.fillColor(purple).font("Helvetica").fontSize(7.5);
  doc.text(companyContactStrip(), left, doc.page.margins.top, {
    width: contentWidth,
    align: "center",
    lineGap: 1,
  });
  let y = doc.y + 10;

  // Logo (advance by real rendered height so KRA PIN never overlaps the tagline)
  try {
    const logoPath = resolveLogoPath();
    const logoW = 200;
    const logoH = logoW * (LOGO_INTRINSIC.h / LOGO_INTRINSIC.w);
    const logoX = left + (contentWidth - logoW) / 2;
    doc.image(logoPath, logoX, y, { width: logoW, height: logoH });
    y += logoH + 14;
  } catch {
    doc.fillColor(purple).font("Helvetica-Bold").fontSize(22);
    doc.text("AMPLUS", left, y, { width: contentWidth, align: "center" });
    y = doc.y + 4;
    doc.fillColor(muted).font("Helvetica").fontSize(10);
    doc.text(COMPANY.legalName, left, y, { width: contentWidth, align: "center" });
    y = doc.y + 2;
    doc.fillColor(orange).font("Helvetica-Bold").fontSize(8);
    doc.text(COMPANY.tagline, left, y, { width: contentWidth, align: "center" });
    y = doc.y + 12;
  }

  if (COMPANY.pin) {
    doc.fillColor(purple).font("Helvetica-Bold").fontSize(10);
    doc.text(`KRA PIN: ${COMPANY.pin}`, left, y, { width: contentWidth, align: "center" });
    y = doc.y + 12;
  }

  const title = input.documentKind === "proforma" ? "PROFORMA INVOICE" : "INVOICE";
  doc.fillColor(purple).font("Helvetica-Bold").fontSize(16);
  doc.text(title, left, y, { width: contentWidth, align: "center" });
  y = doc.y + 16;

  // Meta — track real heights so wrapped ADDRESS doesn't collide with invoice no.
  const metaStartY = y;
  const leftW = contentWidth * 0.58;
  const rightX = left + contentWidth * 0.55;
  const rightW = contentWidth * 0.45;

  doc.fillColor(ink).font("Helvetica").fontSize(10);
  const metaLeft = [`DATE: ${formatLongDate(input.issueDate)}`, `CLIENT: ${input.customerName}`];
  if (input.customerPhone) metaLeft.push(`PHONE: ${input.customerPhone}`);
  if (input.customerEmail) metaLeft.push(`EMAIL: ${input.customerEmail}`);
  if (input.customerAddress) metaLeft.push(`ADDRESS: ${input.customerAddress}`);
  if (input.customerPin) metaLeft.push(`CLIENT PIN: ${input.customerPin}`);
  if (input.customerLpo) metaLeft.push(`LPO: ${input.customerLpo}`);

  let leftY = metaStartY;
  for (const line of metaLeft) {
    doc.text(line, left, leftY, { width: leftW });
    leftY = doc.y + 4;
  }

  let rightY = metaStartY;
  doc.font("Helvetica-Bold");
  const numberLabel = input.documentKind === "proforma" ? "QUOTE NO" : "INVOICE NO";
  doc.text(`${numberLabel}: ${input.invoiceNumber}`, rightX, rightY, {
    width: rightW,
    align: "right",
  });
  rightY = doc.y + 4;
  doc.font("Helvetica");
  doc.text(
    `REFERENCE: ${input.referenceText?.trim() || input.customerLpo || "RFQ"}`,
    rightX,
    rightY,
    { width: rightW, align: "right" },
  );
  rightY = doc.y + 4;

  y = Math.max(leftY, rightY) + 8;

  // Table
  const col = {
    item: left,
    desc: left + 36,
    units: left + 280,
    rate: left + 340,
    amount: left + 430,
  };
  const colW = {
    item: 34,
    desc: 240,
    units: 56,
    rate: 84,
    amount: right - (left + 430),
  };

  function drawTableHeader() {
    doc.rect(left, y, contentWidth, 22).fill(purple);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8);
    const headerY = y + 7;
    doc.text("ITEM", col.item + 4, headerY, { width: colW.item });
    doc.text("DESCRIPTION", col.desc, headerY, { width: colW.desc });
    doc.text("UNITS", col.units, headerY, { width: colW.units, align: "right" });
    doc.text("KSH RATE", col.rate, headerY, { width: colW.rate, align: "right" });
    doc.text("AMOUNT", col.amount, headerY, { width: colW.amount, align: "right" });
    y += 26;
  }

  ensureSpace(40);
  drawTableHeader();

  doc.fillColor(ink).font("Helvetica").fontSize(9);
  input.items.forEach((item, index) => {
    const rowH = Math.max(18, doc.heightOfString(item.description, { width: colW.desc }) + 6);
    ensureSpace(rowH + 8);
    if (y < doc.page.margins.top + 30) drawTableHeader();
    if (index % 2 === 1) {
      doc.rect(left, y - 2, contentWidth, rowH).fill("#F7F3F9");
      doc.fillColor(ink);
    }
    doc.text(String(index + 1), col.item + 4, y, { width: colW.item });
    doc.text(item.description, col.desc, y, { width: colW.desc });
    doc.text(qty(item.quantity), col.units, y, { width: colW.units, align: "right" });
    doc.text(money(item.unitPriceKes), col.rate, y, { width: colW.rate, align: "right" });
    doc.text(money(item.lineTotalKes), col.amount, y, { width: colW.amount, align: "right" });
    y += rowH;
  });

  y += 10;
  ensureSpace(90);
  const totalsX = left + 280;
  const totalsLabelW = 150;
  const totalsValueW = right - (totalsX + totalsLabelW);

  function totalRow(label: string, value: string, bold = false) {
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(10)
      .fillColor(ink);
    doc.text(label, totalsX, y, { width: totalsLabelW });
    doc.text(value, totalsX + totalsLabelW, y, { width: totalsValueW, align: "right" });
    y += 16;
  }

  totalRow("Total cost", money(input.subtotalKes));
  if (input.taxRatePercent > 0) {
    totalRow(`${input.taxRatePercent}% VAT`, money(input.taxKes));
    totalRow(`Total ${input.taxRatePercent}% VAT Inclusive`, money(input.totalKes), true);
  } else {
    totalRow("Total", money(input.totalKes), true);
  }

  y += 10;
  ensureSpace(60);
  doc.fillColor(ink).font("Helvetica").fontSize(9);
  if (input.documentKind === "proforma") {
    doc.text(`Quote is valid until ${formatLongDate(input.dueDate ?? input.issueDate)}`, left, y);
    y = doc.y + 6;
  }
  doc.text(input.paymentTerms?.trim() || "Full payment to be done with order", left, y, {
    width: contentWidth,
  });
  y = doc.y + 6;
  if (input.dueDate) {
    doc.text(`Due date ${formatShortDate(input.dueDate)}`, left, y);
    y = doc.y + 8;
  }

  if (input.deliveryMeta) {
    doc.fillColor(muted).fontSize(8).text(`Delivery: ${input.deliveryMeta}`, left, y, {
      width: contentWidth,
    });
    y = doc.y + 6;
  }
  if (input.notes) {
    doc.fillColor(muted).fontSize(8).text(input.notes, left, y, { width: contentWidth });
    y = doc.y + 6;
  }
  if (input.remarks) {
    doc.fillColor(muted).fontSize(8).text(input.remarks, left, y, { width: contentWidth });
    y = doc.y + 6;
  }

  ensureSpace(90);
  y += 6;
  doc.fillColor(purple).font("Helvetica-Bold").fontSize(10);
  doc.text("PAYMENT INSTRUCTIONS:", left, y);
  y = doc.y + 8;
  doc.fillColor(ink).font("Helvetica").fontSize(9);
  doc.text("1) Bank details:", left, y);
  y = doc.y + 8;

  const bankCols = [
    { label: "Bank Name", value: BANK_ACCOUNT.bankName, w: 90 },
    { label: "Bank Branch", value: BANK_ACCOUNT.branch, w: 100 },
    { label: "Account Name", value: BANK_ACCOUNT.accountName, w: 170 },
    {
      label: "Account Number",
      value: BANK_ACCOUNT.accountNumber,
      w: contentWidth - 90 - 100 - 170,
    },
  ];
  let bx = left;
  doc.rect(left, y, contentWidth, 36).strokeColor(BRAND.border).stroke();
  doc.font("Helvetica-Bold").fontSize(7).fillColor(muted);
  for (const colDef of bankCols) {
    doc.text(colDef.label, bx + 4, y + 4, { width: colDef.w - 8 });
    bx += colDef.w;
  }
  bx = left;
  doc.font("Helvetica").fontSize(8).fillColor(ink);
  for (const colDef of bankCols) {
    doc.text(colDef.value, bx + 4, y + 16, { width: colDef.w - 8 });
    bx += colDef.w;
  }
  y += 44;

  // Compact footer contact (samples keep the strip at top; footer repeats for multi-page clarity)
  ensureSpace(24);
  doc
    .fillColor(muted)
    .font("Helvetica")
    .fontSize(7)
    .text(companyContactStrip(), left, Math.max(y, pageBottom - 18), {
      width: contentWidth,
      align: "center",
    });

  doc.end();
  return done;
}
