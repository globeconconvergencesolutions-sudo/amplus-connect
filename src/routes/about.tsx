import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Award, HardHat, Target, Users } from "lucide-react";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/lib/company";
import projectImage from "@/assets/project-commercial.jpg";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

const VALUES = [
  {
    icon: HardHat,
    title: "Safety first",
    body: "Certified teams, rigorous site safety and quality control on every project.",
  },
  {
    icon: Target,
    title: "Accountability",
    body: "One point of contact, transparent pricing and honest programme reporting.",
  },
  {
    icon: Users,
    title: "Partnership",
    body: "We work alongside clients, consultants and communities from concept to handover.",
  },
  {
    icon: Award,
    title: "Craft",
    body: "Skilled tradespeople and verified materials behind every build we deliver.",
  },
];

function AboutPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="About us"
        title={`About ${COMPANY.name}`}
        description="A Kenyan construction company delivering buildings, civil works and verified materials with one accountable team."
      />

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="eyebrow">Our story</p>
            <h2 className="mt-2 text-3xl md:text-4xl">Built on certainty, delivered on time</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {COMPANY.shortName} was founded to close the gap between design intent and site
              reality. We combine an experienced construction delivery team with a materials supply
              arm, so clients get consistent quality, transparent costs and a single accountable
              partner from groundbreaking to handover.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Today we deliver residential, commercial, industrial and institutional projects across
              Kenya, and supply verified construction materials — cement, steel, roofing, finishes,
              plumbing and tools — through our online store with nationwide delivery.
            </p>
            <Button variant="accent" size="lg" className="mt-7" asChild>
              <Link to="/projects">
                See our projects <ArrowRight />
              </Link>
            </Button>
          </div>
          <img
            src={projectImage}
            alt="Amplus commercial project"
            className="aspect-4/3 w-full rounded-lg object-cover shadow-[var(--shadow-lift)]"
          />
        </div>
      </section>

      <section className="surface-ink">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="eyebrow">What drives us</p>
          <h2 className="mt-2 max-w-md text-3xl text-ink-foreground md:text-4xl">Our values</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((value) => (
              <div
                key={value.title}
                className="rounded-lg border border-ink-muted/20 bg-ink-foreground/5 p-6"
              >
                <value.icon className="size-8 text-accent" />
                <h3 className="mt-4 text-base text-ink-foreground">{value.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{value.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="panel flex flex-col items-start gap-6 bg-secondary/60 p-8 md:flex-row md:items-center md:justify-between md:p-12">
          <div>
            <h2 className="text-2xl md:text-3xl">Let's build something together</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
              Reach out to discuss your next project or materials order.
            </p>
          </div>
          <Button variant="accent" size="lg" asChild>
            <Link to="/contact">
              Contact us <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </PageShell>
  );
}
