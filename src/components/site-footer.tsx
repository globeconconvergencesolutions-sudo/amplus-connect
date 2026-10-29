import { Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { COMPANY, YARD_DIRECTIONS_URL } from "@/lib/company";
import { BrandLogo } from "@/components/brand-logo";

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.03H7.9v-2.9h2.4V9.84c0-2.37 1.41-3.68 3.56-3.68 1.03 0 2.11.18 2.11.18v2.32h-1.19c-1.17 0-1.54.73-1.54 1.48v1.78h2.62l-.42 2.9h-2.2V22c4.78-.75 8.44-4.91 8.44-9.93z" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="surface-ink mt-20">
      <div className="hazard-rule" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <BrandLogo variant="footer" inverted />
          <p className="mt-5 max-w-md text-sm text-ink-muted">
            Building, civil and infrastructure works across Kenya, plus construction materials ready
            to collect from the Amplus yard on Mombasa Road. Enquire online and we will call you
            back.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-ink-muted">
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-accent" />
              <a
                href={YARD_DIRECTIONS_URL}
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent"
              >
                {COMPANY.address}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-accent" />
              <a href={`tel:${COMPANY.phone.replace(/\s/g, "")}`} className="hover:text-accent">
                {COMPANY.phone}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-accent" />
              <a href={`mailto:${COMPANY.email}`} className="hover:text-accent">
                {COMPANY.email}
              </a>
            </li>
          </ul>
          {COMPANY.facebook ? (
            <a
              href={COMPANY.facebook}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-accent"
            >
              <FacebookIcon className="size-4 text-accent" />
              Follow on Facebook
            </a>
          ) : null}
        </div>

        <div>
          <h2 className="font-display text-sm uppercase tracking-widest text-ink-foreground">
            Company
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-muted">
            <li>
              <Link to="/about" className="hover:text-accent">
                About us
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-accent">
                Contact
              </Link>
            </li>
            {/* Brochure links kept for a later switch-on:
            <li><Link to="/services">Services</Link></li>
            <li><Link to="/projects">Projects</Link></li>
            <li><Link to="/insights">Insights</Link></li>
            */}
            <li>
              <Link to="/" className="hover:text-accent">
                Shop materials
              </Link>
            </li>
            {/* Online cart and customer orders stay in the app for staff. Off the public footer.
            <li>
              <Link to="/cart" className="hover:text-accent">
                Online cart (optional)
              </Link>
            </li>
            <li>
              <Link to="/account" search={{ tab: "orders" }} className="hover:text-accent">
                My orders
              </Link>
            </li>
            */}
            {COMPANY.facebook ? (
              <li>
                <a
                  href={COMPANY.facebook}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-accent"
                >
                  Facebook
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-muted/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {COMPANY.name}. All rights reserved.
          </p>
          <p>{COMPANY.hours}</p>
        </div>
      </div>
    </footer>
  );
}
