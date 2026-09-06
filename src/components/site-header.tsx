import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, ShoppingCart, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/lib/cart";
import { useAccount } from "@/hooks/use-auth";
import { COMPANY } from "@/lib/company";

const NAV = [
  { to: "/services", label: "Services" },
  { to: "/projects", label: "Projects" },
  { to: "/products", label: "Shop" },
  { to: "/insights", label: "Insights" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const { count } = useCart();
  const { user, isStaff } = useAccount();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="surface-amber flex size-9 items-center justify-center rounded-sm font-display text-lg font-extrabold">
            A
          </span>
          <span className="leading-none">
            <span className="block font-display text-lg font-extrabold tracking-tight">AMPLUS</span>
            <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Construction Solutions
            </span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-sm px-3 py-2 text-sm font-semibold text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground [&.active]:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button variant="ghost" size="icon" asChild aria-label="Shopping cart">
            <Link to="/cart" className="relative">
              <ShoppingCart />
              {count > 0 ? (
                <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center bg-accent px-1 text-[0.65rem] text-accent-foreground">
                  {count}
                </Badge>
              ) : null}
            </Link>
          </Button>

          {user ? (
            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
              <Link to={isStaff ? "/admin" : "/account"}>
                <User /> {isStaff ? "Admin" : "My account"}
              </Link>
            </Button>
          ) : (
            <Button variant="accent" size="sm" onClick={() => navigate({ to: "/auth" })} className="hidden sm:inline-flex">
              Sign in
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Toggle menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-border bg-background lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="border-b border-border/60 py-3 text-sm font-semibold"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to={user ? (isStaff ? "/admin" : "/account") : "/auth"}
              onClick={() => setOpen(false)}
              className="py-3 text-sm font-semibold text-accent"
            >
              {user ? (isStaff ? "Admin portal" : "My account") : "Sign in or register"}
            </Link>
            <a href={`tel:${COMPANY.phone.replace(/\s/g, "")}`} className="py-3 text-sm text-muted-foreground">
              {COMPANY.phone}
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
