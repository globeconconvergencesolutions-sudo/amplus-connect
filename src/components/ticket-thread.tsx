import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ticketMessagesQuery } from "@/lib/account";
import { addTicketReply } from "@/lib/support.functions";
import { customerCallHref, customerWhatsAppHref, supportLinks } from "@/lib/company";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  waiting_on_us: "Waiting on Amplus",
  waiting_on_you: "Waiting on you",
  resolved: "Resolved",
};

export function TicketThread({
  ticketId,
  ticketNumber,
  status,
  orderRef,
  amountKes,
  customerPhone,
  forStaff,
}: {
  ticketId: string;
  ticketNumber: string;
  status: string;
  orderRef?: string | null;
  amountKes?: number;
  customerPhone?: string | null;
  forStaff?: boolean;
}) {
  const messages = useQuery(ticketMessagesQuery(ticketId));
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const shopLinks = supportLinks({
    ticketNumber,
    ...(orderRef ? { orderRef } : {}),
    ...(amountKes != null ? { amountKes } : {}),
  });
  const staffWhatsApp = customerWhatsAppHref(
    customerPhone,
    `Hello, this is Amplus regarding ticket ${ticketNumber}${orderRef ? ` / order ${orderRef}` : ""}.`,
  );
  const staffCall = customerCallHref(customerPhone);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    try {
      await addTicketReply({ data: { ticketId, body: body.trim() } });
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["support-ticket-messages", ticketId] });
      await queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send that reply.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {STATUS_LABEL[status] ?? status}
          {orderRef ? ` · ${orderRef}` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {forStaff ? (
            <>
              {staffCall ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={staffCall}>
                    <Phone className="size-4" /> Call customer
                  </a>
                </Button>
              ) : null}
              {staffWhatsApp ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={staffWhatsApp} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" /> WhatsApp customer
                  </a>
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={shopLinks.callHref}>
                  <Phone className="size-4" /> Call
                </a>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={shopLinks.whatsappHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </Button>
            </>
          )}
        </div>
      </div>

      <ul className="space-y-2">
        {(messages.data ?? []).map((row) => (
          <li
            key={row.id}
            className={`rounded-md p-3 text-sm ${row.from_staff ? "bg-secondary/80" : "border border-border"}`}
          >
            <p className="text-xs text-muted-foreground">
              {row.from_staff ? "Amplus" : forStaff ? "Customer" : "You"}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{row.body}</p>
          </li>
        ))}
      </ul>

      {status !== "resolved" ? (
        <div className="space-y-2">
          <Textarea
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a reply"
          />
          <Button type="button" variant="accent" size="sm" disabled={sending} onClick={() => void send()}>
            {sending ? <Loader2 className="animate-spin" /> : null}
            Send
          </Button>
        </div>
      ) : null}
    </div>
  );
}
