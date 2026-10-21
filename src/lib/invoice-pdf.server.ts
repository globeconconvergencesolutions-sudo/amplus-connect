import PDFDocument from "pdfkit";
import { BANK_ACCOUNT, COMPANY } from "@/lib/company";

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

function money(value: number) {
  return `KES ${Math.round(Number(value) || 0).toLocaleString("en-KE")}`;
}

function qty(value: number) {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? String(n) : n.toLocaleString("en-KE", { maximumFractionDigits: 3 });
}

function formatDisplayDate(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function collectBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

/** A4 Kenyan-style sales invoice PDF — Amplus branded, inspired by NCCL layout. */
export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 42, bottom: 48, left: 42, right: 42 },
    info: {
      Title: `Invoice ${input.invoiceNumber}`,
      Author: COMPANY.legalName,
      Subject: `Sales invoice for ${input.customerName}`,
      Creator: COMPANY.name,
    },
  });
  const done = collectBuffer(doc);

  const pageWidth = doc.page.width;
  const left = doc.page.margins.left;
  const right = pageWidth - doc.page.margins.right;
  const contentWidth = right - left;

  // Header bar
  doc.rect(0, 0, pageWidth, 78).fill("#1C1917");
  doc.fillColor("#E8B089").font("Helvetica-Bold").fontSize(11);
  doc.text("AMPLUS CONSTRUCTION SOLUTIONS", left, 22, { characterSpacing: 1.2 });
  doc.fillColor("#FAF6F1").font("Helvetica-Bold").fontSize(22);
  doc.text("INVOICE", left, 40);
  doc.fillColor("#A8A29E").font("Helvetica").fontSize(9);
  doc.text(COMPANY.tagline, left, 64);

  doc.fillColor("#FAF6F1").font("Helvetica-Bold").fontSize(10);
  doc.text(input.invoiceNumber, left, 28, { width: contentWidth, align: "right" });
  doc.fillColor("#A8A29E").font("Helvetica").fontSize(9);
  doc.text(`Date ${formatDisplayDate(input.issueDate)}`, left, 44, {
    width: contentWidth,
    align: "right",
  });
  if (input.dueDate) {
    doc.text(`Due ${formatDisplayDate(input.dueDate)}`, left, 58, {
      width: contentWidth,
      align: "right",
    });
  }

  let y = 96;

  // Seller / Buyer columns
  const colW = contentWidth / 2 - 8;
  doc.fillColor("#78716C").font("Helvetica-Bold").fontSize(8);
  doc.text("FROM", left, y);
  doc.text("BILL TO", left + colW + 16, y);
  y += 12;

  doc.fillColor("#1C1917").font("Helvetica-Bold").fontSize(10);
  doc.text(COMPANY.legalName, left, y, { width: colW });
  doc.text(input.customerName, left + colW + 16, y, { width: colW });
  y += 14;

  doc.fillColor("#44403C").font("Helvetica").fontSize(9);
  const sellerLines = [
    COMPANY.postal,
    COMPANY.address,
    `Tel: ${COMPANY.phone}`,
    `Email: ${COMPANY.email}`,
    COMPANY.pin ? `PIN: ${COMPANY.pin}` : null,
  ].filter(Boolean) as string[];

  const buyerLines = [
    input.customerAddress,
    input.customerPhone ? `Tel: ${input.customerPhone}` : null,
    input.customerEmail ? `Email: ${input.customerEmail}` : null,
    input.customerPin ? `PIN: ${input.customerPin}` : null,
    input.customerLpo ? `LPO: ${input.customerLpo}` : null,
  ].filter(Boolean) as string[];

  const sellerBlock = sellerLines.join("\n");
  const buyerBlock = buyerLines.join("\n") || "—";
  const sellerH = doc.heightOfString(sellerBlock, { width: colW });
  const buyerH = doc.heightOfString(buyerBlock, { width: colW });
  doc.text(sellerBlock, left, y, { width: colW });
  doc.text(buyerBlock, left + colW + 16, y, { width: colW });
  y += Math.max(sellerH, buyerH) + 16;

  // Meta strip
  doc.roundedRect(left, y, contentWidth, 28, 4).fill("#FAF6F1");
  doc.fillColor("#78716C").font("Helvetica").fontSize(8);
  const statusLabel = input.status.toUpperCase();
  doc.text(`Status: ${statusLabel}`, left + 10, y + 10);
  doc.text(`Currency: KES`, left + contentWidth * 0.35, y + 10);
  if (input.paymentTerms) {
    doc.text(`Terms: ${input.paymentTerms}`, left + contentWidth * 0.58, y + 10, {
      width: contentWidth * 0.4,
    });
  }
  y += 40;

  // Table header
  const cols = {
    desc: left,
    qty: left + contentWidth * 0.48,
    unit: left + contentWidth * 0.58,
    price: left + contentWidth * 0.68,
    total: left + contentWidth * 0.84,
  };
  const descW = cols.qty - cols.desc - 6;

  doc.rect(left, y, contentWidth, 22).fill("#1C1917");
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8);
  doc.text("Description", cols.desc + 8, y + 7);
  doc.text("Qty", cols.qty, y + 7, { width: 40, align: "right" });
  doc.text("Unit", cols.unit, y + 7, { width: 36 });
  doc.text("Unit price", cols.price, y + 7, { width: 70, align: "right" });
  doc.text("Amount", cols.total, y + 7, { width: right - cols.total - 4, align: "right" });
  y += 26;

  const ensureSpace = (need: number) => {
    if (y + need < doc.page.height - 70) return;
    doc.addPage();
    y = 48;
    doc.rect(left, y, contentWidth, 22).fill("#1C1917");
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8);
    doc.text("Description", cols.desc + 8, y + 7);
    doc.text("Qty", cols.qty, y + 7, { width: 40, align: "right" });
    doc.text("Unit", cols.unit, y + 7, { width: 36 });
    doc.text("Unit price", cols.price, y + 7, { width: 70, align: "right" });
    doc.text("Amount", cols.total, y + 7, { width: right - cols.total - 4, align: "right" });
    y += 26;
  };

  input.items.forEach((item, index) => {
    const descHeight = Math.max(
      16,
      doc.font("Helvetica").fontSize(9).heightOfString(item.description, { width: descW }),
    );
    const rowH = descHeight + 10;
    ensureSpace(rowH + 4);

    if (index % 2 === 1) {
      doc.rect(left, y - 2, contentWidth, rowH).fill("#FAF6F1");
    }

    doc.fillColor("#1C1917").font("Helvetica").fontSize(9);
    doc.text(item.description, cols.desc + 8, y, { width: descW });
    doc.text(qty(item.quantity), cols.qty, y, { width: 40, align: "right" });
    doc.text(item.unit || "pc", cols.unit, y, { width: 36 });
    doc.text(money(item.unitPriceKes).replace("KES ", ""), cols.price, y, {
      width: 70,
      align: "right",
    });
    doc.font("Helvetica-Bold");
    doc.text(money(item.lineTotalKes).replace("KES ", ""), cols.total, y, {
      width: right - cols.total - 4,
      align: "right",
    });
    y += rowH;
  });

  if (input.items.length === 0) {
    doc.fillColor("#78716C").font("Helvetica-Oblique").fontSize(9);
    doc.text("No line items.", left + 8, y);
    y += 20;
  }

  y += 8;
  ensureSpace(120);

  // Totals box
  const boxW = 220;
  const boxX = right - boxW;
  doc.roundedRect(boxX, y, boxW, input.taxRatePercent > 0 ? 78 : 58, 4).stroke("#E7E0D6");

  let ty = y + 10;
  doc.fillColor("#78716C").font("Helvetica").fontSize(9);
  doc.text("Subtotal", boxX + 12, ty);
  doc.fillColor("#1C1917").text(money(input.subtotalKes), boxX + 12, ty, {
    width: boxW - 24,
    align: "right",
  });
  ty += 16;

  if (input.taxRatePercent > 0) {
    doc.fillColor("#78716C").text(`VAT (${input.taxRatePercent}%)`, boxX + 12, ty);
    doc.fillColor("#1C1917").text(money(input.taxKes), boxX + 12, ty, {
      width: boxW - 24,
      align: "right",
    });
    ty += 16;
  }

  doc
    .moveTo(boxX + 10, ty)
    .lineTo(boxX + boxW - 10, ty)
    .stroke("#E7E0D6");
  ty += 8;
  doc.fillColor("#C45C26").font("Helvetica-Bold").fontSize(11);
  doc.text("Total", boxX + 12, ty);
  doc.text(money(input.totalKes), boxX + 12, ty, { width: boxW - 24, align: "right" });

  y += input.taxRatePercent > 0 ? 92 : 72;

  // Logistics / remarks (NCCL-style meta)
  if (input.deliveryMeta || input.remarks) {
    ensureSpace(60);
    doc.fillColor("#78716C").font("Helvetica-Bold").fontSize(8);
    doc.text("DELIVERY / REMARKS", left, y);
    y += 12;
    doc.fillColor("#44403C").font("Helvetica").fontSize(9);
    if (input.deliveryMeta) {
      doc.text(input.deliveryMeta, left, y, { width: contentWidth });
      y += doc.heightOfString(input.deliveryMeta, { width: contentWidth }) + 6;
    }
    if (input.remarks) {
      doc.text(input.remarks, left, y, { width: contentWidth });
      y += doc.heightOfString(input.remarks, { width: contentWidth }) + 6;
    }
  }

  if (input.notes) {
    ensureSpace(50);
    doc.fillColor("#78716C").font("Helvetica-Bold").fontSize(8);
    doc.text("NOTES", left, y);
    y += 12;
    doc.fillColor("#44403C").font("Helvetica").fontSize(9);
    doc.text(input.notes, left, y, { width: contentWidth });
    y += doc.heightOfString(input.notes, { width: contentWidth }) + 10;
  }

  ensureSpace(90);
  doc.fillColor("#78716C").font("Helvetica-Bold").fontSize(8);
  doc.text("PAYMENT DETAILS", left, y);
  y += 12;
  doc.fillColor("#1C1917").font("Helvetica").fontSize(9);
  const payLines = [
    `Bank: ${BANK_ACCOUNT.bankName}`,
    `Account name: ${BANK_ACCOUNT.accountName}`,
    `Account number: ${BANK_ACCOUNT.accountNumber}`,
    `Paybill: ${BANK_ACCOUNT.paybill}`,
    "Please quote the invoice number as payment reference.",
  ];
  doc.text(payLines.join("\n"), left, y, { width: contentWidth });
  y += doc.heightOfString(payLines.join("\n"), { width: contentWidth }) + 16;

  doc.fillColor("#A8A29E").font("Helvetica").fontSize(8);
  doc.text(
    "Thank you for your business. This document is a sales invoice from Amplus Construction Solutions.",
    left,
    Math.max(y, doc.page.height - 56),
    { width: contentWidth, align: "center" },
  );

  doc.end();
  return done;
}

export function invoicePdfFilename(invoiceNumber: string) {
  const safe = invoiceNumber.replace(/[^\w.-]+/g, "_");
  return `Amplus-Invoice-${safe}.pdf`;
}
