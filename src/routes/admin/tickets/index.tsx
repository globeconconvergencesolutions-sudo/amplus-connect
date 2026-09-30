import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TicketThread } from "@/components/ticket-thread";
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

  const tickets = useQuery({
    queryKey: ["admin-tickets"],
    retry: false,
    queryFn: async () => {
      const data = await listStaffTickets();
      return data as unknown as TicketRow[];
    },
  });

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

  return (
    <AdminShell>
      <div className="flex items-center gap-3">
        <LifeBuoy className="size-6 text-accent" />
        <div>
          <h1 className="text-2xl">Tickets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tickets.data?.length ?? 0} tickets. Open payment tickets can be confirmed here after you
            match M-Pesa or the bank.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {(tickets.data ?? []).map((ticket) => {
          const order = ticket.orders;
          const canConfirm =
            Boolean(ticket.merchant_reference) &&
            (order?.status === "PENDING_PAYMENT" || order?.status === "PAYMENT_PROCESSING");
          return (
            <div key={ticket.id} className="panel overflow-hidden">
              <button
                type="button"
                className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
                onClick={() => setOpenId(openId === ticket.id ? null : ticket.id)}
              >
                <div>
                  <p className="font-medium">{ticket.ticket_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.subject ?? (ticket.kind === "payment_verification" ? "Payment" : "General")}
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
        {!tickets.isLoading && (tickets.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No tickets yet.</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
