import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageShell, PageHeader } from "@/components/page-shell";
import { ProductCard } from "@/components/product-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { categoriesQuery, productsQuery } from "@/lib/catalog";

export const Route = createFileRoute("/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  const categories = useQuery(categoriesQuery());
  const products = useQuery(productsQuery());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = products.data ?? [];
    if (categoryId) list = list.filter((p) => p.category_id === categoryId);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.brand ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [products.data, categoryId, search]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Online store"
        title="Materials catalogue"
        description="Cement, steel, roofing, finishes, plumbing and tools with transparent pricing and scheduled delivery."
      />
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="lg:w-64 lg:shrink-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="pl-9"
              />
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Categories
              </h3>
              <div className="mt-3 flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("justify-start", !categoryId && "bg-secondary")}
                  onClick={() => setCategoryId(null)}
                >
                  All categories
                </Button>
                {(categories.data ?? []).map((category) => (
                  <Button
                    key={category.id}
                    variant="ghost"
                    size="sm"
                    className={cn("justify-start", categoryId === category.id && "bg-secondary")}
                    onClick={() => setCategoryId(category.id)}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1">
            <p className="mb-4 text-sm text-muted-foreground">
              {products.isLoading
                ? "Loading products…"
                : `${filtered.length} product${filtered.length === 1 ? "" : "s"}`}
            </p>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {products.isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="panel h-72 animate-pulse bg-secondary/60" />
                  ))
                : filtered.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
            {!products.isLoading && filtered.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No products match your filters.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
