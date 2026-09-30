import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BankTransferDetails } from "@/components/bank-transfer-details";
import { reportBankPaymentSent } from "@/lib/checkout.functions";
import { createPaymentTicket } from "@/lib/support.functions";
import { supportLinks } from "@/lib/company";
import { formatKes } from "@/lib/format";

export function BankPaymentPanel({
  merchantReference,
  amountKes,
  status,
  onReported,
}: {
  merchantReference: string;
  amountKes: number;
  status: string;
  onReported?: () => void;
}) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticketNote, setTicketNote] = useState("");
  const [openingTicket, setOpeningTicket] = useState(false);
  const awaiting = status === "PENDING_PAYMENT";
  const reported = status === "PAYMENT_PROCESSING";
  const links = supportLinks({ orderRef: merchantReference, amountKes });

  async function reportPaid() {
    setSubmitting(true);
    try {
      await reportBankPaymentSent({
        data: { merchantReference, confirmationCode: code },
      });
      toast.success("Thanks. We will confirm once the transfer shows on the account.");
      onReported?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this order.");
    } finally {
      setSubmitting(false);
    }
  }

  async function openTicket() {
    const message =
      ticketNote.trim() ||
      `Please confirm payment for order ${merchantReference}. I have already paid via M-Pesa Pay Bill or bank transfer.`;
    setOpeningTicket(true);
    try {
      const result = await createPaymentTicket({
        data: { merchantReference, message },
      });
      toast.success(
        result.reused
          ? `You already have ticket ${result.ticketNumber}. Track it under Support.`
          : `Ticket ${result.ticketNumber} opened. Track it under Support.`,
      );
      onReported?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open a ticket.");
    } finally {
      setOpeningTicket(false);
    }
  }

  if (reported) {
    return (
      <div className="space-y-4 text-left">
        <div className="rounded-xl border border-border bg-secondary/50 p-4">
          <p className="text-sm font-semibold">We have your payment notice</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Staff will match {formatKes(amountKes)} against M-Pesa or the bank, then prepare delivery.
            You do not need to pay again.
          </p>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium">Taking longer than expected?</p>
          <Textarea
            rows={3}
            value={ticketNote}
            onChange={(event) => setTicketNote(event.target.value)}
            placeholder="Optional note for the team"
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            disabled={openingTicket}
            onClick={() => void openTicket()}
          >
            {openingTicket ? <Loader2 className="animate-spin" /> : null}
            Open a support ticket
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={links.callHref}>
                <Phone className="size-4" /> Call
              </a>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={links.whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            </Button>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link to="/account" search={{ tab: "support" }}>
                Track tickets
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!awaiting) return null;

  return (
    <div className="space-y-4 text-left">
      <div className="rounded-xl border border-border p-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-accent">
          Step 1 of 2 · Pay {formatKes(amountKes)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick M-Pesa or bank, copy the numbers, then send the exact amount.
        </p>
        <div className="mt-4">
          <BankTransferDetails merchantReference={merchantReference} amountKes={amountKes} />
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-accent">
          Step 2 of 2 · Tell us you paid
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          After M-Pesa or the bank confirms, paste the receipt code here. That is how we match your
          payment.
        </p>
        <div className="mt-3 space-y-2">
          <Label htmlFor={`bank-ref-${merchantReference}`}>M-Pesa or bank receipt</Label>
          <Input
            id={`bank-ref-${merchantReference}`}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="e.g. QGH7XXXXXX"
            className="min-h-11 font-mono"
          />
        </div>
        <Button
          type="button"
          variant="accent"
          className="mt-3 min-h-11 w-full"
          onClick={() => void reportPaid()}
          disabled={submitting || !code.trim()}
        >
          {submitting ? <Loader2 className="animate-spin" /> : null}
          I have paid
        </Button>
      </div>
    </div>
  );
}
