import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Building2, Calendar, MapPin, User } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { projectQuery } from "@/lib/catalog";
import { coverUrl, parseGallery } from "@/lib/media";
import projectImage from "@/assets/project-commercial.jpg";

export const Route = createFileRoute("/projects/$slug")({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { slug } = Route.useParams();
  const project = useQuery(projectQuery(slug));

  if (project.isLoading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
          <div className="h-8 w-2/3 animate-pulse rounded bg-secondary" />
          <div className="mt-4 h-64 animate-pulse rounded bg-secondary" />
        </div>
      </PageShell>
    );
  }

  if (!project.data) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h1 className="text-2xl">Project not found</h1>
          <Button variant="outline" className="mt-6" asChild>
            <Link to="/projects">
              <ArrowLeft /> Back to projects
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const p = project.data;
  const hero = coverUrl(p.image_url, p.gallery) ?? projectImage;
  const gallery = parseGallery(p.gallery).filter((item) => item.url !== p.image_url);

  return (
    <PageShell>
      <section className="relative surface-ink">
        <img
          src={hero}
          alt={p.title}
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink-foreground"
          >
            <ArrowLeft className="size-4" /> All projects
          </Link>
          <p className="eyebrow mt-6">{p.sector ?? "Project"}</p>
          <h1 className="mt-3 max-w-3xl text-4xl md:text-5xl">{p.title}</h1>
          {p.summary ? (
            <p className="mt-4 max-w-2xl text-base text-ink-muted md:text-lg">{p.summary}</p>
          ) : null}

          <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <dt className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-ink-muted">
                <MapPin className="size-3.5" /> Location
              </dt>
              <dd className="mt-1 text-sm text-ink-foreground">{p.location ?? "—"}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-ink-muted">
                <User className="size-3.5" /> Client
              </dt>
              <dd className="mt-1 text-sm text-ink-foreground">{p.client ?? "—"}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-ink-muted">
                <Building2 className="size-3.5" /> Sector
              </dt>
              <dd className="mt-1 text-sm text-ink-foreground">{p.sector ?? "—"}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-ink-muted">
                <Calendar className="size-3.5" /> Completed
              </dt>
              <dd className="mt-1 text-sm text-ink-foreground">
                {formatDate(p.completed_on) || "Ongoing"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="hazard-rule" />
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="max-w-none whitespace-pre-line text-base leading-relaxed text-foreground">
          {p.description}
        </div>

        {gallery.length > 0 ? (
          <div className="mt-12 grid gap-3 sm:grid-cols-2">
            {gallery.map((item) => (
              <img
                key={item.url}
                src={item.url}
                alt={item.alt ?? p.title}
                className="aspect-4/3 w-full rounded-lg object-cover"
              />
            ))}
          </div>
        ) : null}

        <div className="panel mt-12 flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl">Planning something similar?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Talk to our team about your next project.
            </p>
          </div>
          <Button variant="accent" size="lg" asChild>
            <Link to="/contact">
              Request a quote <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </PageShell>
  );
}
