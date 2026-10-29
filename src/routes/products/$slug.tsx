import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft, Heart, MessageCircle, Phone, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { formatKes } from "@/lib/format";
import { productQuery, relatedProductsQuery } from "@/lib/catalog";
import { ProductCard } from "@/components/product-card";
import { ProductImageSlider } from "@/components/product-image-slider";
import { InterestForm } from "@/components/interest-form";
import { productImageUrls } from "@/lib/media";
import { useAccount } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { wishlistQuery } from "@/lib/account";
import {
  COMPANY,
  YARD_DIRECTIONS_URL,
  companySpecKind,
  supportLinks,
  withCompanyContacts,
} from "@/lib/company";

export const Route = createFileRoute("/products/$slug")({
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { slug } = Route.useParams();
  const product = useQuery(productQuery(slug));
  const family = useQuery({
    ...relatedProductsQuery(product.data?.category_id ?? null, product.data?.id ?? ""),
    enabled: Boolean(product.data?.id && product.data?.category_id),
  });
  const { user, isStaff } = useAccount();
  const queryClient = useQueryClient();
  const wishlist = useQuery({
    ...wishlistQuery(user?.id),
    enabled: Boolean(isStaff && user?.id),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#express-interest") return;
    const timer = window.setTimeout(() => {
      document.getElementById("express-interest")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [slug, product.data?.id]);

  if (product.isLoading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6">
          <div className="h-8 w-1/3 animate-pulse rounded bg-secondary" />
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div className="aspect-square animate-pulse rounded-2xl bg-secondary" />
            <div className="h-80 animate-pulse rounded-2xl bg-secondary" />
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
          <Button variant="outline" className="mt-6 rounded-full" asChild>
            <Link to="/">
              <ArrowLeft /> Back to shop
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const p = product.data;
  const images = productImageUrls(p);
  const familyItems = family.data ?? [];
  const specs =
    p.specifications && typeof p.specifications === "object" && !Array.isArray(p.specifications)
      ? (p.specifications as Record<string, string>)
      : {};
  const isWishlisted = (wishlist.data ?? []).some((item) => item.product_id === p.id);
  const links = supportLinks({ orderRef: p.name });

  async function toggleWishlist() {
    if (!user) {
      toast.error("Sign in to save items to your wishlist");
      return;
    }
    const result = isWishlisted
      ? await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", p.id)
      : await supabase.from("wishlist_items").insert({ user_id: user.id, product_id: p.id });
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["wishlist", user.id] });
    toast.success(isWishlisted ? "Removed from wishlist" : "Saved to wishlist");
  }

  return (
    <PageShell>
      <div className="shop-atmosphere mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to shop
        </Link>

        <div className="mt-5 grid items-start gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
          <div className="lg:sticky lg:top-28">
            <ProductImageSlider
              images={images}
              alt={p.name}
              aspectClassName="aspect-[5/4] sm:aspect-square"
            />
          </div>

          <div className="space-y-8">
            <div>
              {p.brand ? (
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                  {p.brand}
                </p>
              ) : null}
              <h1 className="mt-2 text-3xl leading-[1.1] tracking-tight md:text-4xl">{p.name}</h1>
              {p.short_description ? (
                <p className="mt-3 text-base text-muted-foreground">
                  {withCompanyContacts(p.short_description)}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-display text-4xl font-bold tracking-tight">
                  {formatKes(p.price_kes)}
                </span>
                <span className="text-sm text-muted-foreground">per {p.unit}</span>
              </div>
              <p
                className={`mt-2 text-sm font-semibold ${p.stock > 0 ? "text-success" : "text-muted-foreground"}`}
              >
                {p.stock > 0
                  ? `${p.stock} ${p.unit}(s) in stock`
                  : "Yard count not listed — send interest and the team will confirm"}
              </p>
              <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                <Warehouse className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <span>
                  Collect at the Amplus yard, Mombasa Road ·{" "}
                  <a
                    href={YARD_DIRECTIONS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline-offset-4 hover:text-accent hover:underline"
                  >
                    Get directions
                  </a>
                </span>
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {isStaff ? (
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    aria-label="Save to wishlist"
                    onClick={toggleWishlist}
                  >
                    <Heart className={isWishlisted ? "fill-accent text-accent" : ""} />
                  </Button>
                ) : null}
                <Button variant="outline" className="rounded-full" asChild>
                  <a href={links.callHref}>
                    <Phone /> Call
                  </a>
                </Button>
                <Button variant="outline" className="rounded-full" asChild>
                  <a href={links.whatsappHref} target="_blank" rel="noreferrer">
                    <MessageCircle /> WhatsApp
                  </a>
                </Button>
              </div>
            </div>

            <SpecList specs={specs} />

            <InterestForm
              productId={p.id}
              productName={p.name}
              productSlug={p.slug}
              productUnit={p.unit}
              unitPriceKes={Number(p.price_kes)}
            />
          </div>
        </div>

        {p.description ? (
          <div className="mt-10 max-w-3xl border-t border-border/70 pt-8">
            <h2 className="text-xl tracking-tight">Description</h2>
            <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
              {withCompanyContacts(p.description)}
            </p>
          </div>
        ) : null}

        {familyItems.length > 0 ? (
          <div className="mt-12">
            <h2 className="text-xl tracking-tight">Other sizes in this family</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Same category · each variety is its own product
            </p>
            <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {familyItems.map((item) => (
                <div key={item.id} className="w-[78vw] max-w-72 shrink-0 snap-start sm:w-72">
                  <ProductCard product={item} featured />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}

function SpecList({ specs }: { specs: Record<string, string> }) {
  const entries = Object.entries(specs);
  if (entries.length === 0) return null;
  const hasPhone = entries.some(([key]) => companySpecKind(key) === "phone");
  const hasEmail = entries.some(([key]) => companySpecKind(key) === "email");

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Specifications
      </h2>
      <dl className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/90 shadow-[var(--shadow-panel)]">
        {entries.map(([key, value]) => (
          <SpecRow key={key} label={key} value={value} />
        ))}
        {hasPhone && !hasEmail ? <SpecRow label="Email" value={COMPANY.email} /> : null}
      </dl>
    </section>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  const kind = companySpecKind(label);
  const text =
    kind === "phone"
      ? COMPANY.phone
      : kind === "email"
        ? COMPANY.email
        : withCompanyContacts(value);
  const href =
    kind === "phone"
      ? `tel:${COMPANY.phone.replace(/\s/g, "")}`
      : kind === "email"
        ? `mailto:${COMPANY.email}`
        : null;

  return (
    <div className="grid gap-0.5 px-4 py-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-baseline sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words sm:text-right">
        {href ? (
          <a href={href} className="hover:text-accent">
            {text}
          </a>
        ) : (
          text
        )}
      </dd>
    </div>
  );
}
