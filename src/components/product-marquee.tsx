import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Package } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { productImageUrls } from "@/lib/media";
import { formatKes } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX_SLIDES = 24;

type MarqueeSlide = {
  key: string;
  productId: string;
  slug: string;
  name: string;
  unit: string;
  priceKes: number;
  imageUrl: string | null;
};

function buildSlides(products: Product[]): MarqueeSlide[] {
  const slides: MarqueeSlide[] = [];
  const seenUrls = new Set<string>();

  for (const product of products) {
    const urls = productImageUrls(product);
    if (urls.length === 0) {
      slides.push({
        key: `${product.id}-empty`,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        unit: product.unit,
        priceKes: Number(product.price_kes),
        imageUrl: null,
      });
      continue;
    }
    for (const [index, url] of urls.entries()) {
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      slides.push({
        key: `${product.id}-${index}`,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        unit: product.unit,
        priceKes: Number(product.price_kes),
        imageUrl: url,
      });
      if (slides.length >= MAX_SLIDES) return slides;
    }
  }
  return slides;
}

export function ProductMarquee({
  products,
  className,
}: {
  products: Product[];
  className?: string;
}) {
  const slides = useMemo(() => buildSlides(products), [products]);

  if (slides.length === 0) return null;

  // Two identical runs so translateX(-50%) loops seamlessly.
  const loop = [...slides, ...slides];

  return (
    <div
      className={cn(
        "shop-marquee overflow-hidden rounded-2xl border border-border/80 bg-card/80 shadow-[var(--shadow-panel)]",
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 pt-3 sm:px-5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Now in yard
        </p>
        <p className="text-xs text-muted-foreground">Gallery · pause on hover</p>
      </div>
      <div className="shop-marquee-track flex w-max gap-3 px-4 pb-4 pt-3 sm:gap-4 sm:px-5">
        {loop.map((slide, index) => (
          <Link
            key={`${slide.key}-${index}`}
            to="/products/$slug"
            params={{ slug: slide.slug }}
            className="group w-44 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] sm:w-52"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
              {slide.imageUrl ? (
                <img
                  src={slide.imageUrl}
                  alt={slide.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
                  <Package className="size-7" />
                  <span className="text-[0.6rem] font-semibold uppercase tracking-widest">
                    Photo soon
                  </span>
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/70 to-transparent" />
              <span className="absolute bottom-2 left-2 text-[0.65rem] font-bold uppercase tracking-wider text-ink-foreground">
                per {slide.unit}
              </span>
            </div>
            <div className="p-3">
              <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug">
                {slide.name}
              </p>
              <p className="mt-2 font-display text-base font-bold">{formatKes(slide.priceKes)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
