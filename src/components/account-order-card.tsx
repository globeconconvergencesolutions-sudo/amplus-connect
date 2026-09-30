import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BankPaymentPanel } from "@/components/bank-payment-panel";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatKes, ORDER_STATUS_LABELS } from "@/lib/format";
import { cancelMyUnpaidOrder } from "@/lib/orders.functions";
import { isPaidPipeline } from "@/lib/fulfilment";
import { useCart } from "@/lib/cart";
import { OrderTracking } from "@/components/order-tracking";

export type AccountOrder = {
  id: string;
  merchant_reference: string;
  status: string;
  total_kes: number;
  created_at: string;
  delivery_option?: string | null;
  fulfilment_note?: string | null;
  order_items: { id: string; product_name: string; quantity: number; line_total_kes: number }[] | null;
};

export function AccountOrderCard({
  order,
  onUpdated,
}: {
  order: AccountOrder;
  onUpdated: () => void;
}) {
  const cart = useCart();
  const queryClient = useQueryClient();
  const [showItems, setShowItems] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [restoreCart, setRestoreCart] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const items = order.order_items ?? [];
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const headline = items[0]?.product_name ?? order.merchant_reference;
  const extraSkus = Math.max(items.length - 1, 0);
  const awaiting = order.status === "PENDING_PAYMENT";
  const processing = order.status === "PAYMENT_PROCESSING";
  const canCancel = order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_FAILED";

  async function confirmCancel() {
    setCancelling(true);
    try {
      const result = await cancelMyUnpaidOrder({ data: { orderId: order.id } });
      if (restoreCart) {
        for (const line of result.cartLines) {
          cart.add(
            {
              productId: line.productId,
              name: line.name,
              slug: line.slug,
              unitPrice: line.unitPrice,
              unit: line.unit,
              imageUrl: line.imageUrl,
            },
            line.quantity,
          );
        }
      }
      const restored =
        result.pointsRestored > 0 ? ` ${result.pointsRestored} loyalty points were returned.` : "";
      const cartNote =
        restoreCart && result.cartLines.length > 0
          ? " The materials are back in your cart when you are ready."
          : "";
      toast.success(`Order ${result.merchantReference} cancelled.${restored}${cartNote}`);
      setCancelOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["loyalty-history"] });
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel this order.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <article className="panel overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-snug">{headline}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {extraSkus > 0 ? `+${extraSkus} more · ` : ""}
            {count} {count === 1 ? "item" : "items"} · {formatDate(order.created_at)}
          </p>
          <p className="mt-0.5 truncate font-mono text-[0.7rem] text-muted-foreground">
            {order.merchant_reference}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold">{formatKes(order.total_kes)}</p>
          <Badge
            className="mt-1"
            variant={
              order.status === "PAID" || order.status === "DELIVERED"
                ? "default"
                : order.status === "CANCELLED"
                  ? "outline"
                  : "secondary"
            }
          >
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
        {awaiting ? (
          <Button type="button" variant="accent" className="min-h-11 flex-1 sm:flex-none" onClick={() => setPayOpen(true)}>
            Pay now
          </Button>
        ) : null}
        {processing ? (
          <Button type="button" variant="accent" className="min-h-11 flex-1 sm:flex-none" onClick={() => setPayOpen(true)}>
            Payment status
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => setShowItems((value) => !value)}
        >
          {showItems ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {showItems ? "Hide items" : "Items"}
        </Button>
        {canCancel ? (
          <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" className="min-h-11 text-muted-foreground">
                Cancel
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this unpaid order?</AlertDialogTitle>
                <AlertDialogDescription>
                  {headline} will leave your active list. Loyalty points used here are returned.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-current"
                  checked={restoreCart}
                  onChange={(event) => setRestoreCart(event.target.checked)}
                />
                <span>Put these items back in my cart</span>
              </label>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={cancelling}>Keep order</AlertDialogCancel>
                <Button type="button" variant="destructive" disabled={cancelling} onClick={() => void confirmCancel()}>
                  {cancelling ? <Loader2 className="animate-spin" /> : null}
                  Cancel order
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>

      {isPaidPipeline(order.status) ? (
        <div className="border-t border-border px-4 py-4">
          <OrderTracking
            status={order.status}
            deliveryOption={order.delivery_option}
            fulfilmentNote={order.fulfilment_note}
            orderRef={order.merchant_reference}
          />
        </div>
      ) : null}

      {showItems ? (
        <ul className="space-y-2 border-t border-border bg-secondary/30 px-4 py-3 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {item.product_name} × {item.quantity}
              </span>
              <span className="shrink-0 font-medium">{formatKes(item.line_total_kes)}</span>
            </li>
          ))}
          <li className="flex justify-between border-t border-border pt-2 font-semibold">
            <span>Total</span>
            <span>{formatKes(order.total_kes)}</span>
          </li>
        </ul>
      ) : null}

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{awaiting ? "Pay for this order" : "Payment status"}</DialogTitle>
            <DialogDescription>
              {headline} · {formatKes(order.total_kes)}
            </DialogDescription>
          </DialogHeader>
          <BankPaymentPanel
            merchantReference={order.merchant_reference}
            amountKes={Number(order.total_kes)}
            status={order.status}
            onReported={() => {
              onUpdated();
              if (order.status === "PENDING_PAYMENT") setPayOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </article>
  );
}
