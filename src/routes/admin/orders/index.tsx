import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  UserRound,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatKes, ORDER_STATUS_LABELS } from "@/lib/format";
import { confirmBankPayment } from "@/lib/checkout.functions";
import { deleteOrders } from "@/lib/admin-delete.functions";
import {
  convertOrderToCustomer,
  createCustomer,
  createOrderFromCustomer,
  linkOrderToCustomer,
  listCustomers,
  searchCustomers,
} from "@/lib/customers.functions";
import {
  createInvoiceFromOrder,
  deliverInvoice,
  downloadInvoicePdf,
  listProductsForInvoice,
} from "@/lib/invoice.functions";
import {
  listAdminOrders,
  sendDueOrderReminders,
  staffAdvanceFulfilment,
  staffCancelUnpaidOrder,
} from "@/lib/orders.functions";
import { customerCallHref, customerWhatsAppHref } from "@/lib/company";
import { isPaidPipeline, isPickupOption, nextFulfilment } from "@/lib/fulfilment";
import { formatDeliveryDestination } from "@/lib/delivery";
import { OrderTracking } from "@/components/order-tracking";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const STATUSES = [
  "PENDING_PAYMENT",
  "PAYMENT_PROCESSING",
  "PAID",
  "PAYMENT_FAILED",
  "PAYMENT_REVERSED",
  "CANCELLED",
  "FULFILLED",
  "SHIPPED",
  "DELIVERED",
  "REFUND_REQUESTED",
] as const;

type OrderRow = {
  id: string;
  merchant_reference: string;
  status: string;
  total_kes: number;
  customer_email: string | null;
  customer_phone: string | null;
  customer_id: string | null;
  customers: { id: string; full_name: string; phone: string; email: string | null } | null;
  delivery_option: string | null;
  delivery_address?: unknown;
  fulfilment_note: string | null;
  created_at: string;
  order_items: { id: string; product_name: string; quantity: number; line_total_kes: number }[];
  payments: {
    id: string;
    payment_method: string | null;
    masked_account: string | null;
    confirmation_code: string | null;
    provider_status: string | null;
  }[];
};

export const Route = createFileRoute("/admin/orders/")({
  component: AdminOrdersPage,
});

