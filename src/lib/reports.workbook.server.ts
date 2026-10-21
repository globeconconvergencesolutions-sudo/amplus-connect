import ExcelJS from "exceljs";
import { COMPANY } from "@/lib/company";
import { ORDER_STATUS_LABELS } from "@/lib/format";

const INK = "1C1917";
const ACCENT = "C45C26";
const MUTED = "78716C";
const HEADER_FILL = "1C1917";
const ALT_ROW = "FAF6F1";
const BORDER = "E7E0D6";
const SUCCESS = "166534";
const WARN = "A16207";

const PAID_STATUSES = new Set(["PAID", "FULFILLED", "SHIPPED", "DELIVERED"]);
const OPEN_STATUSES = new Set(["PENDING_PAYMENT", "PAYMENT_PROCESSING"]);

export type ReportProduct = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  unit: string;
  price_kes: number;
  stock: number;
  is_active: boolean;
  category_name: string | null;
};

export type ReportOrderLine = {
  orderId: string;
  merchantReference: string;
  status: string;
  createdAt: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerName: string | null;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPriceKes: number;
  lineTotalKes: number;
};

export type ReportLead = {
  createdAt: string;
  fullName: string;
  phone: string;
  email: string | null;
  location: string;
  productName: string;
  quantity: number | null;
  status: string;
  notes: string | null;
};

export type ReportWorkbookInput = {
  familyLabel: string;
  fromDate: string;
  toDate: string;
  generatedAt: Date;
  products: ReportProduct[];
  lines: ReportOrderLine[];
  leads: ReportLead[];
};

function moneyNum(value: number) {
  return Math.round(Number(value) || 0);
}

function statusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status;
}

function applyHeaderBar(sheet: ExcelJS.Worksheet, title: string, subtitle: string) {
  sheet.mergeCells("A1:H1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = COMPANY.name;
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: `FF${INK}` } };

  sheet.mergeCells("A2:H2");
  const sub = sheet.getCell("A2");
  sub.value = title;
  sub.font = { name: "Arial", size: 16, bold: true, color: { argb: `FF${ACCENT}` } };

  sheet.mergeCells("A3:H3");
  const meta = sheet.getCell("A3");
  meta.value = subtitle;
  meta.font = { name: "Arial", size: 10, color: { argb: `FF${MUTED}` } };

  sheet.getRow(1).height = 22;
  sheet.getRow(2).height = 24;
  sheet.getRow(3).height = 18;
}

function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.height = 22;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${HEADER_FILL}` } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: `FF${BORDER}` } },
    };
  }
}

function styleDataRow(row: ExcelJS.Row, colCount: number, alt: boolean) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = { name: "Arial", size: 10, color: { argb: `FF${INK}` } };
    cell.alignment = { vertical: "middle" };
    if (alt) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${ALT_ROW}` } };
    }
    cell.border = {
      bottom: { style: "hair", color: { argb: `FF${BORDER}` } },
    };
  }
}

function kesFormat(cell: ExcelJS.Cell) {
  cell.numFmt = '"KES "#,##0';
}

function qtyFormat(cell: ExcelJS.Cell) {
  cell.numFmt = "#,##0.##";
}

