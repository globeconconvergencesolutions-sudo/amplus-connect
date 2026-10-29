import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminBulkDeleteBar,
  AdminDeleteButton,
  AdminRowCheckbox,
  AdminSelectAll,
} from "@/components/admin-bulk-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatKes, ORDER_STATUS_LABELS } from "@/lib/format";
import { deleteInvoices } from "@/lib/admin-delete.functions";
import { listCustomers, searchCustomers } from "@/lib/customers.functions";
import {
  createInvoice,
  createInvoiceFromOrder,
  deliverInvoice,
  downloadInvoicePdf,
  listInvoices,
  listProductsForInvoice,
  listRecentOrdersForInvoice,
  updateInvoiceStatus,
} from "@/lib/invoice.functions";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/invoices/")({
  component: AdminInvoicesPage,
});

type LineDraft = {
  key: string;
  productId: string | null;
  description: string;
  quantity: string;
  unit: string;
  unitPriceKes: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
  void: "Void",
};

function downloadBase64File(filename: string, mimeType: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function newLine(partial?: Partial<LineDraft>): LineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: null,
    description: "",
    quantity: "1",
    unit: "pc",
    unitPriceKes: "",
    ...partial,
  };
}

function AdminInvoicesPage() {
  const queryClient = useQueryClient();
  const invoices = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: () => listInvoices(),
  });
  const products = useQuery({
    queryKey: ["admin-invoice-products"],
    queryFn: () => listProductsForInvoice(),
  });
  const recentOrders = useQuery({
    queryKey: ["admin-invoice-orders"],
    queryFn: () => listRecentOrdersForInvoice(),
  });

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "issued" | "paid" | "void">(
    "all",
  );

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPin, setCustomerPin] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerLpo, setCustomerLpo] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState("16");
  const [paymentTerms, setPaymentTerms] = useState("Full payment to be done with order");
  const [documentKind, setDocumentKind] = useState<"invoice" | "proforma">("invoice");
  const [referenceText, setReferenceText] = useState("RFQ");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [remarks, setRemarks] = useState("");
  const [deliveryMeta, setDeliveryMeta] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [orderId, setOrderId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const rows = invoices.data ?? [];
    if (statusFilter === "all") return rows;
    return rows.filter((row) => row.status === statusFilter);
  }, [invoices.data, statusFilter]);

  const ids = useMemo(() => filtered.map((row) => row.id), [filtered]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = ids.some((id) => selected.has(id));
  const selectedRows = useMemo(
    () => filtered.filter((row) => selected.has(row.id)),
    [filtered, selected],
  );
  const selectedHasPaid = selectedRows.some((row) => row.status === "paid");

  const previewTotals = useMemo(() => {
    const taxRate = Number(taxRatePercent) || 0;
    const subtotal = lines.reduce((sum, line) => {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unitPriceKes) || 0;
      return sum + qty * price;
    }, 0);
    const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
  }, [lines, taxRatePercent]);

  function resetForm() {
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setCustomerPin("");
    setCustomerAddress("");
    setCustomerLpo("");
    setCustomerId(null);
    setCustomerSearch("");
    setDocumentKind("invoice");
    setReferenceText("RFQ");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate("");
    setTaxRatePercent("16");
    setPaymentTerms("Full payment to be done with order");
    setNotes("");
    setRemarks("");
    setDeliveryMeta("");
    setLines([newLine()]);
    setOrderId(null);
  }

  function addProductLine(productId: string) {
    const product = (products.data ?? []).find((row) => row.id === productId);
    if (!product) return;
    setLines((prev) => [
      ...prev.filter((line) => line.description.trim() || line.unitPriceKes.trim()),
      newLine({
        productId: product.id,
        description: product.name,
        unit: product.unit || "pc",
        unitPriceKes: String(Number(product.price_kes) || 0),
        quantity: "1",
      }),
    ]);
  }

  async function onCreate(issueNow: boolean) {
    const items = lines
      .map((line) => ({
        productId: line.productId,
        description: line.description.trim(),
        quantity: Number(line.quantity),
        unit: line.unit.trim() || "pc",
        unitPriceKes: Number(line.unitPriceKes),
      }))
      .filter((line) => line.description && line.quantity > 0);

    if (!customerName.trim()) {
      toast.error("Customer name is required.");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one line item.");
      return;
    }

    setSaving(true);
    try {
      const result = await createInvoice({
        data: {
          customerName: customerName.trim(),
          customerEmail,
          customerPhone,
          customerPin,
          customerAddress,
          customerLpo,
          customerId,
          documentKind,
          referenceText,
          issueDate,
          dueDate: dueDate || null,
          taxRatePercent: Number(taxRatePercent) || 0,
          notes,
          remarks,
          deliveryMeta,
          paymentTerms,
          orderId,
          items,
          issueNow,
        },
      });
      toast.success(`Invoice ${result.invoiceNumber} created`);
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      resetForm();
      setShowForm(false);
      await shareAfterCreate(result.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create invoice.");
    } finally {
      setSaving(false);
    }
  }

  async function shareAfterCreate(invoiceId: string) {
    try {
      const delivery = await deliverInvoice({ data: { invoiceId, sendEmail: true } });
      downloadBase64File(delivery.filename, delivery.mimeType, delivery.base64);
      if (delivery.emailSent) {
        toast.success(`PDF emailed to ${delivery.customerEmail}`);
      } else if (delivery.whatsappHref) {
        toast.message("No email — PDF downloaded; open WhatsApp to share", {
          action: {
            label: "WhatsApp",
            onClick: () => window.open(delivery.whatsappHref!, "_blank", "noopener,noreferrer"),
          },
        });
      }
    } catch (pdfError) {
      try {
        const pdf = await downloadInvoicePdf({ data: { invoiceId } });
        downloadBase64File(pdf.filename, pdf.mimeType, pdf.base64);
      } catch {
        /* ignore */
      }
      toast.error(
        pdfError instanceof Error
          ? `Invoice saved, but share failed: ${pdfError.message}`
          : "Invoice saved, but PDF share failed.",
      );
    }
  }

  async function onFromOrder(id: string) {
    setSaving(true);
    try {
      const result = await createInvoiceFromOrder({
        data: { orderId: id, taxRatePercent: Number(taxRatePercent) || 0, issueNow: true },
      });
      toast.success(`Invoice ${result.invoiceNumber} created from order`);
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      await shareAfterCreate(result.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create from order.");
    } finally {
      setSaving(false);
    }
  }

  async function onDownload(invoiceId: string) {
    setDownloadingId(invoiceId);
    try {
      const pdf = await downloadInvoicePdf({ data: { invoiceId } });
      downloadBase64File(pdf.filename, pdf.mimeType, pdf.base64);
      toast.success("PDF downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download PDF.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function onDeliver(invoiceId: string) {
    setDeliveringId(invoiceId);
    try {
      const result = await deliverInvoice({ data: { invoiceId, sendEmail: true } });
      downloadBase64File(result.filename, result.mimeType, result.base64);

      if (result.emailSent) {
        toast.success(`PDF emailed to ${result.customerEmail}`);
      } else if (result.whatsappHref) {
        toast.message("No email on this invoice — open WhatsApp to share the PDF", {
          action: {
            label: "WhatsApp",
            onClick: () => window.open(result.whatsappHref!, "_blank", "noopener,noreferrer"),
          },
        });
        window.open(result.whatsappHref, "_blank", "noopener,noreferrer");
      } else {
        toast.success("PDF downloaded — add email or phone on the invoice to share next time");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not deliver invoice.");
    } finally {
      setDeliveringId(null);
    }
  }

  async function onStatus(invoiceId: string, status: "issued" | "paid" | "void" | "draft") {
    try {
      await updateInvoiceStatus({ data: { invoiceId, status } });
      toast.success(`Marked ${(STATUS_LABEL[status] ?? status).toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update status.");
    }
  }

  async function removeInvoices(invoiceIds: string[]) {
    if (invoiceIds.length === 0) return;
    const paid = (invoices.data ?? []).filter(
      (row) => invoiceIds.includes(row.id) && row.status === "paid",
    );
    if (paid.length) {
      toast.error(
        `Cannot delete paid invoice${paid.length === 1 ? "" : "s"} ${paid.map((p) => p.invoice_number).join(", ")}. Void them first.`,
      );
      return;
    }
    setDeleting(true);
    try {
      const result = await deleteInvoices({ data: { ids: invoiceIds } });
      toast.success(`Deleted ${result.deleted} invoice${result.deleted === 1 ? "" : "s"}`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-customers"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete invoices.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent">
            Billing
          </p>
          <h1 className="mt-1 text-2xl tracking-tight sm:text-3xl">Invoices</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Generate Construction PDFs, email them when the customer has an address, or share via
            WhatsApp when they only have a phone. Paid invoices stay for audit (void before delete).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ids.length > 0 ? (
            <AdminSelectAll
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              onCheckedChange={(next) => setSelected(next ? new Set(ids) : new Set())}
            />
          ) : null}
          <Button
            variant="accent"
            className="rounded-full"
            onClick={() => {
              setShowForm((open) => !open);
              if (showForm) resetForm();
            }}
          >
            <Plus className="size-4" /> {showForm ? "Close form" : "New invoice"}
          </Button>
        </div>
      </div>

      {showForm ? (
        <section className="panel mt-6 space-y-6 p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg tracking-tight">New sales invoice</h2>
            <div className="text-sm text-muted-foreground">
              Preview total{" "}
              <span className="font-semibold text-foreground">
                {formatKes(previewTotals.total)}
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Document</Label>
              <Select
                value={documentKind}
                onValueChange={(value) => setDocumentKind(value as "invoice" | "proforma")}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="proforma">Proforma invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="inv-ref">Reference</Label>
              <Input
                id="inv-ref"
                className="mt-1.5"
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                placeholder="RFQ"
              />
            </div>
            <div>
              <Label htmlFor="inv-crm">CRM customer (optional)</Label>
              <CrmCustomerField
                search={customerSearch}
                onSearchChange={setCustomerSearch}
                customerId={customerId}
                onPick={(row) => {
                  setCustomerId(row.id);
                  setCustomerName(row.full_name);
                  setCustomerPhone(row.phone);
                  setCustomerEmail(row.email ?? "");
                  setCustomerAddress(row.location ?? "");
                  setCustomerSearch(row.full_name);
                }}
                onClear={() => {
                  setCustomerId(null);
                  setCustomerSearch("");
                }}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <Label htmlFor="inv-name">Customer name</Label>
              <Input
                id="inv-name"
                className="mt-1.5"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setCustomerId(null);
                }}
                placeholder="Customer or company"
              />
            </div>
            <div>
              <Label htmlFor="inv-phone">Phone</Label>
              <Input
                id="inv-phone"
                className="mt-1.5"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="inv-email">Email</Label>
              <Input
                id="inv-email"
                type="email"
                className="mt-1.5"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="inv-pin">Customer PIN (KRA)</Label>
              <Input
                id="inv-pin"
                className="mt-1.5"
                value={customerPin}
                onChange={(e) => setCustomerPin(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="inv-lpo">LPO / reference</Label>
              <Input
                id="inv-lpo"
                className="mt-1.5"
                value={customerLpo}
                onChange={(e) => setCustomerLpo(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="inv-address">Address</Label>
              <Input
                id="inv-address"
                className="mt-1.5"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="inv-issue">Issue date</Label>
              <Input
                id="inv-issue"
                type="date"
                className="mt-1.5"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="inv-due">Due date</Label>
              <Input
                id="inv-due"
                type="date"
                className="mt-1.5"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="inv-vat">VAT %</Label>
              <Input
                id="inv-vat"
                type="number"
                min={0}
                max={100}
                step="0.001"
                className="mt-1.5"
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Use 0 if VAT-exempt.</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="inv-terms">Payment terms</Label>
              <Input
                id="inv-terms"
                className="mt-1.5"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <Label>Line items</Label>
              <div className="flex flex-wrap gap-2">
                <select
                  className="flex h-9 max-w-xs rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addProductLine(e.target.value);
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">Add from catalog…</option>
                  {(products.data ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · {formatKes(product.price_kes)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setLines((prev) => [...prev, newLine()])}
                >
                  <Plus className="size-3.5" /> Blank line
                </Button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {lines.map((line, index) => (
                <div
                  key={line.key}
                  className="grid gap-2 rounded-xl border border-border bg-secondary/20 p-3 sm:grid-cols-[minmax(0,2fr)_5rem_5rem_7rem_auto]"
                >
                  <Input
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, description: e.target.value } : row,
                        ),
                      )
                    }
                  />
                  <Input
                    placeholder="Qty"
                    type="number"
                    min={0}
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, quantity: e.target.value } : row,
                        ),
                      )
                    }
                  />
                  <Input
                    placeholder="Unit"
                    value={line.unit}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, unit: e.target.value } : row,
                        ),
                      )
                    }
                  />
                  <Input
                    placeholder="Unit price"
                    type="number"
                    min={0}
                    value={line.unitPriceKes}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row, i) =>
                          i === index ? { ...row, unitPriceKes: e.target.value } : row,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="justify-self-end"
                    disabled={lines.length <= 1}
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="inv-delivery">Delivery / logistics</Label>
              <Textarea
                id="inv-delivery"
                className="mt-1.5"
                rows={2}
                placeholder="Driver, vehicle, transporter, gate pass…"
                value={deliveryMeta}
                onChange={(e) => setDeliveryMeta(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="inv-remarks">Remarks</Label>
              <Textarea
                id="inv-remarks"
                className="mt-1.5"
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="inv-notes">Notes</Label>
              <Textarea
                id="inv-notes"
                className="mt-1.5"
                rows={2}
                placeholder="e.g. VAT exempt note, WHT guidance…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="accent"
              className="rounded-full"
              disabled={saving}
              onClick={() => void onCreate(true)}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Receipt />}
              Issue & download PDF
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={saving}
              onClick={() => void onCreate(false)}
            >
              Save as draft
            </Button>
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Recent orders → invoice</h2>
        </div>
        <div className="panel divide-y divide-border">
          {(recentOrders.data ?? []).slice(0, 6).map((order) => (
            <div
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{order.merchant_reference}</p>
                <p className="text-xs text-muted-foreground">
                  {order.customer_email || "—"} · {formatDate(order.created_at)} ·{" "}
                  {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{formatKes(order.total_kes)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={saving}
                  onClick={() => void onFromOrder(order.id)}
                >
                  Invoice
                </Button>
              </div>
            </div>
          ))}
          {!recentOrders.isLoading && (recentOrders.data ?? []).length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No orders yet.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">All invoices</h2>
          <div className="flex flex-wrap gap-2">
            {(["all", "draft", "issued", "paid", "void"] as const).map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={statusFilter === key ? "accent" : "outline"}
                className="rounded-full"
                onClick={() => setStatusFilter(key)}
              >
                {key === "all" ? "All" : STATUS_LABEL[key]}
              </Button>
            ))}
          </div>
        </div>

        {invoices.isError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {invoices.error.message}
          </p>
        ) : null}

        <div className="space-y-3">
          <AdminBulkDeleteBar
            count={selected.size}
            noun="invoice"
            warning={
              selectedHasPaid
                ? "Paid invoices cannot be deleted — void them first, then delete. Other selected drafts/issued/void will be removed with their line items."
                : "Selected invoices and their line items will be permanently removed. Linked orders and CRM customers stay."
            }
            deleting={deleting}
            onClear={() => setSelected(new Set())}
            onConfirm={() => removeInvoices([...selected])}
          />
          {filtered.map((invoice) => (
            <div key={invoice.id} className="panel overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="pt-1">
                    <AdminRowCheckbox
                      checked={selected.has(invoice.id)}
                      onCheckedChange={(next) => {
                        setSelected((prev) => {
                          const copy = new Set(prev);
                          if (next) copy.add(invoice.id);
                          else copy.delete(invoice.id);
                          return copy;
                        });
                      }}
                      label={`Select invoice ${invoice.invoice_number}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">
                      {invoice.invoice_number}{" "}
                      <Badge variant="outline" className="ml-2">
                        {invoice.document_kind === "proforma" ? "Proforma" : "Invoice"}
                      </Badge>
                      <Badge
                        className={cn(
                          "ml-2",
                          invoice.status === "paid" && "bg-success text-white",
                          invoice.status === "issued" && "bg-accent text-accent-foreground",
                          invoice.status === "void" && "opacity-70",
                        )}
                        variant={invoice.status === "draft" ? "secondary" : "default"}
                      >
                        {STATUS_LABEL[invoice.status] ?? invoice.status}
                      </Badge>
                    </p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {invoice.customer_name}
                      {invoice.customer_phone ? ` · ${invoice.customer_phone}` : ""}
                      {invoice.customer_email ? ` · ${invoice.customer_email}` : ""} ·{" "}
                      {formatDate(invoice.issue_date)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatKes(invoice.total_kes)}</p>
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={downloadingId === invoice.id}
                      onClick={() => void onDownload(invoice.id)}
                    >
                      {downloadingId === invoice.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Download className="size-3.5" />
                      )}
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="accent"
                      className="rounded-full"
                      disabled={deliveringId === invoice.id}
                      onClick={() => void onDeliver(invoice.id)}
                    >
                      {deliveringId === invoice.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : invoice.customer_email ? (
                        <Mail className="size-3.5" />
                      ) : (
                        <MessageCircle className="size-3.5" />
                      )}
                      {invoice.customer_email ? "Email PDF" : "WhatsApp"}
                    </Button>
                    {invoice.status !== "paid" && invoice.status !== "void" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full"
                        onClick={() => void onStatus(invoice.id, "paid")}
                      >
                        <CheckCircle2 className="size-3.5" /> Paid
                      </Button>
                    ) : null}
                    {invoice.status !== "void" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-muted-foreground"
                        onClick={() => void onStatus(invoice.id, "void")}
                      >
                        Void
                      </Button>
                    ) : null}
                    {invoice.status !== "paid" ? (
                      <AdminDeleteButton
                        label={`Delete invoice ${invoice.invoice_number}?`}
                        warning="This invoice and its line items will be permanently removed. The linked order and CRM customer stay."
                        deleting={deleting}
                        onConfirm={() => removeInvoices([invoice.id])}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {!invoices.isLoading && !invoices.isError && filtered.length === 0 ? (
            <div className="panel flex flex-col items-center gap-2 px-4 py-12 text-center">
              <FileText className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No invoices yet. Create your first one.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}

function CrmCustomerField({
  search,
  onSearchChange,
  customerId,
  onPick,
  onClear,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  customerId: string | null;
  onPick: (row: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    location: string | null;
  }) => void;
  onClear: () => void;
}) {
  const allCustomers = useQuery({
    queryKey: ["admin-crm-customers"],
    queryFn: () => listCustomers(),
  });
  const results = useQuery({
    queryKey: ["admin-invoice-customer-search", search],
    enabled: search.trim().length >= 2 && !customerId,
    queryFn: () => searchCustomers({ data: { query: search.trim() } }),
  });

  return (
    <div className="mt-1.5 space-y-2">
      <Select
        value={customerId ?? ""}
        onValueChange={(id) => {
          if (!id) {
            onClear();
            return;
          }
          const row = (allCustomers.data ?? []).find((c) => c.id === id);
          if (row) onPick(row);
        }}
      >
        <SelectTrigger id="inv-crm">
          <SelectValue
            placeholder={
              allCustomers.isLoading
                ? "Loading…"
                : (allCustomers.data ?? []).length
                  ? "Browse CRM customers"
                  : "No CRM customers yet"
            }
          />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {(allCustomers.data ?? []).map((row) => (
            <SelectItem key={row.id} value={row.id}>
              {row.full_name} · {row.phone}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!customerId ? (
        <>
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Or search name / phone / email…"
          />
          {search.trim().length >= 2 ? (
            results.isLoading ? (
              <p className="text-xs text-muted-foreground">Searching…</p>
            ) : (results.data ?? []).length ? (
              <ul className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-1 text-sm">
                {(results.data ?? []).map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-secondary"
                      onClick={() => onPick(row)}
                    >
                      <span className="font-medium">{row.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.phone}
                        {row.email ? ` · ${row.email}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No CRM matches.</p>
            )
          ) : null}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Linked to CRM.{" "}
          <button type="button" className="underline hover:text-foreground" onClick={onClear}>
            Clear
          </button>
        </p>
      )}
    </div>
  );
}