function useAllOrders() {
  return useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => (await listAdminOrders()) as unknown as OrderRow[],
  });
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      onClick={() => void copy()}
    >
      <Copy className="size-4" />
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function AdminOrdersPage() {
  const orders = useAllOrders();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("PAYMENT_PROCESSING");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [fulfilNote, setFulfilNote] = useState("");
  const [reminding, setReminding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const list = (orders.data ?? []).filter((order) => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      order.merchant_reference,
      order.customer_email,
      order.customer_phone,
      order.customers?.full_name,
      order.customers?.phone,
      order.delivery_option,
      ...(order.order_items ?? []).map((item) => item.product_name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
  const ids = useMemo(() => list.map((row) => row.id), [list]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = ids.some((id) => selected.has(id));

  async function confirmPayment(merchantReference: string) {
    setConfirming(merchantReference);
    try {
      await confirmBankPayment({ data: { merchantReference } });
      toast.success("Payment confirmed. Stock and loyalty have been applied.");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-count"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not confirm this payment.");
    } finally {
      setConfirming(null);
    }
  }

  async function advanceFulfilment(order: OrderRow) {
    setAdvancing(order.id);
    try {
      const result = await staffAdvanceFulfilment({
        data: { orderId: order.id, note: fulfilNote },
      });
      toast.success(`${result.label}. The customer has been emailed.`);
      setFulfilNote("");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update delivery.");
    } finally {
      setAdvancing(null);
    }
  }

  async function cancelOrder(order: OrderRow) {
    setCancelling(order.id);
    try {
      await staffCancelUnpaidOrder({
        data: {
          orderId: order.id,
          allowProcessing: order.status === "PAYMENT_PROCESSING",
        },
      });
      toast.success("Order cancelled. Stock and loyalty were reconciled.");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-count"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel this order.");
    } finally {
      setCancelling(null);
    }
  }

  async function sendReminders() {
    setReminding(true);
    try {
      const result = await sendDueOrderReminders({ data: { origin: window.location.origin } });
      if (result.reason === "schema") {
        toast.error(
          "Run supabase/migrations/20260929153000_cancel_unpaid_orders.sql in the SQL editor first.",
        );
        return;
      }
      toast.success(
        result.sent === 0
          ? "No unpaid orders older than 24 hours needed a reminder."
          : `Sent ${result.sent} reminder${result.sent === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send reminders.");
    } finally {
      setReminding(false);
    }
  }

  async function removeOrders(orderIds: string[]) {
    setDeleting(true);
    try {
      const result = await deleteOrders({ data: { ids: orderIds } });
      toast.success(`Deleted ${result.deleted} order${result.deleted === 1 ? "" : "s"}`);
      setSelected(new Set());
      setExpanded(null);
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-count"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete orders.");
    } finally {
      setDeleting(false);
    }
  }

  const awaitingCount = (orders.data ?? []).filter(
    (order) => order.status === "PAYMENT_PROCESSING",
  ).length;

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.length} of {orders.data?.length ?? 0} orders
            {awaitingCount > 0 ? ` · ${awaitingCount} awaiting confirmation` : ""}
            {" · "}Create against a CRM customer for recurring buyers
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {ids.length > 0 ? (
            <AdminSelectAll
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              onCheckedChange={(next) => setSelected(next ? new Set(ids) : new Set())}
            />
          ) : null}
          <Button type="button" variant="accent" onClick={() => setShowCreate((open) => !open)}>
            <Plus className="size-4" />
            {showCreate ? "Close form" : "New order"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={reminding}
            onClick={() => void sendReminders()}
          >
            {reminding ? <Loader2 className="animate-spin" /> : null}
            Send 24h reminders
          </Button>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ref, phone, product…"
            className="w-full sm:w-56"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {ORDER_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showCreate ? (
        <NewOrderFromCrm
          onCreated={(orderId) => {
            setShowCreate(false);
            setExpanded(orderId);
            setStatusFilter("all");
            void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
            void queryClient.invalidateQueries({ queryKey: ["admin-crm-customers"] });
            void queryClient.invalidateQueries({ queryKey: ["admin-count"] });
          }}
        />
      ) : null}

      <div className="mt-6 space-y-3">
        <AdminBulkDeleteBar
          count={selected.size}
          noun="order"
          warning="Selected orders and their line items and payments will be permanently removed. Linked tickets keep the conversation but lose the order link."
          deleting={deleting}
          onClear={() => setSelected(new Set())}
          onConfirm={() => removeOrders([...selected])}
        />
        {list.map((order) => {
          const payment = order.payments[0];
          const receipt = payment?.confirmation_code?.trim() || "";
          const canConfirm =
            order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_PROCESSING";
          const callHref = customerCallHref(order.customer_phone);
          const waHref = customerWhatsAppHref(
            order.customer_phone,
            `Hello, this is Amplus regarding order ${order.merchant_reference}${receipt ? ` / M-Pesa ${receipt}` : ""}.`,
          );
          return (
            <div key={order.id} className="panel overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <div className="pt-1">
                  <AdminRowCheckbox
                    checked={selected.has(order.id)}
                    onCheckedChange={(next) => {
                      setSelected((prev) => {
                        const copy = new Set(prev);
                        if (next) copy.add(order.id);
                        else copy.delete(order.id);
                        return copy;
                      });
                    }}
                    label={`Select order ${order.merchant_reference}`}
                  />
                </div>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 text-left"
                  onClick={() => {
                    const next = expanded === order.id ? null : order.id;
                    setExpanded(next);
                    setFulfilNote(next ? (order.fulfilment_note ?? "") : "");
                  }}
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {order.merchant_reference}
                      {order.customers ? (
                        <Badge variant="outline" className="ml-2 font-normal">
                          CRM · {order.customers.full_name}
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.customers?.full_name ?? order.customer_email} · {order.customer_phone}{" "}
                      · {formatDate(order.created_at)}
                    </p>
                    {receipt ? (
                      <p className="mt-1 font-mono text-sm font-semibold text-accent">
                        Receipt {receipt}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold">{formatKes(order.total_kes)}</p>
                    <Badge
                      variant={
                        order.status === "PAID" || order.status === "DELIVERED"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ??
                        order.status}
                    </Badge>
                    {expanded === order.id ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </div>
                </button>
              </div>

              {expanded === order.id ? (
                <div className="border-t border-border bg-secondary/30 p-4">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Items
                      </h3>
                      <ul className="mt-2 space-y-1 text-sm">
                        {(order.order_items ?? []).map((item) => (
                          <li key={item.id} className="flex justify-between">
                            <span className="text-muted-foreground">
                              {item.product_name} × {item.quantity}
                            </span>
                            <span>{formatKes(item.line_total_kes)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {isPickupOption(order.delivery_option) ? "Collection" : "Delivery"}:{" "}
                        {formatDeliveryDestination(order.delivery_option, order.delivery_address)}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Payment to confirm
                      </h3>
                      {receipt ? (
                        <div className="mt-2 rounded-lg border border-accent/40 bg-background p-3">
                          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                            Customer M-Pesa / bank receipt
                          </p>
                          <div className="mt-1 flex items-center justify-between gap-3">
                            <p className="break-all font-mono text-lg font-bold leading-tight">
                              {receipt}
                            </p>
                            <CopyValue value={receipt} />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Search this code in M-Pesa or Equity, then confirm if the amount is{" "}
                            {formatKes(order.total_kes)}.
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {order.status === "PAYMENT_PROCESSING"
                            ? "This order was marked paid, but no receipt was saved. Ask the customer to open Pay now and tap I have paid again."
                            : "Customer has not submitted a receipt yet."}
                        </p>
                      )}
                      <dl className="mt-3 space-y-1 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Method</dt>
                          <dd>{payment?.payment_method ?? "—"}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Report</dt>
                          <dd>{payment?.provider_status ?? "—"}</dd>
                        </div>
                      </dl>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {callHref ? (
                          <Button type="button" variant="outline" size="sm" asChild>
                            <a href={callHref}>
                              <Phone className="size-4" /> Call
                            </a>
                          </Button>
                        ) : null}
                        {waHref ? (
                          <Button type="button" variant="outline" size="sm" asChild>
                            <a href={waHref} target="_blank" rel="noreferrer">
                              <MessageCircle className="size-4" /> WhatsApp
                            </a>
                          </Button>
                        ) : null}
                      </div>

                      {canConfirm ? (
                        <Button
                          type="button"
                          variant="accent"
                          className="mt-4 w-full"
                          disabled={confirming === order.merchant_reference}
                          onClick={() => void confirmPayment(order.merchant_reference)}
                        >
                          {confirming === order.merchant_reference ? (
                            <Loader2 className="animate-spin" />
                          ) : null}
                          Confirm payment
                        </Button>
                      ) : null}

                      {order.status === "PENDING_PAYMENT" ||
                      order.status === "PAYMENT_FAILED" ||
                      order.status === "PAYMENT_PROCESSING" ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-2 w-full"
                          disabled={cancelling === order.id}
                          onClick={() => {
                            if (order.status === "PAYMENT_PROCESSING") {
                              const ok = window.confirm(
                                "Only cancel if you have checked the bank and no payment landed. Continue?",
                              );
                              if (!ok) return;
                            }
                            void cancelOrder(order);
                          }}
                        >
                          {cancelling === order.id ? <Loader2 className="animate-spin" /> : null}
                          Cancel unpaid order
                        </Button>
                      ) : null}

                      {isPaidPipeline(order.status) ? (
                        <div className="mt-6 space-y-3 border-t border-border pt-4">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {isPickupOption(order.delivery_option) ? "Collection" : "Delivery"}
                          </h3>
                          <OrderTracking
                            status={order.status}
                            deliveryOption={order.delivery_option}
                            deliveryAddress={order.delivery_address}
                            fulfilmentNote={order.fulfilment_note}
                            orderRef={order.merchant_reference}
                          />
                          {nextFulfilment(order.status, order.delivery_option) ? (
                            <>
                              <div className="space-y-1.5">
                                <Label htmlFor={`note-${order.id}`}>
                                  Note to customer (optional)
                                </Label>
                                <Textarea
                                  id={`note-${order.id}`}
                                  rows={2}
                                  value={fulfilNote}
                                  onChange={(event) => setFulfilNote(event.target.value)}
                                  placeholder="e.g. Driver is 20 minutes away"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="accent"
                                className="w-full"
                                disabled={advancing === order.id}
                                onClick={() => void advanceFulfilment(order)}
                              >
                                {advancing === order.id ? (
                                  <Loader2 className="animate-spin" />
                                ) : null}
                                {nextFulfilment(order.status, order.delivery_option)?.label}
                              </Button>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">This order is complete.</p>
                          )}
                        </div>
                      ) : null}

                      {order.status === "CANCELLED" ? (
                        <p className="mt-4 text-sm text-muted-foreground">
                          This order is cancelled.
                        </p>
                      ) : null}

                      <OrderCrmActions
                        order={order}
                        onChanged={() =>
                          void queryClient.invalidateQueries({ queryKey: ["admin-orders"] })
                        }
                      />

                      <div className="mt-4 border-t border-border pt-4">
                        <AdminDeleteButton
                          label={`Delete order ${order.merchant_reference}?`}
                          warning="This order, its line items, and payments will be permanently removed. Linked tickets keep the conversation but lose the order link."
                          deleting={deleting}
                          onConfirm={() => removeOrders([order.id])}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {!orders.isLoading && list.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {statusFilter === "PAYMENT_PROCESSING"
              ? "No orders waiting for confirmation. Switch the filter to see all orders."
              : "No orders found."}
          </p>
        ) : null}
      </div>
    </AdminShell>
  );
}

function OrderCrmActions({ order, onChanged }: { order: OrderRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [q, setQ] = useState("");
  const allCustomers = useQuery({
    queryKey: ["admin-crm-customers"],
    enabled: linkOpen,
    queryFn: () => listCustomers(),
  });
  const results = useQuery({
    queryKey: ["admin-order-customer-search", q],
    enabled: linkOpen && q.trim().length >= 2,
    queryFn: () => searchCustomers({ data: { query: q.trim() } }),
  });

  async function convert() {
    setBusy(true);
    try {
      const result = await convertOrderToCustomer({ data: { orderId: order.id } });
      toast.success(result.created ? "Customer created and linked" : "Linked to existing customer");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not convert.");
    } finally {
      setBusy(false);
    }
  }

  async function link(customerId: string) {
    setBusy(true);
    try {
      const result = await linkOrderToCustomer({ data: { orderId: order.id, customerId } });
      toast.success(`Linked to ${result.customerName}`);
      setLinkOpen(false);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not link.");
    } finally {
      setBusy(false);
    }
  }

  async function invoiceFromOrder() {
    setBusy(true);
    try {
      const result = await createInvoiceFromOrder({
        data: { orderId: order.id, taxRatePercent: 16, issueNow: true },
      });
      toast.success(`Invoice ${result.invoiceNumber} created`);
      try {
        const delivery = await deliverInvoice({
          data: { invoiceId: result.id, sendEmail: true },
        });
        downloadBase64File(delivery.filename, delivery.mimeType, delivery.base64);
        if (delivery.emailSent) {
          toast.success(`PDF emailed to ${delivery.customerEmail}`);
        } else if (delivery.whatsappHref) {
          toast.message("No email — open WhatsApp to share the PDF", {
            action: {
              label: "WhatsApp",
              onClick: () => window.open(delivery.whatsappHref!, "_blank", "noopener,noreferrer"),
            },
          });
          window.open(delivery.whatsappHref, "_blank", "noopener,noreferrer");
        } else {
          toast.success("PDF downloaded");
        }
      } catch (pdfError) {
        try {
          const pdf = await downloadInvoicePdf({ data: { invoiceId: result.id } });
          downloadBase64File(pdf.filename, pdf.mimeType, pdf.base64);
        } catch {
          /* create already succeeded */
        }
        toast.error(
          pdfError instanceof Error
            ? `Invoice saved, but share failed: ${pdfError.message}`
            : "Invoice saved, but could not share the PDF.",
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create invoice.");
    } finally {
      setBusy(false);
    }
  }

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

  return (
    <div className="mt-6 space-y-3 border-t border-border pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        CRM customer
      </h3>
      {order.customers || order.customer_id ? (
        <p className="text-sm">
          Linked to{" "}
          <Link to="/admin/customers" className="font-medium text-accent hover:underline">
            {order.customers?.full_name ?? "customer"}
          </Link>
          {order.customers?.phone ? (
            <span className="text-muted-foreground"> · {order.customers.phone}</span>
          ) : null}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Not linked to a CRM customer yet.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {!order.customer_id ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void convert()}
            >
              <UserRound className="size-3.5" />
              Convert / match phone
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setLinkOpen((v) => !v)}
            >
              {linkOpen ? "Cancel link" : "Link existing"}
            </Button>
          </>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="accent"
          disabled={busy}
          onClick={() => void invoiceFromOrder()}
        >
          <FileText className="size-3.5" />
          Generate PDF
        </Button>
      </div>
      {linkOpen ? (
        <div className="space-y-3 rounded-lg border border-border bg-background p-3">
          <Select value="" onValueChange={(id) => void link(id)}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  allCustomers.isLoading
                    ? "Loading…"
                    : (allCustomers.data ?? []).length
                      ? `Browse all (${(allCustomers.data ?? []).length})`
                      : "No CRM customers"
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
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Or search name / phone / email…"
          />
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {(results.data ?? []).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-secondary"
                  onClick={() => void link(row.id)}
                >
                  <span className="font-medium">{row.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.phone}
                    {row.email ? ` · ${row.email}` : ""}
                  </span>
                </button>
              </li>
            ))}
            {q.trim().length >= 2 && !results.isLoading && (results.data ?? []).length === 0 ? (
              <li className="px-2 py-2 text-muted-foreground">No matches.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type CrmPick = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  location: string | null;
};

/** Create order from Orders page: pick (or quick-create) CRM customer, then lines. */
function NewOrderFromCrm({ onCreated }: { onCreated: (orderId: string) => void }) {
  const products = useQuery({
    queryKey: ["admin-invoice-products"],
    queryFn: () => listProductsForInvoice(),
  });
  const allCustomers = useQuery({
    queryKey: ["admin-crm-customers"],
    queryFn: () => listCustomers(),
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [customer, setCustomer] = useState<CrmPick | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickEmail, setQuickEmail] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [lines, setLines] = useState<{ productId: string; name: string; quantity: number }[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const customerResults = useQuery({
    queryKey: ["admin-new-order-customer-search", customerSearch],
    enabled: !customer && customerSearch.trim().length >= 2,
    queryFn: () => searchCustomers({ data: { query: customerSearch.trim() } }),
  });

  function pickCustomer(row: CrmPick) {
    setCustomer(row);
    setShowQuickCreate(false);
    setCustomerSearch("");
  }

  function pickFromDropdown(id: string) {
    const row = (allCustomers.data ?? []).find((c) => c.id === id);
    if (!row) return;
    pickCustomer({
      id: row.id,
      full_name: row.full_name,
      phone: row.phone,
      email: row.email,
      location: row.location,
    });
  }

  function addLine() {
    const product = (products.data ?? []).find((row) => row.id === productId);
    if (!product) return;
    const qty = Math.max(1, Number(quantity) || 1);
    setLines((prev) => {
      const existing = prev.find((line) => line.productId === product.id);
      if (existing) {
        return prev.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + qty } : line,
        );
      }
      return [...prev, { productId: product.id, name: product.name, quantity: qty }];
    });
    setQuantity("1");
  }

  async function quickCreateCustomer() {
    if (!quickName.trim() || !quickPhone.trim()) {
      toast.error("Name and phone are required.");
      return;
    }
    setBusy(true);
    try {
      const row = await createCustomer({
        data: {
          fullName: quickName.trim(),
          phone: quickPhone.trim(),
          email: quickEmail.trim(),
          location: "",
          notes: "Created from Orders · recurring buyer",
        },
      });
      setCustomer({
        id: row.id,
        full_name: row.full_name,
        phone: row.phone,
        email: row.email,
        location: row.location,
      });
      setShowQuickCreate(false);
      setCustomerSearch("");
      toast.success("CRM customer created — add products below");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create customer.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(markPaid: boolean) {
    if (!customer) {
      toast.error("Select or create a CRM customer first.");
      return;
    }
    if (!lines.length) {
      toast.error("Add at least one product line.");
      return;
    }
    setBusy(true);
    try {
      const result = await createOrderFromCustomer({
        data: {
          customerId: customer.id,
          lines: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
          notes,
          issuePendingPayment: !markPaid,
        },
      });
      toast.success(`Order ${result.merchantReference} linked to ${customer.full_name}`);
      onCreated(result.orderId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel mt-6 space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="text-lg tracking-tight">New order for CRM customer</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick from the list, search by details, or quick-create — then add products.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Customer</Label>
        {customer ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
            <div>
              <p className="font-medium">{customer.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {customer.phone}
                {customer.email ? ` · ${customer.email}` : ""}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setCustomer(null);
                setCustomerSearch("");
              }}
            >
              Change
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Browse all customers</p>
              <Select value="" onValueChange={pickFromDropdown}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      allCustomers.isLoading
                        ? "Loading customers…"
                        : (allCustomers.data ?? []).length
                          ? `Select customer (${(allCustomers.data ?? []).length})`
                          : "No CRM customers yet"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(allCustomers.data ?? []).map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.full_name} · {row.phone}
                      {row.email ? ` · ${row.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Or search</p>
              <Input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Type name, phone, or email…"
              />
              {customerSearch.trim().length >= 2 ? (
                <ul className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-1 text-sm">
                  {(customerResults.data ?? []).map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-secondary"
                        onClick={() => pickCustomer(row)}
                      >
                        <span className="font-medium">{row.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {row.phone}
                          {row.email ? ` · ${row.email}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                  {!customerResults.isLoading && (customerResults.data ?? []).length === 0 ? (
                    <li className="px-2 py-2 text-muted-foreground">No CRM match.</li>
                  ) : null}
                </ul>
              ) : null}
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setShowQuickCreate((v) => !v);
                if (!quickPhone && customerSearch.trim()) setQuickPhone(customerSearch.trim());
              }}
            >
              <UserRound className="size-3.5" />
              {showQuickCreate ? "Cancel new customer" : "New CRM customer"}
            </Button>
            {showQuickCreate ? (
              <div className="grid gap-2 rounded-lg border border-border bg-background p-3 sm:grid-cols-3">
                <Input
                  placeholder="Full name"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                />
                <Input
                  placeholder="Phone"
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                />
                <Input
                  placeholder="Email (optional)"
                  type="email"
                  value={quickEmail}
                  onChange={(e) => setQuickEmail(e.target.value)}
                />
                <div className="sm:col-span-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void quickCreateCustomer()}
                  >
                    Save customer & continue
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <Label>Products</Label>
        <div className="grid gap-2 sm:grid-cols-[1fr_5rem_auto]">
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger>
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              {(products.data ?? []).map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name} · {formatKes(product.price_kes)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-label="Quantity"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={addLine}
            disabled={!productId}
          >
            Add
          </Button>
        </div>
        <ul className="space-y-1 text-sm">
          {lines.map((line) => (
            <li key={line.productId} className="flex justify-between gap-2">
              <span>
                {line.name} × {line.quantity}
              </span>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() =>
                  setLines((prev) => prev.filter((row) => row.productId !== line.productId))
                }
              >
                Remove
              </button>
            </li>
          ))}
          {lines.length === 0 ? <li className="text-muted-foreground">No lines yet.</li> : null}
        </ul>
        <Textarea
          rows={2}
          placeholder="Order notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="accent"
            disabled={busy || !customer || !lines.length}
            onClick={() => void submit(false)}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Create (awaiting payment)
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !customer || !lines.length}
            onClick={() => void submit(true)}
          >
            Create as paid
          </Button>
        </div>
      </div>
    </section>
  );
}
