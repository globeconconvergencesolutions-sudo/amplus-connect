import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Gift,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCart } from "@/lib/cart";
import { useAccount, useSignOut } from "@/hooks/use-auth";
import { COMPANY } from "@/lib/company";
import { BrandLogo } from "@/components/brand-logo";

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
  const { user, profile, isStaff } = useAccount();
  const { signOut, signingOut } = useSignOut();
  const displayName = profile?.full_name || user?.email || "My account";
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-[4.75rem] max-w-7xl items-center gap-6 px-4 sm:h-20 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center" onClick={() => setOpen(false)}>
          <BrandLogo variant="header" />
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden max-w-48 sm:inline-flex"
                  aria-label="Account menu"
                >
                  <User />
                  <span className="truncate">{profile?.full_name?.split(" ")[0] || "Account"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-semibold">{displayName}</p>
                  {profile?.full_name && user.email ? (
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  ) : null}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isStaff ? (
                  <DropdownMenuItem asChild>
                    <Link to="/admin">
                      <LayoutDashboard /> Admin portal
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link to="/account">
                    <User /> My account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account" search={{ tab: "orders" }}>
                    <Package /> My orders
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account" search={{ tab: "wishlist" }}>
                    <Heart /> Wishlist
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account" search={{ tab: "rewards" }}>
                    <Gift /> Rewards
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={signingOut}
                  onSelect={(event) => {
                    event.preventDefault();
                    void signOut();
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut /> {signingOut ? "Signing out…" : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="accent"
              size="sm"
              onClick={() => navigate({ to: "/auth" })}
              className="hidden sm:inline-flex"
            >
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
            {user ? (
              <>
                <p className="pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Signed in as <span className="normal-case tracking-normal">{displayName}</span>
                </p>
                {isStaff ? (
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className="border-b border-border/60 py-3 text-sm font-semibold text-accent"
                  >
                    Admin portal
                  </Link>
                ) : null}
                <Link
                  to="/account"
                  onClick={() => setOpen(false)}
                  className="border-b border-border/60 py-3 text-sm font-semibold text-accent"
                >
                  My account
                </Link>
                <Link
                  to="/account"
                  search={{ tab: "orders" }}
                  onClick={() => setOpen(false)}
                  className="border-b border-border/60 py-3 text-sm font-semibold"
                >
                  My orders
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  disabled={signingOut}
                  className="flex items-center gap-2 border-b border-border/60 py-3 text-left text-sm font-semibold text-destructive disabled:opacity-60"
                >
                  <LogOut className="size-4" /> {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-semibold text-accent"
              >
                Sign in or register
              </Link>
            )}
            <a
              href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}
              className="py-3 text-sm text-muted-foreground"
            >
              {COMPANY.phone}
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
