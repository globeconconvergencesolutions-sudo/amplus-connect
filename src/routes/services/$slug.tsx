import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { serviceQuery } from "@/lib/catalog";
import projectImage from "@/assets/project-commercial.jpg";

export const Route = createFileRoute("/services/$slug")({
  component: ServiceDetailPage,
});

function ServiceDetailPage() {
  const { slug } = Route.useParams();
  const service = useQuery(serviceQuery(slug));

  if (service.isLoading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
          <div className="h-8 w-2/3 animate-pulse rounded bg-secondary" />
          <div className="mt-4 h-40 animate-pulse rounded bg-secondary" />
        </div>
      </PageShell>
    );
  }

  if (!service.data) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h1 className="text-2xl">Service not found</h1>
          <Button variant="outline" className="mt-6" asChild>
            <Link to="/services">
              <ArrowLeft /> Back to services
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const s = service.data;

  return (
    <PageShell>
      <section className="relative surface-ink">
        <img
          src={s.image_url || projectImage}
          alt={s.title}
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
          <Link
            to="/services"
            className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink-foreground"
          >
            <ArrowLeft className="size-4" /> All services
          </Link>
          <p className="eyebrow mt-6">Service</p>
          <h1 className="mt-3 max-w-3xl text-4xl md:text-5xl">{s.title}</h1>
          {s.summary ? (
            <p className="mt-4 max-w-2xl text-base text-ink-muted md:text-lg">{s.summary}</p>
          ) : null}
        </div>
        <div className="hazard-rule" />
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div className="max-w-none whitespace-pre-line text-base leading-relaxed text-foreground">
          {s.description}
        </div>

        <div className="panel mt-12 flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl">Ready to discuss your project?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Get a proposal tailored to your scope and budget.
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
