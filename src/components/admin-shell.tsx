import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  // Boxes,
  // FileText,
  FileSpreadsheet,
  Folder,
  // Gift,
  Home,
  // Layers,
  // LifeBuoy,
  Loader2,
  // Mail,
  Menu,
  Package,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  // Truck,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffSignIn } from "@/components/staff-sign-in";
import { useAccount, useSignOut } from "@/hooks/use-auth";
import { BrandLogo } from "@/components/brand-logo";
import { canAccessAdminPath, filterAdminNavByRoles } from "@/lib/admin-access";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: Home, exact: true },
      { to: "/admin/reports", label: "Reports", icon: FileSpreadsheet },
    ],
  },
  {
    id: "demand",
    label: "Demand",
    items: [
      { to: "/admin/leads", label: "Leads", icon: Sparkles },
      { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { to: "/admin/invoices", label: "Invoices", icon: Receipt },
      // Checkout delivery config — park while public path is Express interest only:
      // { to: "/admin/delivery", label: "Delivery", icon: Truck },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    items: [
      { to: "/admin/products", label: "Products", icon: Package },
      { to: "/admin/categories", label: "Categories", icon: Folder },
      // Brochure CMS — comment back in when the public site needs them again:
      // { to: "/admin/services", label: "Services", icon: Layers },
      // { to: "/admin/projects", label: "Projects", icon: Boxes },
      // { to: "/admin/posts", label: "Insights", icon: FileText },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { to: "/admin/customers", label: "Customers", icon: Users },
      // Support inbox — hide until phone-CRM tickets replace account tickets:
      // { to: "/admin/tickets", label: "Tickets", icon: LifeBuoy },
      // { to: "/admin/messages", label: "Messages", icon: Mail },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      // Profile loyalty — not wired to phone-first CRM customers:
      // { to: "/admin/rewards", label: "Rewards", icon: Gift },
      { to: "/admin/roles", label: "Roles", icon: ShieldCheck },
    ],
  },
];

function NavLinks({ roles, onNavigate }: { roles: string[]; onNavigate?: () => void }) {
  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: filterAdminNavByRoles(group.items, roles),
      })).filter((group) => group.items.length > 0),
    [roles],
  );

  return (
    <>
      {groups.map((group) => (
        <div key={group.id} className="mt-5 first:mt-0">
          <p className="mb-1.5 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink-muted/80">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: Boolean(item.exact) }}
                onClick={onNavigate}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-ink-foreground/[0.07] hover:text-ink-foreground [&.active]:bg-ink-foreground/[0.12] [&.active]:text-ink-foreground [&.active]:shadow-[inset_3px_0_0_0_var(--color-accent)]"
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function SidebarAccount({
  name,
  roles,
  onSignOut,
  signingOut,
}: {
  name: string;
  roles: string[];
  onSignOut: () => void;
  signingOut: boolean;
}) {
  return (
    <div className="border-t border-ink-muted/20 px-4 py-4">
      <p className="truncate text-sm text-ink-foreground">{name}</p>
      <p className="mt-0.5 truncate text-xs text-ink-muted">
        {roles.map((r) => r.replaceAll("_", " ")).join(", ")}
      </p>
      <div className="mt-3 flex gap-2">
        <Button variant="onInk" size="sm" className="flex-1" asChild>
          <Link to="/">Back to site</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-ink-muted hover:text-ink-foreground"
          onClick={onSignOut}
          disabled={signingOut}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="panel flex flex-col items-center gap-3 p-12 text-center sm:p-16">
      <ShieldAlert className="size-10 text-muted-foreground" />
      <h1 className="text-xl">You do not have access to this page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Your role does not include this area. Use the sidebar for pages you can open, or ask a super
        admin if you need a different role.
      </p>
      <Button variant="accent" className="mt-2" asChild>
        <Link to="/admin">Back to dashboard</Link>
      </Button>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, profile, roles, isStaff, loading } = useAccount();
  const { signOut, signingOut } = useSignOut();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const allowedHere = canAccessAdminPath(roles, pathname);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isStaff) {
    return <StaffSignIn next="/admin" />;
  }

  const displayName = profile?.full_name || profile?.email || "Staff";

  return (
    <div className="flex h-svh overflow-hidden bg-secondary/30">
      {/* Desktop: fixed-height sidebar — always visible while main scrolls */}
      <aside className="surface-ink hidden h-svh w-64 shrink-0 flex-col md:flex">
        <div className="shrink-0 px-5 py-5">
          <Link to="/" className="block">
            <BrandLogo variant="admin" inverted />
          </Link>
          <p className="mt-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-muted">
            Admin portal
          </p>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
          <NavLinks roles={roles} />
        </nav>
        <div className="shrink-0">
          <SidebarAccount
            name={displayName}
            roles={roles}
            signingOut={signingOut}
            onSignOut={() => void signOut()}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="surface-ink absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <div>
                <BrandLogo variant="admin" inverted />
                <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-muted">
                  Admin portal
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-ink-muted hover:text-ink-foreground"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="size-5" />
              </Button>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              <NavLinks roles={roles} onNavigate={() => setMobileOpen(false)} />
            </nav>
            <SidebarAccount
              name={displayName}
              roles={roles}
              signingOut={signingOut}
              onSignOut={() => void signOut()}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </Button>
            <Link to="/" className="min-w-0 truncate">
              <BrandLogo variant="header" className="h-8" />
            </Link>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/" })}>
              Site
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void signOut()} disabled={signingOut}>
              Sign out
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
            {allowedHere ? children : <AccessDenied />}
          </div>
        </main>
      </div>
    </div>
  );
}
