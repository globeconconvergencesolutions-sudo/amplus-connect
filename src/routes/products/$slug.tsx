import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Heart, Minus, Package, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { formatKes } from "@/lib/format";
import { productQuery, relatedProductsQuery } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { productImageUrls } from "@/lib/media";
import { useCart } from "@/lib/cart";
import { useAccount } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { wishlistQuery } from "@/lib/account";

export const Route = createFileRoute("/products/$slug")({
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { slug } = Route.useParams();
  const product = useQuery(productQuery(slug));
  const related = useQuery({
    ...relatedProductsQuery(product.data?.category_id ?? null, product.data?.id ?? ""),
    enabled: Boolean(product.data?.id),
  });
  const { add } = useCart();
  const { user } = useAccount();
  const queryClient = useQueryClient();
  const wishlist = useQuery({ ...wishlistQuery(user?.id), enabled: Boolean(user?.id) });
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  if (product.isLoading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
          <div className="h-8 w-1/3 animate-pulse rounded bg-secondary" />
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div className="aspect-square animate-pulse rounded bg-secondary" />
            <div className="h-80 animate-pulse rounded bg-secondary" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (!product.data) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h1 className="text-2xl">Product not found</h1>
          <Button variant="outline" className="mt-6" asChild>
            <Link to="/products">
              <ArrowLeft /> Back to catalogue
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const p = product.data;
  const images = productImageUrls(p);
  const specs =
    p.specifications && typeof p.specifications === "object" && !Array.isArray(p.specifications)
      ? (p.specifications as Record<string, string>)
      : {};
  const isWishlisted = (wishlist.data ?? []).some((item) => item.product_id === p.id);

  async function toggleWishlist() {
    if (!user) {
      toast.error("Sign in to save items to your wishlist");
      return;
    }
    if (isWishlisted) {
      await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", p.id);
    } else {
      await supabase.from("wishlist_items").insert({ user_id: user.id, product_id: p.id });
    }
    queryClient.invalidateQueries({ queryKey: ["wishlist", user.id] });
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Link
          to="/products"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to catalogue
        </Link>

        <div className="mt-6 grid gap-10 md:grid-cols-2">
          <div>
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary">
              {images[activeImage] ? (
                <img
                  src={images[activeImage]}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 px-6 text-center">
                  <Package className="size-16 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Photo coming soon
                  </p>
                </div>
              )}
            </div>
            {images.length > 1 ? (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {images.map((src, index) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className={`aspect-square overflow-hidden rounded-md border ${
                      index === activeImage ? "border-accent" : "border-border"
                    }`}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            {p.brand ? (
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {p.brand}
              </p>
            ) : null}
            <h1 className="mt-1 text-3xl leading-tight md:text-4xl">{p.name}</h1>
            {p.short_description ? (
              <p className="mt-3 text-base text-muted-foreground">{p.short_description}</p>
            ) : null}

            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold">{formatKes(p.price_kes)}</span>
              <span className="text-sm text-muted-foreground">per {p.unit}</span>
            </div>
            <p className={`mt-1 text-sm ${p.stock > 0 ? "text-success" : "text-destructive"}`}>
              {p.stock > 0 ? `${p.stock} ${p.unit}(s) in stock` : "Out of stock"}
            </p>

            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center rounded-md border border-input">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Minus />
                </Button>
                <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity((q) => Math.min(p.stock || 999, q + 1))}
                >
                  <Plus />
                </Button>
              </div>
              <Button
                variant="accent"
                size="lg"
                disabled={p.stock <= 0}
                onClick={() => {
                  add(
                    {
                      productId: p.id,
                      name: p.name,
                      slug: p.slug,
                      unitPrice: Number(p.price_kes),
                      unit: p.unit,
                      imageUrl: images[0] ?? null,
                    },
                    quantity,
                  );
                  toast.success(`${p.name} added to cart`);
                }}
              >
                <ShoppingCart /> {p.stock > 0 ? "Add to cart" : "Out of stock"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Save to wishlist"
                onClick={toggleWishlist}
              >
                <Heart className={isWishlisted ? "fill-accent text-accent" : ""} />
              </Button>
            </div>

            {Object.keys(specs).length > 0 ? (
              <div className="mt-8">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Specifications
                </h2>
                <dl className="mt-3 divide-y divide-border rounded-lg border border-border">
                  {Object.entries(specs).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="font-medium">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>
        </div>

        {p.description ? (
          <div className="mt-14 max-w-3xl">
            <h2 className="text-xl">Description</h2>
            <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
              {p.description}
            </p>
          </div>
        ) : null}

        {(related.data ?? []).length > 0 ? (
          <div className="mt-16">
            <h2 className="text-xl">Related materials</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {(related.data ?? []).map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
