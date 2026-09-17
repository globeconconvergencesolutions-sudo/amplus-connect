import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { projectsQuery } from "@/lib/catalog";
import { coverUrl } from "@/lib/media";
import projectImage from "@/assets/project-commercial.jpg";

export const Route = createFileRoute("/projects/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const projects = useQuery(projectsQuery());

  return (
    <PageShell>
      <PageHeader
        eyebrow="Our track record"
        title="Projects"
        description="A selection of building, civil and infrastructure works delivered across Kenya."
      />
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="panel h-80 animate-pulse bg-secondary/60" />
              ))
            : (projects.data ?? []).map((project) => (
                <Link
                  key={project.id}
                  to="/projects/$slug"
                  params={{ slug: project.slug }}
                  className="panel group overflow-hidden"
                >
                  <div className="aspect-4/3 overflow-hidden bg-secondary">
                    <img
                      src={coverUrl(project.image_url, project.gallery) ?? projectImage}
                      alt={project.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      {project.sector ? <Badge variant="secondary">{project.sector}</Badge> : null}
                      {project.is_featured ? (
                        <Badge className="bg-accent text-accent-foreground">Featured</Badge>
                      ) : null}
                    </div>
                    <h3 className="mt-2 text-lg">{project.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {project.summary}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" /> {project.location}
                      </span>
                      <span>{formatDate(project.completed_on)}</span>
                    </div>
                  </div>
                </Link>
              ))}
          {!projects.isLoading && (projects.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects published yet.</p>
          ) : null}
        </div>
      </section>
    </PageShell>
  );
}
