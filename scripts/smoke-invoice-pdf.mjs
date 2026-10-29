/**
 * Regenerates preview/amplus-invoice-smoke.pdf via the real buildInvoicePdf.
 * Usage: npx --yes tsx scripts/smoke-invoice-pdf.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildInvoicePdf } from "../src/lib/invoice-pdf.server.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "preview", "amplus-invoice-smoke.pdf");

const buffer = await buildInvoicePdf({
  invoiceNumber: "9002003580",
  status: "issued",
  documentKind: "invoice",
  referenceText: "RFQ",
  issueDate: "2026-10-20",
  dueDate: "2026-10-27",
  customerName: "Firmbridge Smoke Test Ltd",
  customerEmail: "accounts@example.com",
  customerPhone: "+254700000000",
  customerPin: null,
  customerAddress: "Nairobi, Kenya",
  customerLpo: null,
  notes: null,
  remarks: null,
  deliveryMeta: null,
  paymentTerms: "Full payment to be done with order",
  taxRatePercent: 16,
  subtotalKes: 100000,
  taxKes: 16000,
  totalKes: 116000,
  items: [
    {
      description: "SATO Flex Pan — sample line",
      quantity: 2,
      unit: "pc",
      unitPriceKes: 35000,
      lineTotalKes: 70000,
    },
    {
      description: "Delivery & installation",
      quantity: 1,
      unit: "lot",
      unitPriceKes: 30000,
      lineTotalKes: 30000,
    },
  ],
});

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, buffer);
console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
