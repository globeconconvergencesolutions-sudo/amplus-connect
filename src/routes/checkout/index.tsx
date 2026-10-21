import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Loader2, MapPin, ShoppingCart, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { StaffGate } from "@/components/staff-gate";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DeliveryMap } from "@/components/delivery-map";
import { formatKes } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useAccount } from "@/hooks/use-auth";
import { CHECKOUT_PAYMENT_NOTE } from "@/lib/company";
import {
  deliveryDropPointsQuery,
  deliverySettingsQuery,
  loyaltySettingsQuery,
} from "@/lib/catalog";
import { createOrderAndStartPayment } from "@/lib/checkout.functions";
import {
  quoteDelivery,
  searchKenyaPlace,
  type KenyaPlace,
  type QuoteInput,
} from "@/lib/delivery.server";
import { KENYA_COUNTIES, type DeliveryMode } from "@/lib/delivery";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout/")({
  component: CheckoutRoute,
});

function CheckoutRoute() {
  return (
    <StaffGate>
      <CheckoutPage />
    </StaffGate>
  );
}

function CheckoutPage() {
  const { user, profile, loading } = useAccount();
  const { lines, subtotal, clear } = useCart();
  const loyaltySettings = useQuery(loyaltySettingsQuery());
  const settings = useQuery(deliverySettingsQuery());
  const points = useQuery(deliveryDropPointsQuery());
  const navigate = useNavigate();

  const [mode, setMode] = useState<DeliveryMode>("pickup");
  const [countyFilter, setCountyFilter] = useState("");
  const [dropPointId, setDropPointId] = useState<string | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [places, setPlaces] = useState<KenyaPlace[]>([]);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const dropPoints = useMemo(() => points.data ?? [], [points.data]);
  const counties = useMemo(() => {
    const fromPoints = [...new Set(dropPoints.map((row) => row.county))].sort();
    return fromPoints.length ? fromPoints : [...KENYA_COUNTIES];
  }, [dropPoints]);
  const filteredPoints = useMemo(
    () => dropPoints.filter((row) => (countyFilter ? row.county === countyFilter : true)),
    [dropPoints, countyFilter],
  );
  const selectedPoint = dropPoints.find((row) => row.id === dropPointId) ?? null;

  const quoteInput: QuoteInput | null =
    mode === "pickup"
      ? { mode: "pickup" }
      : mode === "drop_point" && dropPointId
        ? { mode: "drop_point", dropPointId }
        : mode === "site_pin" && pin
          ? { mode: "site_pin", lat: pin.lat, lng: pin.lng }
          : null;

  const quote = useQuery({
    queryKey: ["delivery-quote", quoteInput],
    enabled: Boolean(quoteInput),
    queryFn: async () => quoteDelivery({ data: quoteInput! }),
  });

  const availablePoints = profile?.loyalty_points ?? 0;
  const pointValue = Number(loyaltySettings.data?.point_value_kes ?? 1);
  const maxPercent = Number(loyaltySettings.data?.max_redeem_percent ?? 20);
  const maxDiscount = (subtotal * maxPercent) / 100;
  const maxRedeemablePoints = Math.max(
    0,
    Math.min(availablePoints, Math.floor(maxDiscount / Math.max(pointValue, 0.01))),
  );
  const discount = Math.min(pointsToRedeem, maxRedeemablePoints) * pointValue;
  const deliveryFee = quote.data?.allowed ? quote.data.feeKes : 0;
  const total = Math.max(subtotal + deliveryFee - discount, 0);

  const orderLines = useMemo(
    () => lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
    [lines],
  );

  const hq = {
    lat: Number(settings.data?.hq_lat ?? -1.3308),
    lng: Number(settings.data?.hq_lng ?? 36.8605),
    label: settings.data?.hq_label ?? "Amplus yard",
  };

  function choosePlace(place: KenyaPlace) {
    setMode("site_pin");
    setPin({ lat: place.lat, lng: place.lng });
    setPlaces([]);
    setSearch(place.label);
  }

  async function searchPlace() {
    const q = search.trim();
    if (q.length < 2) {
      toast.error("Type a town, stage, or building, then Find.");
      return;
    }
    setSearching(true);
    try {
      const rows = await searchKenyaPlace({ data: { query: q } });
      if (rows.length === 0) {
        setPlaces([]);
        toast.error("No Kenyan place matched that search. Drop a pin on the map instead.");
        return;
      }
      const only = rows[0];
      if (rows.length === 1 && only) {
        choosePlace(only);
        return;
      }
      setPlaces(rows);
    } catch (error) {
      setPlaces([]);
      toast.error(
        error instanceof Error ? error.message : "Place search is busy. Drop a pin on the map.",
      );
    } finally {
      setSearching(false);
    }
  }

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
        <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
          <h1 className="text-2xl tracking-tight">Online checkout needs an account</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            You do <span className="font-medium text-foreground">not</span> need to sign in to buy
            from Amplus. Open any product and use{" "}
            <span className="font-medium text-foreground">Express interest</span> — leave your name,
            phone, and location. Our team will contact you.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:mx-auto sm:max-w-sm">
            <Button variant="accent" size="lg" className="rounded-full" asChild>
              <Link to="/">
                Browse materials &amp; enquire <ArrowRight />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="rounded-full" asChild>
              <Link to="/auth" search={{ redirect: "/checkout" }}>
                Sign in for online checkout
              </Link>
            </Button>
            {lines.length > 0 ? (
              <Button variant="ghost" size="sm" className="rounded-full" asChild>
                <Link to="/cart">Back to cart ({lines.length})</Link>
              </Button>
            ) : null}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Sign-in is only for people who want to pay and track an order online themselves.
          </p>
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
            <Link to="/">Shop materials</Link>
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
      county: String(form.get("county") ?? "").trim() || selectedPoint?.county || "",
      town: String(form.get("town") ?? "").trim() || selectedPoint?.town || "",
      street: String(form.get("street") ?? "").trim() || selectedPoint?.name || "",
      notes: String(form.get("notes") ?? "").trim(),
      landmark: String(form.get("landmark") ?? "").trim() || selectedPoint?.landmark || "",
    };

    if (!address.recipient_name || !address.phone) {
      toast.error("Please provide a recipient name and phone number.");
      return;
    }
    if (!quoteInput || !quote.data?.allowed) {
      toast.error(quote.data?.message ?? "Choose a delivery location so we can price the trip.");
      return;
    }
    if (mode === "site_pin" && (!address.county || !address.landmark)) {
      toast.error("Add a county and a landmark (stage, building, or site name).");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createOrderAndStartPayment({
        data: {
          lines: orderLines,
          quote: quoteInput,
          pointsToRedeem: Math.min(pointsToRedeem, maxRedeemablePoints),
          address,
          origin: window.location.origin,
        },
      });

      clear();
      toast.success("Order placed. Transfer using the bank details on the next page.");
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
            <div className="panel p-5 sm:p-6">
              <h2 className="text-lg">Recipient</h2>
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
              </div>
            </div>

            <div className="panel p-5 sm:p-6">
              <h2 className="text-lg">How should we send this?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Delivery is priced from the Amplus yard on Mombasa Road to a drop point or a pin you
                place — not a flat “upcountry” fee.
              </p>
              <RadioGroup
                value={mode}
                onValueChange={(value) => {
                  setMode(value as DeliveryMode);
                  setDropPointId(null);
                }}
                className="mt-4 grid gap-3 sm:grid-cols-3"
              >
                <ModeCard
                  id="pickup"
                  icon={Warehouse}
                  title="Collect at yard"
                  detail="Free · Mombasa Road"
                />
                <ModeCard
                  id="drop_point"
                  icon={MapPin}
                  title="Drop point"
                  detail="Stage / landmark"
                />
                <ModeCard id="site_pin" icon={MapPin} title="Site pin" detail="Map the site" />
              </RadioGroup>

              {mode === "drop_point" ? (
                <div className="mt-6 space-y-4">
                  <div className="grid gap-2 sm:max-w-sm">
                    <Label htmlFor="county_filter">County</Label>
                    <select
                      id="county_filter"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={countyFilter}
                      onChange={(e) => {
                        setCountyFilter(e.target.value);
                        setDropPointId(null);
                      }}
                    >
                      <option value="">All counties with drop points</option>
                      {counties.map((county) => (
                        <option key={county} value={county}>
                          {county}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    {filteredPoints.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No drop points in that county yet. Use a site pin, or collect at the yard.
                      </p>
                    ) : (
                      filteredPoints.map((point) => (
                        <button
                          key={point.id}
                          type="button"
                          onClick={() => setDropPointId(point.id)}
                          className={cn(
                            "rounded-md border p-3 text-left text-sm transition-colors",
                            dropPointId === point.id
                              ? "border-accent bg-accent/5"
                              : "border-input hover:border-accent/50",
                          )}
                        >
                          <p className="font-semibold">{point.name}</p>
                          <p className="mt-0.5 text-muted-foreground">
                            {point.landmark} · {point.town}, {point.county}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                  <DeliveryMap hq={hq} dropPoints={filteredPoints} pin={selectedPoint} />
                </div>
              ) : null}

              {mode === "site_pin" ? (
                <div className="mt-6 space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search a town, stage, or building in Kenya"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void searchPlace();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void searchPlace()}
                      disabled={searching}
                    >
                      {searching ? <Loader2 className="animate-spin" /> : "Find"}
                    </Button>
                  </div>
                  {places.length > 0 ? (
                    <div className="grid gap-2">
                      {places.map((place) => (
                        <button
                          key={`${place.lat}-${place.lng}-${place.label}`}
                          type="button"
                          onClick={() => choosePlace(place)}
                          className="rounded-md border border-input p-3 text-left text-sm hover:border-accent/50"
                        >
                          {place.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Tap the map to drop a pin. That pin is the handover point we price from the
                    yard.
                  </p>
                  <DeliveryMap
                    hq={hq}
                    dropPoints={dropPoints}
                    pin={pin}
                    onPin={setPin}
                    interactive
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="county">County</Label>
                      <select
                        id="county"
                        name="county"
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Select county
                        </option>
                        {KENYA_COUNTIES.map((county) => (
                          <option key={county} value={county}>
                            {county}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="town">Town</Label>
                      <Input id="town" name="town" placeholder="e.g. Machakos" />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="landmark">Landmark / stage / building</Label>
                      <Input
                        id="landmark"
                        name="landmark"
                        placeholder="e.g. stage opposite Equity, or site next to…"
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {mode !== "site_pin" ? (
                <input type="hidden" name="county" value={selectedPoint?.county ?? ""} />
              ) : null}

              <div className="mt-4 grid gap-2">
                <Label htmlFor="notes">Notes for the driver (optional)</Label>
                <Textarea id="notes" name="notes" rows={3} />
              </div>

              <div className="mt-4 rounded-md bg-secondary/60 p-3 text-sm">
                {quote.isFetching ? (
                  <p className="text-muted-foreground">Pricing this location…</p>
                ) : quote.data?.allowed ? (
                  <p>
                    <span className="font-semibold">{formatKes(quote.data.feeKes)}</span>
                    {quote.data.km > 0
                      ? ` · about ${quote.data.km} km from the yard`
                      : " · yard collection"}
                    {quote.data.etaDays > 0
                      ? ` · ${quote.data.etaDays} working day${quote.data.etaDays === 1 ? "" : "s"}`
                      : null}
                  </p>
                ) : quote.data?.message ? (
                  <p className="text-destructive">{quote.data.message}</p>
                ) : mode === "pickup" ? (
                  <p>Yard collection is free.</p>
                ) : (
                  <p className="text-muted-foreground">
                    Choose a drop point or drop a pin to see the fee.
                  </p>
                )}
              </div>
            </div>

            {availablePoints > 0 ? (
              <div className="panel p-5 sm:p-6">
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
                <span>{deliveryFee > 0 ? formatKes(deliveryFee) : "Free"}</span>
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
              disabled={submitting || !quote.data?.allowed}
            >
              {submitting ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              {submitting ? "Placing order…" : "Place order"}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">{CHECKOUT_PAYMENT_NOTE}</p>
          </div>
        </form>
      </section>
    </PageShell>
  );
}

function ModeCard({
  id,
  icon: Icon,
  title,
  detail,
}: {
  id: string;
  icon: typeof Warehouse;
  title: string;
  detail: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer flex-col gap-1 rounded-md border border-input p-3 text-sm has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent/5"
    >
      <span className="flex items-center gap-2 font-medium">
        <RadioGroupItem value={id} id={id} />
        <Icon className="size-4 text-accent" />
        {title}
      </span>
      <span className="pl-7 text-xs text-muted-foreground">{detail}</span>
    </label>
  );
}
