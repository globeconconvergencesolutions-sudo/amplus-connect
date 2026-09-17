import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="surface-ink">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-4xl md:text-5xl">{title}</h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-base text-ink-muted md:text-lg">{description}</p>
        ) : null}
      </div>
      <div className="hazard-rule" />
    </div>
  );
}
