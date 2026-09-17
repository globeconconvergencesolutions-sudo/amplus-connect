import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatKes, ORDER_STATUS_LABELS } from "@/lib/format";

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*), payments(*)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as OrderRow[];
    },
  });
}

function AdminOrdersPage() {
  const orders = useAllOrders();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const list = (orders.data ?? []).filter(
    (order) => statusFilter === "all" || order.status === statusFilter,
  );

  async function updateStatus(id: string, status: (typeof STATUSES)[number]) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Order status updated");
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  }

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.length} of {orders.data?.length ?? 0} orders
          </p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56">
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

      <div className="mt-6 space-y-3">
        {list.map((order) => (
          <div key={order.id} className="panel overflow-hidden">
            <button
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
              onClick={() => setExpanded(expanded === order.id ? null : order.id)}
            >
              <div>
                <p className="font-medium">{order.merchant_reference}</p>
                <p className="text-xs text-muted-foreground">
                  {order.customer_email} · {order.customer_phone} · {formatDate(order.created_at)}
                </p>
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

            {expanded === order.id ? (
              <div className="border-t border-border bg-secondary/30 p-4">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Items
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm">
                      {order.order_items.map((item) => (
                        <li key={item.id} className="flex justify-between">
                          <span className="text-muted-foreground">
                            {item.product_name} × {item.quantity}
                          </span>
                          <span>{formatKes(item.line_total_kes)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Delivery: {order.delivery_option ?? "—"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Payment
                    </h3>
                    {order.payments.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">No payment record yet.</p>
                    ) : (
                      order.payments.map((payment) => (
                        <dl key={payment.id} className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Method</dt>
                            <dd>{payment.payment_method ?? "—"}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Account</dt>
                            <dd>{payment.masked_account ?? "—"}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Confirmation</dt>
                            <dd>{payment.confirmation_code ?? "—"}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Provider status</dt>
                            <dd>{payment.provider_status ?? "—"}</dd>
                          </div>
                        </dl>
                      ))
                    )}

                    <div className="mt-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Update status
                      </h3>
                      <Select
                        value={order.status}
                        onValueChange={(value) =>
                          updateStatus(order.id, value as (typeof STATUSES)[number])
                        }
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {ORDER_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {!orders.isLoading && list.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No orders found.</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
