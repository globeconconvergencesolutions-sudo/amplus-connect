import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessageCircle, Phone, ShieldCheck, Truck, Wallet } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { ProductMarquee } from "@/components/product-marquee";
import { Button } from "@/components/ui/button";
import {
  categoriesQuery,
  filterShopProducts,
  productsQuery,
  type Category,
  type Product,
} from "@/lib/catalog";
import { COMPANY, supportLinks } from "@/lib/company";
import { cn } from "@/lib/utils";

export type ShopSearch = {
  category?: string | undefined;
  q?: string | undefined;
};

export function ShopHome({
  search,
  onSearchChange,
}: {
  search: ShopSearch;
  onSearchChange: (next: ShopSearch) => void;
}) {
  const categories = useQuery(categoriesQuery());
  const products = useQuery(productsQuery());
  const navigate = useNavigate();

  const categorySlug = search.category ?? null;
  const query = search.q ?? "";

  const activeCategories = useMemo(() => {
    const list = categories.data ?? [];
    const counts = new Map<string, number>();
    for (const product of products.data ?? []) {
      if (!product.category_id) continue;
      counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
    }
    return list.filter((category) => (counts.get(category.id) ?? 0) > 0);
  }, [categories.data, products.data]);

  const filtered = useMemo(
    () =>
      filterShopProducts(products.data ?? [], categories.data ?? [], {
        q: query,
        category: categorySlug,
      }),
    [products.data, categories.data, categorySlug, query],
  );

  const floors = useMemo(() => {
    if (categorySlug || query.trim()) {
      if (filtered.length === 0) return [];
      return [{ category: null as Category | null, items: filtered }];
    }
    const byCategory = new Map<string, Product[]>();
    const uncategorised: Product[] = [];
    for (const product of filtered) {
      if (!product.category_id) {
        uncategorised.push(product);
        continue;
      }
      const bucket = byCategory.get(product.category_id) ?? [];
      bucket.push(product);
      byCategory.set(product.category_id, bucket);
    }
    const rows: { category: Category | null; items: Product[] }[] = [];
    for (const category of activeCategories) {
      const items = byCategory.get(category.id) ?? [];
      if (items.length) rows.push({ category, items });
    }
    if (uncategorised.length) rows.push({ category: null, items: uncategorised });
    return rows;
  }, [filtered, activeCategories, categorySlug, query]);

  const searching = Boolean(categorySlug || query.trim());
  const marqueeProducts = searching ? filtered : (products.data ?? []);
  const links = supportLinks();

  return (
    <div className="shop-atmosphere">
      {searching ? (
        <section className="mx-auto max-w-7xl px-4 pb-2 pt-4 sm:px-6">
          <CategoryChips
            categories={activeCategories}
            categorySlug={categorySlug}
            query={search.q}
            onSearchChange={onSearchChange}
          />
        </section>
      ) : (
        <section className="mx-auto max-w-7xl px-4 pb-6 pt-8 sm:px-6 sm:pt-10">
          <p className="eyebrow">Yard ready · Mombasa Road</p>
          <h1 className="mt-2 max-w-3xl text-3xl leading-[1.08] tracking-tight sm:text-4xl md:text-5xl">
            Materials, priced and ready to move.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Every size and grade is its own product. Open it, leave your details — no account
            needed. We will call you back.
          </p>

          <div className="mt-6">
            <CategoryChips
              categories={activeCategories}
              categorySlug={categorySlug}
              query={search.q}
              onSearchChange={onSearchChange}
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <TrustTile
              icon={ShieldCheck}
              title="No account needed"
              body="Enquire on any product — we call you back."
            />
            <TrustTile
              icon={Truck}
              title="Delivery from the yard"
              body="Site pin or drop point — confirmed with the team."
            />
            <TrustTile
              icon={Wallet}
              title="Call / WhatsApp"
              body={`${COMPANY.phone} · stock confirmed by the yard.`}
            />
          </div>
        </section>
      )}

      {!searching ? (
        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
          {products.isLoading ? (
            <div className="h-52 animate-pulse rounded-2xl bg-secondary/70" />
          ) : null}
          {!products.isLoading && !products.isError && marqueeProducts.length > 0 ? (
            <ProductMarquee products={marqueeProducts} />
          ) : null}
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl space-y-12 px-4 pb-16 pt-4 sm:px-6">
        {products.isLoading
          ? Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="space-y-4">
                <div className="h-7 w-40 animate-pulse rounded bg-secondary" />
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((__, card) => (
                    <div key={card} className="panel h-80 animate-pulse bg-secondary/60" />
                  ))}
                </div>
              </div>
            ))
          : null}

        {products.isError ? (
          <p className="py-20 text-center text-sm text-muted-foreground">
            The yard list could not load. Refresh the page and try the search again.
          </p>
        ) : null}

        {!products.isLoading && !products.isError && floors.length === 0 && !searching ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No materials are listed yet.
          </p>
        ) : null}

        {!products.isLoading
          ? floors.map((floor) => (
              <div key={floor.category?.id ?? "all"}>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl tracking-tight md:text-3xl">
                      {floor.category?.name ??
                        (categorySlug || query.trim() ? "Matching materials" : "All materials")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {floor.items.length} SKU{floor.items.length === 1 ? "" : "s"}
                      {query.trim() ? ` · “${query.trim()}”` : ""}
                      {floor.category?.description ? ` · ${floor.category.description}` : ""}
                    </p>
                  </div>
                  {query.trim() || categorySlug ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => onSearchChange({})}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "grid gap-5",
                    floor.items.length === 1
                      ? "sm:grid-cols-2 lg:max-w-xl"
                      : floor.items.length === 2
                        ? "sm:grid-cols-2"
                        : "sm:grid-cols-2 xl:grid-cols-3",
                  )}
                >
                  {floor.items.map((product) => (
                    <ProductCard key={product.id} product={product} featured />
                  ))}
                </div>
              </div>
            ))
          : null}

        <div className="panel flex flex-col gap-4 bg-secondary/40 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-xl md:text-2xl">Need a hand before you enquire?</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Talk to the yard about stock, tonnage, or a site delivery — or leave your details on
              any product page. No account required.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" asChild>
              <a href={links.callHref}>
                <Phone /> Call
              </a>
            </Button>
            <Button variant="accent" className="rounded-full" asChild>
              <a href={links.whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle /> WhatsApp
              </a>
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => void navigate({ to: "/contact" })}
            >
              Contact
            </Button>
            <Button variant="ghost" className="rounded-full" asChild>
              <Link to="/about">About</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CategoryChips({
  categories,
  categorySlug,
  query,
  onSearchChange,
}: {
  categories: Category[];
  categorySlug: string | null;
  query: string | undefined;
  onSearchChange: (next: ShopSearch) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <Chip
        label="All"
        active={!categorySlug}
        onClick={() => {
          const next: ShopSearch = {};
          if (query?.trim()) next.q = query.trim();
          onSearchChange(next);
        }}
      />
      {categories.map((category) => (
        <Chip
          key={category.id}
          label={category.name}
          active={categorySlug === category.slug}
          onClick={() => {
            const next: ShopSearch = { category: category.slug };
            if (query?.trim()) next.q = query.trim();
            onSearchChange(next);
          }}
        />
      ))}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all",
        active
          ? "border-ink bg-ink text-ink-foreground shadow-[var(--shadow-panel)]"
          : "border-border bg-card/90 text-foreground hover:-translate-y-0.5 hover:shadow-[var(--shadow-panel)]",
      )}
    >
      {label}
    </button>
  );
}

function TrustTile({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Wallet;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-[var(--shadow-panel)]">
      <Icon className="size-5 text-accent" />
      <p className="mt-3 font-display text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
