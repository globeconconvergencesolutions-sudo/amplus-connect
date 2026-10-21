import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { PageShell } from "@/components/page-shell";
import { ShopHome } from "@/components/shop-home";

const shopSearchSchema = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: shopSearchSchema,
  component: Index,
});

function Index() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });

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
