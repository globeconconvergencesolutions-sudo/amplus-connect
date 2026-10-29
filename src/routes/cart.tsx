import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Minus, Package, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { formatKes } from "@/lib/format";
import { COLLECTION_ONLY } from "@/lib/company";
import { StaffGate } from "@/components/staff-gate";
import { useCart } from "@/lib/cart";
import { useAccount } from "@/hooks/use-auth";

export const Route = createFileRoute("/cart")({
  component: CartRoute,
});

function CartRoute() {
  return (
    <StaffGate>
      <CartPage />
    </StaffGate>
  );
}

function CartPage() {
  const { lines, subtotal, setQuantity, remove, clear } = useCart();
  const { user, loading } = useAccount();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Your order"
        title="Shopping cart"
        description="Online checkout is optional and needs an account. Most customers open a product and use Express interest — no sign-in."
      />

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {lines.length === 0 ? (
          <div className="panel flex flex-col items-center gap-4 p-16 text-center">
            <ShoppingCart className="size-12 text-muted-foreground" />
            <h2 className="text-xl">Your cart is empty</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Browse materials and leave your details on the product page — no account needed. Or
              sign in later if you prefer to checkout online.
            </p>
            <Button variant="accent" asChild>
              <Link to="/">
                Shop materials <ArrowRight />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg">
                  {lines.length} item{lines.length === 1 ? "" : "s"}
                </h2>
                <Button variant="ghost" size="sm" onClick={clear}>
                  Clear cart
                </Button>
              </div>

              <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
                {lines.map((line) => (
                  <li
                    key={line.productId}
                    className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
                      {line.imageUrl ? (
                        <img
                          src={line.imageUrl}
                          alt={line.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="size-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/products/$slug"
                        params={{ slug: line.slug }}
                        className="font-medium hover:text-accent"
                      >
                        {line.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatKes(line.unitPrice)} per {line.unit}
                      </p>
                      <Link
                        to="/products/$slug"
                        params={{ slug: line.slug }}
                        hash="express-interest"
                        className="mt-1 inline-block text-xs font-medium text-accent hover:underline"
                      >
                        Express interest on this product →
                      </Link>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center rounded-md border border-input">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setQuantity(line.productId, line.quantity - 1)}
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold">
                          {line.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setQuantity(line.productId, line.quantity + 1)}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                      <p className="w-24 shrink-0 text-right font-semibold">
                        {formatKes(line.unitPrice * line.quantity)}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove"
                        onClick={() => remove(line.productId)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel h-fit p-6">
              <h2 className="text-lg">Order summary</h2>
              <div className="mt-4 flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{formatKes(subtotal)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {COLLECTION_ONLY
                  ? "Free collection from the Amplus yard, Mombasa Road."
                  : "Delivery fee is calculated at checkout."}
              </p>

              {!loading && !user ? (
                <div className="mt-5 rounded-xl border border-dashed border-border bg-secondary/40 p-4 text-sm">
                  <p className="font-medium">No account needed for most orders</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Open any product and use <span className="font-medium">Express interest</span>.
                    We will call you. Online checkout below requires sign-in.
                  </p>
                  <Button variant="accent" size="sm" className="mt-3 w-full rounded-full" asChild>
                    <Link to="/">
                      Browse &amp; enquire <ArrowRight />
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="mt-2 w-full rounded-full" asChild>
                    <Link to="/auth" search={{ redirect: "/checkout" }}>
                      Sign in to checkout
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button variant="accent" size="lg" className="mt-6 w-full" asChild>
                  <Link to="/checkout">
                    Proceed to checkout <ArrowRight />
                  </Link>
                </Button>
              )}

              <Button variant="ghost" size="sm" className="mt-2 w-full" asChild>
                <Link to="/">Continue shopping</Link>
              </Button>
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}
