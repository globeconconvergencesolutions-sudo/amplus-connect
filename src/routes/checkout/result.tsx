import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { BankPaymentPanel } from "@/components/bank-payment-panel";
import { OrderTracking } from "@/components/order-tracking";
import { verifyPayment } from "@/lib/checkout.functions";
import { useAccount } from "@/hooks/use-auth";
import { ORDER_STATUS_LABELS } from "@/lib/format";

export const Route = createFileRoute("/checkout/result")({
  validateSearch: z.object({ ref: z.string() }),
  component: CheckoutResultPage,
});

function CheckoutResultPage() {
  const { ref } = Route.useSearch();
  const { user, loading } = useAccount();

  const verification = useQuery({
    queryKey: ["verify-payment", ref],
    enabled: Boolean(user),
    queryFn: () => verifyPayment({ data: { merchantReference: ref } }),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDING_PAYMENT" || status === "PAYMENT_PROCESSING" ? 8000 : false;
    },
  });

  if (loading || (verification.isLoading && !verification.data)) {
    return (
      <PageShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading your order…</p>
        </div>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
          <h1 className="text-2xl">Sign in to view this order</h1>
          <Button variant="accent" size="lg" className="mt-6" asChild>
            <Link to="/auth" search={{ redirect: "/checkout/result" }}>
              Sign in
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const status = verification.data?.status ?? (verification.error ? "ERROR" : "PENDING_PAYMENT");
  const isPaid =
    status === "PAID" || status === "FULFILLED" || status === "SHIPPED" || status === "DELIVERED";
  const isFailed =
    status === "PAYMENT_FAILED" || status === "PAYMENT_REVERSED" || status === "ERROR";
  const showBank = status === "PENDING_PAYMENT" || status === "PAYMENT_PROCESSING";

  return (
    <PageShell>
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <div className="text-center">
          {isPaid ? (
            <CheckCircle2 className="mx-auto size-14 text-success" />
          ) : isFailed ? (
            <XCircle className="mx-auto size-14 text-destructive" />
          ) : (
            <Clock className="mx-auto size-14 text-warning" />
          )}

          <h1 className="mt-6 text-2xl">
            {isPaid
              ? "Payment confirmed"
              : isFailed
                ? "Payment did not complete"
                : status === "PAYMENT_PROCESSING"
                  ? "Waiting for confirmation"
                  : "Pay by bank transfer"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {ORDER_STATUS_LABELS[status] ?? status}
          </p>
        </div>

        {isPaid && verification.data ? (
          <div className="mt-8 rounded-xl border border-border p-5 text-left">
            <OrderTracking
              status={status}
              deliveryOption={verification.data.deliveryOption}
              fulfilmentNote={verification.data.fulfilmentNote}
              orderRef={ref}
            />
          </div>
        ) : null}

        {showBank && verification.data ? (
          <BankPaymentPanel
            merchantReference={ref}
            amountKes={verification.data.totalKes}
            status={status}
            onReported={() => void verification.refetch()}
          />
        ) : null}

        {verification.data?.confirmationCode ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Reference you sent: {verification.data.confirmationCode}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="accent" asChild>
            <Link to="/account" search={{ tab: "orders" }}>
              View my orders
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/products">Continue shopping</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
