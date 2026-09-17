import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, HardHat, ShieldCheck, Truck, Wallet } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { productsQuery, projectsQuery, servicesQuery } from "@/lib/catalog";
import { coverUrl } from "@/lib/media";
import { COMPANY } from "@/lib/company";
import productsImage from "@/assets/products-showcase.jpg";
import projectImage from "@/assets/project-commercial.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

const HIGHLIGHTS = [
  {
    icon: HardHat,
    title: "Turnkey delivery",
    body: "One accountable partner from groundbreaking to handover.",
  },
  {
    icon: Truck,
    title: "Materials on schedule",
    body: "Verified construction materials delivered across Kenya.",
  },
  {
    icon: Wallet,
    title: "M-Pesa & card",
    body: "Secure checkout powered by Pesapal, with loyalty rewards.",
  },
  {
    icon: ShieldCheck,
    title: "Quality assured",
    body: "Certified teams and rigorous checks at every stage.",
  },
];

function Index() {
  const services = useQuery(servicesQuery());
  const featuredProducts = useQuery(productsQuery({ featured: true }));
  const featuredProjects = useQuery(projectsQuery({ featured: true }));

  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden surface-ink">
        <img
          src={projectImage}
          alt="Amplus construction project"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 md:py-32">
          <p className="eyebrow">Amplus Construction Solutions</p>
          <h1 className="mt-4 max-w-2xl text-4xl leading-[1.05] text-ink-foreground md:text-6xl">
            {COMPANY.tagline}
          </h1>
          <p className="mt-6 max-w-xl text-base text-ink-muted md:text-lg">
            A single accountable partner for building construction, civil works and verified
            materials supply — with a secure online store, M-Pesa &amp; card payments and loyalty
            rewards for every customer.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button variant="hero" size="lg" asChild>
              <Link to="/products">
                Shop materials <ArrowRight />
              </Link>
            </Button>
            <Button variant="onInk" size="lg" asChild>
              <Link to="/contact">Request a quote</Link>
            </Button>
          </div>
        </div>
        <div className="hazard-rule" />
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map((item) => (
            <div key={item.title} className="panel p-6">
              <item.icon className="size-8 text-accent" />
              <h3 className="mt-4 text-base">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">What we do</p>
            <h2 className="mt-2 text-3xl md:text-4xl">Construction services</h2>
          </div>
          <Button variant="outline" asChild>
            <Link to="/services">
              All services <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(services.data ?? []).slice(0, 6).map((service) => (
            <Link
              key={service.id}
              to="/services/$slug"
              params={{ slug: service.slug }}
              className="panel group flex flex-col p-6 transition-shadow hover:shadow-[var(--shadow-lift)]"
            >
              <h3 className="text-lg">{service.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{service.summary}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                Learn more{" "}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
          {services.isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="panel h-40 animate-pulse bg-secondary/60" />
              ))
            : null}
        </div>
      </section>

      {/* Materials store */}
      <section className="surface-ink">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center">
          <div>
            <p className="eyebrow">Online store</p>
            <h2 className="mt-2 max-w-md text-3xl text-ink-foreground md:text-4xl">
              Construction materials, delivered
            </h2>
            <p className="mt-4 max-w-md text-sm text-ink-muted md:text-base">
              Cement, steel, roofing, finishes, plumbing and tools with transparent pricing.
              Checkout securely with M-Pesa or card through Pesapal and earn loyalty points on every
              order.
            </p>
            <Button variant="hero" size="lg" className="mt-7" asChild>
              <Link to="/products">
                Browse the catalogue <ArrowRight />
              </Link>
            </Button>
          </div>
          <img
            src={productsImage}
            alt="Amplus construction materials"
            className="aspect-4/3 w-full rounded-lg object-cover shadow-[var(--shadow-lift)]"
          />
        </div>
      </section>

      {/* Featured products */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Popular right now</p>
            <h2 className="mt-2 text-3xl md:text-4xl">Featured materials</h2>
          </div>
          <Button variant="outline" asChild>
            <Link to="/products">
              Shop all <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProducts.isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="panel h-72 animate-pulse bg-secondary/60" />
              ))
            : (featuredProducts.data ?? [])
                .slice(0, 8)
                .map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      {/* Projects */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Track record</p>
            <h2 className="mt-2 text-3xl md:text-4xl">Recent projects</h2>
          </div>
          <Button variant="outline" asChild>
            <Link to="/projects">
              View all projects <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {(featuredProjects.data ?? []).slice(0, 3).map((project) => (
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
                <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                  {project.sector}
                </p>
                <h3 className="mt-1 text-lg">{project.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{project.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="panel flex flex-col items-start gap-6 bg-secondary/60 p-8 md:flex-row md:items-center md:justify-between md:p-12">
          <div>
            <h2 className="text-2xl md:text-3xl">Have a project in mind?</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
              Tell us about your build and our team will get back to you with a proposal.
            </p>
          </div>
          <Button variant="accent" size="lg" asChild>
            <Link to="/contact">
              Get in touch <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </PageShell>
  );
}
