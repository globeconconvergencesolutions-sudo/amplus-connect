import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatKes } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useAccount } from "@/hooks/use-auth";
import { DELIVERY_OPTIONS } from "@/lib/company";
import { loyaltySettingsQuery } from "@/lib/catalog";
import { createOrderAndStartPayment } from "@/lib/checkout.functions";

export const Route = createFileRoute("/checkout/")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { user, profile, loading } = useAccount();
  const { lines, subtotal, clear } = useCart();
  const loyaltySettings = useQuery(loyaltySettingsQuery());
  const navigate = useNavigate();

  const [deliveryOption, setDeliveryOption] = useState(DELIVERY_OPTIONS[0]!.id);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const delivery =
    DELIVERY_OPTIONS.find((option) => option.id === deliveryOption) ?? DELIVERY_OPTIONS[0]!;
  const availablePoints = profile?.loyalty_points ?? 0;
  const pointValue = Number(loyaltySettings.data?.point_value_kes ?? 1);
  const maxPercent = Number(loyaltySettings.data?.max_redeem_percent ?? 20);
  const maxDiscount = (subtotal * maxPercent) / 100;
  const maxRedeemablePoints = Math.max(
    0,
    Math.min(availablePoints, Math.floor(maxDiscount / Math.max(pointValue, 0.01))),
  );
  const discount = Math.min(pointsToRedeem, maxRedeemablePoints) * pointValue;
  const total = Math.max(subtotal + delivery.fee - discount, 0);

  const orderLines = useMemo(
    () => lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
    [lines],
  );

  if (loading) {
    return (
      <PageShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
          <h1 className="text-2xl">Sign in to checkout</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You need an account to place an order.
          </p>
          <Button variant="accent" size="lg" className="mt-6" asChild>
            <Link to="/auth" search={{ redirect: "/checkout" }}>
              Sign in / register
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  if (lines.length === 0) {
    return (
      <PageShell>
        <div className="panel mx-auto flex max-w-md flex-col items-center gap-4 p-16 text-center">
          <ShoppingCart className="size-12 text-muted-foreground" />
          <h1 className="text-xl">Your cart is empty</h1>
          <Button variant="accent" asChild>
            <Link to="/products">Shop materials</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const address = {
      recipient_name: String(form.get("recipient_name") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      county: String(form.get("county") ?? "").trim(),
      town: String(form.get("town") ?? "").trim(),
      street: String(form.get("street") ?? "").trim(),
      notes: String(form.get("notes") ?? "").trim(),
    };

    if (!address.recipient_name || !address.phone) {
      toast.error("Please provide a recipient name and phone number.");
      return;
    }
    if (deliveryOption !== "pickup" && (!address.county || !address.town)) {
      toast.error("Please provide a county and town for delivery.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createOrderAndStartPayment({
        data: {
          lines: orderLines,
          deliveryOption,
          deliveryFee: delivery.fee,
          pointsToRedeem: Math.min(pointsToRedeem, maxRedeemablePoints),
          address,
          origin: window.location.origin,
        },
      });

      clear();

      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }

      toast.success(result.message ?? "Order placed.");
      navigate({ to: "/checkout/result", search: { ref: result.merchantReference } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not place your order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell>
      <PageHeader eyebrow="Almost there" title="Checkout" />
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <form onSubmit={onSubmit} className="grid gap-10 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <div className="panel p-6">
              <h2 className="text-lg">Delivery address</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="recipient_name">Recipient name</Label>
                  <Input
                    id="recipient_name"
                    name="recipient_name"
                    defaultValue={profile?.full_name ?? ""}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={profile?.phone ?? ""}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="county">County</Label>
                  <Input id="county" name="county" placeholder="e.g. Nairobi" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="town">Town</Label>
                  <Input id="town" name="town" placeholder="e.g. Westlands" />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="street">Street / building</Label>
                  <Input id="street" name="street" />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="notes">Delivery notes (optional)</Label>
                  <Textarea id="notes" name="notes" rows={3} />
                </div>
              </div>
            </div>

            <div className="panel p-6">
              <h2 className="text-lg">Delivery option</h2>
              <RadioGroup
                value={deliveryOption}
                onValueChange={setDeliveryOption}
                className="mt-4 space-y-3"
              >
                {DELIVERY_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    htmlFor={option.id}
                    className="flex cursor-pointer items-center justify-between rounded-md border border-input p-3 text-sm has-[[data-state=checked]]:border-accent"
                  >
                    <span className="flex items-center gap-3">
                      <RadioGroupItem value={option.id} id={option.id} />
                      {option.label}
                    </span>
                    <span className="font-semibold">
                      {option.fee > 0 ? formatKes(option.fee) : "Free"}
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {availablePoints > 0 ? (
              <div className="panel p-6">
                <h2 className="text-lg">Redeem loyalty points</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  You have {availablePoints} points available (worth{" "}
                  {formatKes(availablePoints * pointValue)}). Up to {maxPercent}% of your order can
                  be paid with points.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <Input
                    type="number"
                    min={0}
                    max={maxRedeemablePoints}
                    value={pointsToRedeem}
                    onChange={(e) => setPointsToRedeem(Math.max(0, Number(e.target.value) || 0))}
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPointsToRedeem(maxRedeemablePoints)}
                  >
                    Use max ({maxRedeemablePoints})
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="panel h-fit p-6">
            <h2 className="text-lg">Order summary</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {lines.map((line) => (
                <li key={line.productId} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {line.name} × {line.quantity}
                  </span>
                  <span>{formatKes(line.unitPrice * line.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatKes(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery</span>
                <span>{delivery.fee > 0 ? formatKes(delivery.fee) : "Free"}</span>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between text-success">
                  <span>Points discount</span>
                  <span>-{formatKes(discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatKes(total)}</span>
              </div>
            </div>
            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="mt-6 w-full"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              {submitting ? "Placing order…" : "Pay with M-Pesa / card"}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Payments are processed securely by Pesapal. You'll be redirected to complete payment.
            </p>
          </div>
        </form>
      </section>
    </PageShell>
  );
}
