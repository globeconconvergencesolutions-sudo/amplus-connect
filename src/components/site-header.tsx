import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { LayoutDashboard, LogOut, Menu, Search, SearchX, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { endNonStaffSession, useAccount, useSignOut } from "@/hooks/use-auth";
import { COMPANY } from "@/lib/company";
import { BrandLogo } from "@/components/brand-logo";
import { categoriesQuery, filterShopProducts, productsQuery } from "@/lib/catalog";

// Brochure sections kept in the repo but off the chrome until the client wants them back.
// const NAV = [
//   { to: "/services", label: "Services" },
//   { to: "/projects", label: "Projects" },
//   { to: "/products", label: "Shop" },
//   { to: "/insights", label: "Insights" },
//   { to: "/about", label: "About" },
//   { to: "/contact", label: "Contact" },
// ] as const;

export function SiteHeader() {
  const { user, profile, isStaff, loading, rolesError } = useAccount();
  const { signOut, signingOut } = useSignOut();
  const displayName = profile?.full_name || user?.email || "My account";
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const urlQuery = useRouterState({
    select: (state) => {
      const search = state.location.search as { q?: unknown };
      return typeof search?.q === "string" ? search.q : "";
    },
  });
  const shopLookup = useRouterState({
    select: (state) => {
      const search = state.location.search as { q?: unknown; category?: unknown };
      const path = state.location.pathname;
      return {
        onShop: path === "/" || path === "/products" || path === "/products/",
        q: typeof search?.q === "string" ? search.q : "",
        category: typeof search?.category === "string" ? search.category : "",
      };
    },
  });

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (loading || rolesError || !user || isStaff) return;
    void endNonStaffSession();
  }, [loading, rolesError, user, isStaff]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    void navigate({
      to: "/",
      search: q ? { q } : {},
    });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:gap-6 lg:py-3.5">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex shrink-0 items-center" onClick={() => setOpen(false)}>
            <BrandLogo variant="header" />
          </Link>
          <div className="ml-auto flex items-center gap-2 lg:hidden">
            {/* Cart stays in the app for staff via /cart. Hidden on the shop.
            <Button variant="ghost" size="icon" asChild aria-label="Shopping cart">
              <Link to="/cart" className="relative">
                <ShoppingCart />
              </Link>
            </Button>
            */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle menu"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        <form onSubmit={onSearch} className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ballast, cement, size…"
            className="h-11 rounded-full border-border/80 bg-card/90 pl-9 pr-24 shadow-[var(--shadow-panel)]"
          />
          <Button
            type="submit"
            variant="accent"
            size="sm"
            className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-full px-4"
          >
            Search
          </Button>
        </form>

        <div className="hidden items-center gap-2 lg:flex">
          {/* Cart icon commented out for shoppers. Staff can still open /cart.
          <Button variant="ghost" size="icon" asChild aria-label="Shopping cart">
            <Link to="/cart"><ShoppingCart /></Link>
          </Button>
          */}

          {isStaff && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="max-w-48 rounded-full"
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
                <DropdownMenuItem asChild>
                  <Link to="/admin">
                    <LayoutDashboard /> Admin portal
                  </Link>
                </DropdownMenuItem>
                {/* Customer account links stay in the repo, off the shop.
                <DropdownMenuItem asChild>
                  <Link to="/account"><User /> My account</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account" search={{ tab: "orders" }}><Package /> My orders</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account" search={{ tab: "wishlist" }}><Heart /> Wishlist</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account" search={{ tab: "rewards" }}><Gift /> Rewards</Link>
                </DropdownMenuItem>
                */}
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
          ) : null}
          {/* Public sign-in is commented out. Staff use /auth or /admin.
          <Button
            variant="accent"
            size="sm"
            className="rounded-full"
            onClick={() => navigate({ to: "/auth" })}
          >
            Sign in
          </Button>
          */}
        </div>
      </div>

      <SearchMiss lookup={shopLookup} />

      {open ? (
        <div className="border-t border-border bg-background lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            <Link
              to="/"
              onClick={() => setOpen(false)}
              className="border-b border-border/60 py-3 text-sm font-semibold"
            >
              Shop materials
            </Link>
            {/* About / Contact stay in the footer for the Jumia-style chrome. */}
            {isStaff && user ? (
              <>
                <p className="pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Signed in as <span className="normal-case tracking-normal">{displayName}</span>
                </p>
                <Link
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className="border-b border-border/60 py-3 text-sm font-semibold text-accent"
                >
                  Admin portal
                </Link>
                {/* Customer account links stay off the shop menu.
                <Link to="/account" onClick={() => setOpen(false)}>My account</Link>
                <Link to="/account" search={{ tab: "orders" }} onClick={() => setOpen(false)}>My orders</Link>
                */}
                <button
                  type="button"
                  onClick={() => void signOut()}
                  disabled={signingOut}
                  className="flex items-center gap-2 border-b border-border/60 py-3 text-left text-sm font-semibold text-destructive disabled:opacity-60"
                >
                  <LogOut className="size-4" /> {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </>
            ) : null}
            {/* Public sign-in and registration are commented out.
            <Link to="/auth" onClick={() => setOpen(false)}>
              Sign in or register
            </Link>
            */}
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

function SearchMiss({ lookup }: { lookup: { onShop: boolean; q: string; category: string } }) {
  const navigate = useNavigate();
  const active = lookup.onShop && Boolean(lookup.q.trim() || lookup.category.trim());
  const products = useQuery({ ...productsQuery(), enabled: active });
  const categories = useQuery({ ...categoriesQuery(), enabled: active });
  const waiting = products.isLoading || (categories.isLoading && !categories.isError);
  if (!active || waiting || products.isError) return null;

  const hits = filterShopProducts(products.data ?? [], categories.data ?? [], lookup);
  if (hits.length > 0) return null;

  const known = (categories.data ?? []).find((row) => row.slug === lookup.category.trim());
  const q = lookup.q.trim();
  const title = q
    ? known
      ? `No materials match “${q}” in ${known.name}.`
      : `No materials match “${q}”.`
    : known
      ? `Nothing is listed under ${known.name}.`
      : "Nothing is listed in that category.";

  return (
    <div className="border-t border-border/70 bg-card" role="status">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <SearchX className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Try a size, brand, or material — or call the yard on{" "}
              <a
                href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}
                className="font-medium text-foreground"
              >
                {COMPANY.phone}
              </a>
              .
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full shrink-0 rounded-full sm:w-auto"
          onClick={() => {
            window.scrollTo({ top: 0 });
            void navigate({ to: "/", search: {} });
          }}
        >
          {q ? "Clear search" : "Show all materials"}
        </Button>
      </div>
    </div>
  );
}
