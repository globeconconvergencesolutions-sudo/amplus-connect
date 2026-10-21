import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Loader2, MessageCircle, Phone } from "lucide-react";
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
  listAdminOrders,
  sendDueOrderReminders,
  staffAdvanceFulfilment,
  staffCancelUnpaidOrder,
} from "@/lib/orders.functions";
import { customerCallHref, customerWhatsAppHref } from "@/lib/company";
import { isPaidPipeline, nextFulfilment } from "@/lib/fulfilment";
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

  const list = (orders.data ?? []).filter((order) => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      order.merchant_reference,
      order.customer_email,
      order.customer_phone,
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
                    <p className="font-medium">{order.merchant_reference}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.customer_email} · {order.customer_phone} ·{" "}
                      {formatDate(order.created_at)}
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
                        Delivery:{" "}
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
                            Delivery
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