function setColWidths(sheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

function paidLines(lines: ReportOrderLine[]) {
  return lines.filter((line) => PAID_STATUSES.has(line.status));
}

function openLines(lines: ReportOrderLine[]) {
  return lines.filter((line) => OPEN_STATUSES.has(line.status));
}

export async function buildStockSalesWorkbook(input: ReportWorkbookInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY.name;
  wb.created = input.generatedAt;
  wb.modified = input.generatedAt;
  wb.title = `${input.familyLabel} stock & sales report`;

  const generatedLabel = input.generatedAt.toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const periodLabel = `${input.fromDate} → ${input.toDate}`;
  const subtitle = `Family: ${input.familyLabel}  ·  Period: ${periodLabel}  ·  Generated: ${generatedLabel}`;

  const products = [...input.products].sort((a, b) => a.name.localeCompare(b.name));
  const sales = paidLines(input.lines);
  const open = openLines(input.lines);

  const soldByProduct = new Map<string, { qty: number; value: number }>();
  for (const line of sales) {
    const key = line.productId ?? `name:${line.productName}`;
    const prev = soldByProduct.get(key) ?? { qty: 0, value: 0 };
    prev.qty += Number(line.quantity) || 0;
    prev.value += moneyNum(line.lineTotalKes);
    soldByProduct.set(key, prev);
  }

  const openByProduct = new Map<string, { qty: number; value: number }>();
  for (const line of open) {
    const key = line.productId ?? `name:${line.productName}`;
    const prev = openByProduct.get(key) ?? { qty: 0, value: 0 };
    prev.qty += Number(line.quantity) || 0;
    prev.value += moneyNum(line.lineTotalKes);
    openByProduct.set(key, prev);
  }

  const totalStock = products.reduce((s, p) => s + (Number(p.stock) || 0), 0);
  const totalSoldQty = sales.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const totalSoldValue = sales.reduce((s, l) => s + moneyNum(l.lineTotalKes), 0);
  const totalOpenQty = open.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const totalOpenValue = open.reduce((s, l) => s + moneyNum(l.lineTotalKes), 0);
  const activeSkus = products.filter((p) => p.is_active).length;

  // —— Summary ——
  {
    const sheet = wb.addWorksheet("Summary", {
      views: [{ state: "frozen", ySplit: 4 }],
    });
    applyHeaderBar(sheet, "Stock & sales summary", subtitle);
    setColWidths(sheet, [28, 22, 18, 18, 18, 18, 18, 18]);

    const metrics: [string, string | number, string?][] = [
      ["Product family", input.familyLabel],
      ["Report period", periodLabel],
      ["SKUs in family", products.length],
      ["Active SKUs", activeSkus],
      ["Stock on hand (pieces)", totalStock],
      ["Confirmed sales (pieces)", totalSoldQty],
      ["Confirmed sales value", totalSoldValue, "kes"],
      ["Open / unpaid (pieces)", totalOpenQty],
      ["Open / unpaid value", totalOpenValue, "kes"],
      ["Interest leads in period", input.leads.length],
    ];

    let row = 5;
    sheet.getCell(`A${row}`).value = "Key figures";
    sheet.getCell(`A${row}`).font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: `FF${INK}` },
    };
    row += 1;

    for (const [label, value, kind] of metrics) {
      sheet.getCell(`A${row}`).value = label;
      sheet.getCell(`A${row}`).font = { name: "Arial", size: 10, color: { argb: `FF${MUTED}` } };
      const valueCell = sheet.getCell(`B${row}`);
      valueCell.value = value;
      valueCell.font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${INK}` } };
      if (kind === "kes" && typeof value === "number") kesFormat(valueCell);
      if (typeof value === "number" && kind !== "kes") qtyFormat(valueCell);
      row += 1;
    }

    row += 1;
    sheet.getCell(`A${row}`).value = "How to read this workbook";
    sheet.getCell(`A${row}`).font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: `FF${INK}` },
    };
    row += 1;

    const notes = [
      "Stock by SKU — current on-hand stock from the catalog (yard / warehouse position today).",
      "Sales ledger — confirmed order lines in the period (Paid, Fulfilled, Shipped, Delivered).",
      "Open unpaid — orders still awaiting payment or confirmation for SKUs in this family.",
      "By customer — confirmed sales rolled up by customer for the period.",
      "Interest leads — expressions of interest (not sales) for matching products.",
      "Confirmed sales ≠ opening stock − current − unpaid. Full Sato-style recon needs stock receipts (coming later).",
    ];
    for (const note of notes) {
      sheet.mergeCells(`A${row}:H${row}`);
      sheet.getCell(`A${row}`).value = `• ${note}`;
      sheet.getCell(`A${row}`).font = { name: "Arial", size: 9, color: { argb: `FF${MUTED}` } };
      sheet.getRow(row).height = 16;
      row += 1;
    }

    row += 1;
    sheet.getCell(`A${row}`).value = `${COMPANY.address} · ${COMPANY.phone} · ${COMPANY.email}`;
    sheet.getCell(`A${row}`).font = { name: "Arial", size: 8, color: { argb: `FF${MUTED}` } };
  }

  // —— Stock by SKU ——
  {
    const sheet = wb.addWorksheet("Stock by SKU", {
      views: [{ state: "frozen", ySplit: 5 }],
    });
    applyHeaderBar(sheet, "Stock by SKU", subtitle);
    setColWidths(sheet, [28, 16, 14, 12, 14, 14, 16, 16, 14]);

    const headers = [
      "SKU / product",
      "Brand",
      "Category",
      "Unit",
      "Unit price",
      "Stock on hand",
      "Sold (period)",
      "Sales value",
      "Open unpaid qty",
    ];
    const headerRow = sheet.getRow(5);
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(headerRow, headers.length);

    let r = 6;
    const firstData = r;
    for (const product of products) {
      const key = product.id;
      const sold = soldByProduct.get(key) ?? { qty: 0, value: 0 };
      const unpaid = openByProduct.get(key) ?? { qty: 0, value: 0 };
      const row = sheet.getRow(r);
      row.getCell(1).value = product.name;
      row.getCell(2).value = product.brand ?? "—";
      row.getCell(3).value = product.category_name ?? "—";
      row.getCell(4).value = product.unit;
      row.getCell(5).value = moneyNum(product.price_kes);
      kesFormat(row.getCell(5));
      row.getCell(6).value = Number(product.stock) || 0;
      qtyFormat(row.getCell(6));
      row.getCell(7).value = sold.qty;
      qtyFormat(row.getCell(7));
      row.getCell(8).value = sold.value;
      kesFormat(row.getCell(8));
      row.getCell(9).value = unpaid.qty;
      qtyFormat(row.getCell(9));
      if (!product.is_active) {
        row.getCell(1).font = {
          name: "Arial",
          size: 10,
          italic: true,
          color: { argb: `FF${MUTED}` },
        };
      }
      styleDataRow(row, headers.length, (r - firstData) % 2 === 1);
      r += 1;
    }

    if (products.length === 0) {
      sheet.getCell(`A${r}`).value = "No products matched this family filter.";
      sheet.getCell(`A${r}`).font = {
        name: "Arial",
        size: 10,
        italic: true,
        color: { argb: `FF${MUTED}` },
      };
      r += 1;
    }

    const totalRow = sheet.getRow(r);
    totalRow.getCell(1).value = "TOTAL";
    totalRow.getCell(1).font = { name: "Arial", size: 10, bold: true };
    if (products.length > 0) {
      totalRow.getCell(6).value = { formula: `SUM(F${firstData}:F${r - 1})` };
      totalRow.getCell(7).value = { formula: `SUM(G${firstData}:G${r - 1})` };
      totalRow.getCell(8).value = { formula: `SUM(H${firstData}:H${r - 1})` };
      totalRow.getCell(9).value = { formula: `SUM(I${firstData}:I${r - 1})` };
    } else {
      totalRow.getCell(6).value = 0;
      totalRow.getCell(7).value = 0;
      totalRow.getCell(8).value = 0;
      totalRow.getCell(9).value = 0;
    }
    qtyFormat(totalRow.getCell(6));
    qtyFormat(totalRow.getCell(7));
    kesFormat(totalRow.getCell(8));
    qtyFormat(totalRow.getCell(9));
    for (let c = 1; c <= headers.length; c++) {
      totalRow.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8B089" },
      };
      totalRow.getCell(c).font = { name: "Arial", size: 10, bold: true };
    }
  }

  // —— Sales ledger ——
  {
    const sheet = wb.addWorksheet("Sales ledger", {
      views: [{ state: "frozen", ySplit: 5 }],
    });
    applyHeaderBar(sheet, "Confirmed sales ledger", subtitle);
    setColWidths(sheet, [12, 18, 22, 16, 28, 10, 12, 14, 16]);

    const headers = [
      "Date",
      "Order ref",
      "Customer",
      "Phone",
      "SKU",
      "Qty",
      "Unit price",
      "Line total",
      "Status",
    ];
    const headerRow = sheet.getRow(5);
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(headerRow, headers.length);

    const sorted = [...sales].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    let r = 6;
    const firstData = r;
    for (const line of sorted) {
      const row = sheet.getRow(r);
      row.getCell(1).value = new Date(line.createdAt);
      row.getCell(1).numFmt = "dd-mmm-yyyy";
      row.getCell(2).value = line.merchantReference;
      row.getCell(3).value = line.customerName || line.customerEmail || "—";
      row.getCell(4).value = line.customerPhone || "—";
      row.getCell(5).value = line.productName;
      row.getCell(6).value = Number(line.quantity) || 0;
      qtyFormat(row.getCell(6));
      row.getCell(7).value = moneyNum(line.unitPriceKes);
      kesFormat(row.getCell(7));
      row.getCell(8).value = moneyNum(line.lineTotalKes);
      kesFormat(row.getCell(8));
      row.getCell(9).value = statusLabel(line.status);
      row.getCell(9).font = {
        name: "Arial",
        size: 10,
        color: { argb: `FF${SUCCESS}` },
      };
      styleDataRow(row, headers.length, (r - firstData) % 2 === 1);
      r += 1;
    }

    if (sorted.length === 0) {
      sheet.getCell(`A${r}`).value = "No confirmed sales for this family in the selected period.";
      sheet.getCell(`A${r}`).font = {
        name: "Arial",
        size: 10,
        italic: true,
        color: { argb: `FF${MUTED}` },
      };
      r += 1;
    }

    const totalRow = sheet.getRow(r);
    totalRow.getCell(1).value = "TOTAL";
    totalRow.getCell(1).font = { name: "Arial", size: 10, bold: true };
    if (sorted.length > 0) {
      totalRow.getCell(6).value = { formula: `SUM(F${firstData}:F${r - 1})` };
      totalRow.getCell(8).value = { formula: `SUM(H${firstData}:H${r - 1})` };
    } else {
      totalRow.getCell(6).value = 0;
      totalRow.getCell(8).value = 0;
    }
    qtyFormat(totalRow.getCell(6));
    kesFormat(totalRow.getCell(8));
    for (let c = 1; c <= headers.length; c++) {
      totalRow.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8B089" },
      };
      totalRow.getCell(c).font = { name: "Arial", size: 10, bold: true };
    }
  }

  // —— Open unpaid ——
  {
    const sheet = wb.addWorksheet("Open unpaid", {
      views: [{ state: "frozen", ySplit: 5 }],
    });
    applyHeaderBar(sheet, "Open / unpaid (awaiting payment)", subtitle);
    setColWidths(sheet, [12, 18, 22, 16, 28, 10, 12, 14, 18]);

    const headers = [
      "Date",
      "Order ref",
      "Customer",
      "Phone",
      "SKU",
      "Qty",
      "Unit price",
      "Line total",
      "Status",
    ];
    const headerRow = sheet.getRow(5);
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(headerRow, headers.length);

    const sorted = [...open].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    let r = 6;
    const firstData = r;
    for (const line of sorted) {
      const row = sheet.getRow(r);
      row.getCell(1).value = new Date(line.createdAt);
      row.getCell(1).numFmt = "dd-mmm-yyyy";
      row.getCell(2).value = line.merchantReference;
      row.getCell(3).value = line.customerName || line.customerEmail || "—";
      row.getCell(4).value = line.customerPhone || "—";
      row.getCell(5).value = line.productName;
      row.getCell(6).value = Number(line.quantity) || 0;
      qtyFormat(row.getCell(6));
      row.getCell(7).value = moneyNum(line.unitPriceKes);
      kesFormat(row.getCell(7));
      row.getCell(8).value = moneyNum(line.lineTotalKes);
      kesFormat(row.getCell(8));
      row.getCell(9).value = statusLabel(line.status);
      row.getCell(9).font = {
        name: "Arial",
        size: 10,
        color: { argb: `FF${WARN}` },
      };
      styleDataRow(row, headers.length, (r - firstData) % 2 === 1);
      r += 1;
    }

    if (sorted.length === 0) {
      sheet.getCell(`A${r}`).value =
        "No open / unpaid lines for this family in the selected period.";
      sheet.getCell(`A${r}`).font = {
        name: "Arial",
        size: 10,
        italic: true,
        color: { argb: `FF${MUTED}` },
      };
      r += 1;
    }

    const totalRow = sheet.getRow(r);
    totalRow.getCell(1).value = "TOTAL";
    if (sorted.length > 0) {
      totalRow.getCell(6).value = { formula: `SUM(F${firstData}:F${r - 1})` };
      totalRow.getCell(8).value = { formula: `SUM(H${firstData}:H${r - 1})` };
    } else {
      totalRow.getCell(6).value = 0;
      totalRow.getCell(8).value = 0;
    }
    qtyFormat(totalRow.getCell(6));
    kesFormat(totalRow.getCell(8));
    for (let c = 1; c <= headers.length; c++) {
      totalRow.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8B089" },
      };
      totalRow.getCell(c).font = { name: "Arial", size: 10, bold: true };
    }
  }

  // —— By customer ——
  {
    const sheet = wb.addWorksheet("By customer", {
      views: [{ state: "frozen", ySplit: 5 }],
    });
    applyHeaderBar(sheet, "Confirmed sales by customer", subtitle);
    setColWidths(sheet, [28, 22, 16, 14, 16, 12]);

    type Agg = {
      name: string;
      email: string;
      phone: string;
      qty: number;
      value: number;
      orders: Set<string>;
    };
    const byCustomer = new Map<string, Agg>();
    for (const line of sales) {
      const key = (
        line.customerEmail ||
        line.customerPhone ||
        line.customerName ||
        line.orderId
      ).toLowerCase();
      const prev = byCustomer.get(key) ?? {
        name: line.customerName || line.customerEmail || "Customer",
        email: line.customerEmail || "—",
        phone: line.customerPhone || "—",
        qty: 0,
        value: 0,
        orders: new Set<string>(),
      };
      prev.qty += Number(line.quantity) || 0;
      prev.value += moneyNum(line.lineTotalKes);
      prev.orders.add(line.merchantReference);
      byCustomer.set(key, prev);
    }

    const headers = ["Customer", "Email", "Phone", "Orders", "Pieces", "Sales value"];
    const headerRow = sheet.getRow(5);
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(headerRow, headers.length);

    const rows = [...byCustomer.values()].sort((a, b) => b.value - a.value);
    let r = 6;
    const firstData = r;
    for (const agg of rows) {
      const row = sheet.getRow(r);
      row.getCell(1).value = agg.name;
      row.getCell(2).value = agg.email;
      row.getCell(3).value = agg.phone;
      row.getCell(4).value = agg.orders.size;
      row.getCell(5).value = agg.qty;
      qtyFormat(row.getCell(5));
      row.getCell(6).value = agg.value;
      kesFormat(row.getCell(6));
      styleDataRow(row, headers.length, (r - firstData) % 2 === 1);
      r += 1;
    }

    if (rows.length === 0) {
      sheet.getCell(`A${r}`).value = "No confirmed customers in this period.";
      sheet.getCell(`A${r}`).font = {
        name: "Arial",
        size: 10,
        italic: true,
        color: { argb: `FF${MUTED}` },
      };
      r += 1;
    }

    const totalRow = sheet.getRow(r);
    totalRow.getCell(1).value = "TOTAL";
    if (rows.length > 0) {
      totalRow.getCell(5).value = { formula: `SUM(E${firstData}:E${r - 1})` };
      totalRow.getCell(6).value = { formula: `SUM(F${firstData}:F${r - 1})` };
    } else {
      totalRow.getCell(5).value = 0;
      totalRow.getCell(6).value = 0;
    }
    qtyFormat(totalRow.getCell(5));
    kesFormat(totalRow.getCell(6));
    for (let c = 1; c <= headers.length; c++) {
      totalRow.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE8B089" },
      };
      totalRow.getCell(c).font = { name: "Arial", size: 10, bold: true };
    }
  }

  // —— Interest leads ——
  {
    const sheet = wb.addWorksheet("Interest leads", {
      views: [{ state: "frozen", ySplit: 5 }],
    });
    applyHeaderBar(sheet, "Interest leads (not sales)", subtitle);
    setColWidths(sheet, [12, 20, 14, 22, 18, 28, 10, 12, 28]);

    const headers = [
      "Date",
      "Name",
      "Phone",
      "Email",
      "Location",
      "Product",
      "Qty",
      "Status",
      "Notes",
    ];
    const headerRow = sheet.getRow(5);
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
    });
    styleHeaderRow(headerRow, headers.length);

    const sorted = [...input.leads].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    let r = 6;
    const firstData = r;
    for (const lead of sorted) {
      const row = sheet.getRow(r);
      row.getCell(1).value = new Date(lead.createdAt);
      row.getCell(1).numFmt = "dd-mmm-yyyy";
      row.getCell(2).value = lead.fullName;
      row.getCell(3).value = lead.phone;
      row.getCell(4).value = lead.email || "—";
      row.getCell(5).value = lead.location;
      row.getCell(6).value = lead.productName;
      row.getCell(7).value = lead.quantity ?? null;
      if (lead.quantity != null) qtyFormat(row.getCell(7));
      row.getCell(8).value = lead.status;
      row.getCell(9).value = lead.notes || "";
      styleDataRow(row, headers.length, (r - firstData) % 2 === 1);
      r += 1;
    }

    if (sorted.length === 0) {
      sheet.getCell(`A${r}`).value = "No interest leads for this family in the selected period.";
      sheet.getCell(`A${r}`).font = {
        name: "Arial",
        size: 10,
        italic: true,
        color: { argb: `FF${MUTED}` },
      };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function reportFilename(familyLabel: string, fromDate: string, toDate: string) {
  const safe =
    familyLabel
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "All";
  return `Amplus-${safe}-stock-sales-${fromDate}_to_${toDate}.xlsx`;
}
