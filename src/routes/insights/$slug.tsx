import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { postQuery } from "@/lib/catalog";

export const Route = createFileRoute("/insights/$slug")({
  component: PostDetailPage,
});

function PostDetailPage() {
  const { slug } = Route.useParams();
  const post = useQuery(postQuery(slug));

  if (post.isLoading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
          <div className="h-8 w-2/3 animate-pulse rounded bg-secondary" />
          <div className="mt-4 h-64 animate-pulse rounded bg-secondary" />
        </div>
      </PageShell>
    );
  }

  if (!post.data) {
    return (
      <PageShell>
        <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <h1 className="text-2xl">Article not found</h1>
          <Button variant="outline" className="mt-6" asChild>
            <Link to="/insights">
              <ArrowLeft /> Back to insights
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const p = post.data;

  return (
    <PageShell>
      <article className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Link
          to="/insights"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All insights
        </Link>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {p.category ? <Badge variant="secondary">{p.category}</Badge> : null}
          <span>{formatDate(p.published_at)}</span>
        </div>
        <h1 className="mt-3 text-3xl leading-tight md:text-4xl">{p.title}</h1>
        {p.author ? (
          <p className="mt-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {p.author}
          </p>
        ) : null}
        {p.image_url ? (
          <img
            src={p.image_url}
            alt=""
            className="mt-8 aspect-16/9 w-full rounded-lg object-cover"
          />
        ) : null}
        <div className="mt-8 max-w-none whitespace-pre-line text-base leading-relaxed text-foreground">
          {p.body}
        </div>
        {p.tags && p.tags.length > 0 ? (
          <div className="mt-8 flex flex-wrap gap-2">
            {p.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                #{tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </article>
    </PageShell>
  );
}
