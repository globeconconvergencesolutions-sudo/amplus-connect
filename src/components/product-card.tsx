import { Link } from "@tanstack/react-router";
import { MessageCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKes } from "@/lib/format";
import type { Product } from "@/lib/catalog";
import { coverUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export function ProductCard({
  product,
  featured = false,
}: {
  product: Product;
  featured?: boolean;
}) {
  const image = coverUrl(product.image_url, product.gallery);

  return (
    <article
      className={cn(
        "panel group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]",
        featured && "rounded-2xl",
      )}
    >
      <Link to="/products/$slug" params={{ slug: product.slug }} className="block">
        <div
          className={cn(
            "relative flex items-center justify-center overflow-hidden bg-secondary",
            featured ? "aspect-[4/3]" : "aspect-4/3",
          )}
        >
          {image ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 px-4 text-center">
              <Package className="size-8 text-muted-foreground" />
              <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                Photo coming soon
              </span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ink/55 to-transparent" />
          <span className="absolute bottom-2.5 left-3 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-foreground">
            per {product.unit}
          </span>
        </div>
      </Link>
      <div className={cn("flex flex-1 flex-col", featured ? "p-5" : "p-4")}>
        {product.brand ? (
          <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-accent">
            {product.brand}
          </p>
        ) : null}
        <h3 className={cn("leading-snug", featured ? "mt-1.5 text-lg" : "mt-1 text-base")}>
          <Link to="/products/$slug" params={{ slug: product.slug }} className="hover:text-accent">
            {product.name}
          </Link>
        </h3>
        {product.short_description ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {product.short_description}
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <p className={cn("font-display font-bold", featured ? "text-2xl" : "text-lg")}>
              {formatKes(product.price_kes)}
            </p>
            <p
              className={cn(
                "text-xs",
                product.stock > 0 ? "text-success" : "text-muted-foreground",
              )}
            >
              {product.stock > 0
                ? `${product.stock} ${product.unit}(s) in stock`
                : "Confirm with the yard"}
            </p>
          </div>
          <Button
            size={featured ? "default" : "sm"}
            variant="accent"
            className="rounded-full"
            asChild
          >
            <Link to="/products/$slug" params={{ slug: product.slug }} hash="express-interest">
              <MessageCircle className="size-3.5" /> Enquire
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
