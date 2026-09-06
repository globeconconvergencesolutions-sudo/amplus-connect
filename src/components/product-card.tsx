import { Link } from "@tanstack/react-router";
import { Package, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatKes } from "@/lib/format";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/catalog";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();

  return (
    <article className="panel group flex flex-col overflow-hidden">
      <Link to="/products/$slug" params={{ slug: product.slug }} className="block">
        <div className="flex aspect-4/3 items-center justify-center bg-secondary">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <Package className="size-10 text-muted-foreground" />
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        {product.brand ? (
          <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-muted-foreground">
            {product.brand}
          </p>
        ) : null}
        <h3 className="mt-1 text-base leading-snug">
          <Link to="/products/$slug" params={{ slug: product.slug }} className="hover:text-accent">
            {product.name}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{product.short_description}</p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold">{formatKes(product.price_kes)}</p>
            <p className="text-xs text-muted-foreground">per {product.unit}</p>
          </div>
          <Button
            size="sm"
            variant="accent"
            disabled={product.stock <= 0}
            onClick={() => {
              add({
                productId: product.id,
                name: product.name,
                slug: product.slug,
                unitPrice: Number(product.price_kes),
                unit: product.unit,
                imageUrl: product.image_url,
              });
              toast.success(`${product.name} added to cart`);
            }}
          >
            <ShoppingCart /> {product.stock > 0 ? "Add" : "Out of stock"}
          </Button>
        </div>
      </div>
    </article>
  );
}
