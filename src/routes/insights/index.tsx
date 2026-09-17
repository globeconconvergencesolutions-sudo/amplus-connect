import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { postsQuery } from "@/lib/catalog";

export const Route = createFileRoute("/insights/")({
  component: InsightsPage,
});

function InsightsPage() {
  const posts = useQuery(postsQuery());

  return (
    <PageShell>
      <PageHeader
        eyebrow="Insights"
        title="Articles & guides"
        description="Practical advice on materials, project management and building in Kenya, from the Amplus technical team."
      />
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2">
          {posts.isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="panel h-56 animate-pulse bg-secondary/60" />
              ))
            : (posts.data ?? []).map((post) => (
                <Link
                  key={post.id}
                  to="/insights/$slug"
                  params={{ slug: post.slug }}
                  className="panel group flex flex-col overflow-hidden"
                >
                  {post.image_url ? (
                    <div className="aspect-16/9 overflow-hidden bg-secondary">
                      <img
                        src={post.image_url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-1 flex-col p-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {post.category ? <Badge variant="secondary">{post.category}</Badge> : null}
                    <span>{formatDate(post.published_at)}</span>
                  </div>
                  <h2 className="mt-3 text-xl leading-snug group-hover:text-accent">
                    {post.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{post.excerpt}</p>
                  {post.author ? (
                    <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {post.author}
                    </p>
                  ) : null}
                  </div>
                </Link>
              ))}
          {!posts.isLoading && (posts.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No articles published yet.</p>
          ) : null}
        </div>
      </section>
    </PageShell>
  );
}
