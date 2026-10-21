import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LifeBuoy } from "lucide-react";
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
import { TicketThread } from "@/components/ticket-thread";
import { deleteSupportTickets } from "@/lib/admin-delete.functions";
import { formatDate, formatKes, orderHeadline } from "@/lib/format";
import { confirmBankPayment } from "@/lib/checkout.functions";
import { listStaffTickets, setTicketStatus } from "@/lib/support.functions";

type TicketRow = {
  id: string;
  ticket_number: string;
  merchant_reference: string | null;
  subject: string | null;
  kind: string;
  status: string;
  created_at: string;
  user_id: string;
  orders: {
    customer_phone: string | null;
    total_kes: number;
    status: string;
    merchant_reference: string;
    order_items: { product_name: string; quantity: number }[] | null;
  } | null;
};

export const Route = createFileRoute("/admin/tickets/")({
  component: AdminTicketsPage,
});

function AdminTicketsPage() {
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const tickets = useQuery({
    queryKey: ["admin-tickets"],
    retry: false,
    queryFn: async () => {
      const data = await listStaffTickets();
      return data as unknown as TicketRow[];
    },
  });

  const rows = useMemo(() => tickets.data ?? [], [tickets.data]);
  const ids = useMemo(() => rows.map((row) => row.id), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = ids.some((id) => selected.has(id));

  async function resolve(id: string) {
    try {
      await setTicketStatus({ data: { ticketId: id, status: "resolved" } });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the ticket.");
    }
  }

  async function confirm(ref: string) {
    setConfirming(ref);
    try {
      await confirmBankPayment({ data: { merchantReference: ref } });
      toast.success("Payment confirmed.");
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not confirm payment.");
    } finally {
      setConfirming(null);
    }
  }

  async function removeTickets(ticketIds: string[]) {
    setDeleting(true);
    try {
      const result = await deleteSupportTickets({ data: { ids: ticketIds } });
      toast.success(`Deleted ${result.deleted} ticket${result.deleted === 1 ? "" : "s"}`);
      setSelected(new Set());
      setOpenId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-count", "support_tickets"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete tickets.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <LifeBuoy className="size-6 text-accent" />
          <div>
            <h1 className="text-2xl">Tickets</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {rows.length} tickets. Open payment tickets can be confirmed here after you match
              M-Pesa or the bank.
            </p>
          </div>
        </div>
        {ids.length > 0 ? (
          <AdminSelectAll
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onCheckedChange={(next) => setSelected(next ? new Set(ids) : new Set())}
          />
        ) : null}
      </div>

      <div className="mt-6 space-y-3">
        <AdminBulkDeleteBar
          count={selected.size}
          noun="ticket"
          warning="Selected tickets and all of their messages will be permanently removed."
          deleting={deleting}
          onClear={() => setSelected(new Set())}
          onConfirm={() => removeTickets([...selected])}
        />
        {rows.map((ticket) => {
          const order = ticket.orders;
          const canConfirm =
            Boolean(ticket.merchant_reference) &&
            (order?.status === "PENDING_PAYMENT" || order?.status === "PAYMENT_PROCESSING");
          return (
            <div key={ticket.id} className="panel overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <div className="pt-1">
                  <AdminRowCheckbox
                    checked={selected.has(ticket.id)}
                    onCheckedChange={(next) => {
                      setSelected((prev) => {
                        const copy = new Set(prev);
                        if (next) copy.add(ticket.id);
                        else copy.delete(ticket.id);
                        return copy;
                      });
                    }}
                    label={`Select ticket ${ticket.ticket_number}`}
                  />
                </div>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 text-left"
                  onClick={() => setOpenId(openId === ticket.id ? null : ticket.id)}
                >
                  <div>
                    <p className="font-medium">{ticket.ticket_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.subject ??
                        (ticket.kind === "payment_verification" ? "Payment" : "General")}
                      {" · "}
                      {order
                        ? `${orderHeadline(order.order_items, order.merchant_reference)} · ${formatKes(order.total_kes)}`
                        : "No order"}{" "}
                      · {formatDate(ticket.created_at)}
                    </p>
                  </div>
                  <Badge variant={ticket.status === "resolved" ? "secondary" : "default"}>
                    {ticket.status.replaceAll("_", " ")}
                  </Badge>
                </button>
              </div>
              {openId === ticket.id ? (
                <div className="space-y-4 border-t border-border bg-secondary/30 p-4">
                  <div className="flex flex-wrap gap-2">
                    {ticket.merchant_reference ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/admin/orders">View orders</Link>
                      </Button>
                    ) : null}
                    {canConfirm && ticket.merchant_reference ? (
                      <Button
                        variant="accent"
                        size="sm"
                        disabled={confirming === ticket.merchant_reference}
                        onClick={() => void confirm(ticket.merchant_reference!)}
                      >
                        Confirm payment
                      </Button>
                    ) : null}
                    {ticket.status !== "resolved" ? (
                      <Button variant="ghost" size="sm" onClick={() => void resolve(ticket.id)}>
                        Mark resolved
                      </Button>
                    ) : null}
                    <AdminDeleteButton
                      label={`Delete ticket ${ticket.ticket_number}?`}
                      warning="This ticket and all of its messages will be permanently removed."
                      deleting={deleting}
                      onConfirm={() => removeTickets([ticket.id])}
                    />
                  </div>
                  <TicketThread
                    ticketId={ticket.id}
                    ticketNumber={ticket.ticket_number}
                    status={ticket.status}
                    orderRef={ticket.merchant_reference}
                    {...(order ? { amountKes: Number(order.total_kes) } : {})}
                    customerPhone={order?.customer_phone ?? null}
                    forStaff
                  />
                </div>
              ) : null}
            </div>
          );
        })}
        {!tickets.isLoading && rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No tickets yet.</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
