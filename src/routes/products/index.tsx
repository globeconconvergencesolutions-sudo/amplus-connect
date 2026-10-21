import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { PageShell } from "@/components/page-shell";
import { ShopHome } from "@/components/shop-home";

const productsSearchSchema = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export const Route = createFileRoute("/products/")({
  validateSearch: productsSearchSchema,
  component: ProductsPage,
});

function ProductsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/products/" });

  return (
    <PageShell>
      <ShopHome
        search={{
          ...(search.category ? { category: search.category } : {}),
          ...(search.q ? { q: search.q } : {}),
        }}
        onSearchChange={(next) => {
          void navigate({
            search: {
              ...(next.category ? { category: next.category } : {}),
              ...(next.q?.trim() ? { q: next.q.trim() } : {}),
            },
          });
        }}
      />
    </PageShell>
  );
}
