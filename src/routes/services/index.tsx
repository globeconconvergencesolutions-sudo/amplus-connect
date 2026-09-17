import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { PageShell, PageHeader } from "@/components/page-shell";
import { servicesQuery } from "@/lib/catalog";

export const Route = createFileRoute("/services/")({
  component: ServicesPage,
});

function ServicesPage() {
  const services = useQuery(servicesQuery());

  return (
    <PageShell>
      <PageHeader
        eyebrow="What we do"
        title="Construction services"
        description="From groundworks to handover, Amplus delivers building, civil and infrastructure works under one accountable contract."
      />
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="panel h-48 animate-pulse bg-secondary/60" />
              ))
            : (services.data ?? []).map((service) => (
                <Link
                  key={service.id}
                  to="/services/$slug"
                  params={{ slug: service.slug }}
                  className="panel group flex flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-lift)]"
                >
                  {service.image_url ? (
                    <div className="aspect-16/9 overflow-hidden bg-secondary">
                      <img
                        src={service.image_url}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-1 flex-col p-6">
                    <h2 className="text-lg">{service.title}</h2>
                    <p className="mt-2 flex-1 text-sm text-muted-foreground">{service.summary}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                      Learn more{" "}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              ))}
          {!services.isLoading && (services.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No services published yet.</p>
          ) : null}
        </div>
      </section>
    </PageShell>
  );
}
