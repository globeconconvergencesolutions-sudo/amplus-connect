import { Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { COMPANY } from "@/lib/company";

export function SiteFooter() {
  return (
    <footer className="surface-ink mt-24">
      <div className="hazard-rule" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-2xl font-extrabold tracking-tight">AMPLUS</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-ink-muted">
            Construction Solutions
          </p>
          <p className="mt-5 max-w-md text-sm text-ink-muted">
            Building, civil works and construction materials supply across Kenya. One accountable
            partner from groundbreaking to handover.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-ink-muted">
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-accent" /> {COMPANY.address}
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-accent" /> {COMPANY.phone}
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-accent" /> {COMPANY.email}
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm uppercase tracking-widest text-ink-foreground">Company</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-muted">
            <li><Link to="/about" className="hover:text-accent">About us</Link></li>
            <li><Link to="/services" className="hover:text-accent">Services</Link></li>
            <li><Link to="/projects" className="hover:text-accent">Projects</Link></li>
            <li><Link to="/insights" className="hover:text-accent">Insights</Link></li>
            <li><Link to="/contact" className="hover:text-accent">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm uppercase tracking-widest text-ink-foreground">Shop</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-muted">
            <li><Link to="/products" className="hover:text-accent">Materials catalogue</Link></li>
            <li><Link to="/cart" className="hover:text-accent">Shopping cart</Link></li>
            <li><Link to="/account" className="hover:text-accent">My orders</Link></li>
            <li><Link to="/account/rewards" className="hover:text-accent">Loyalty rewards</Link></li>
          </ul>
          <p className="mt-6 text-xs text-ink-muted">Pay with M-Pesa or card via Pesapal.</p>
        </div>
      </div>
      <div className="border-t border-ink-muted/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} {COMPANY.name}. All rights reserved.</p>
          <p>{COMPANY.hours}</p>
        </div>
      </div>
    </footer>
  );
}
