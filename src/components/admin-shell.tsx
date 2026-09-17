import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Boxes,
  FileText,
  Folder,
  Gift,
  Home,
  Layers,
  Loader2,
  Mail,
  Package,
  ShieldCheck,
  ShoppingBag,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: Home, exact: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: Folder },
  { to: "/admin/services", label: "Services", icon: Layers },
  { to: "/admin/projects", label: "Projects", icon: Boxes },
  { to: "/admin/posts", label: "Insights", icon: FileText },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/messages", label: "Messages", icon: Mail },
  { to: "/admin/rewards", label: "Rewards", icon: Gift },
  { to: "/admin/roles", label: "Roles", icon: ShieldCheck },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, profile, roles, isStaff, loading } = useAccount();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="panel max-w-md p-8 text-center">
          <ShieldCheck className="mx-auto size-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl">Staff access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {user
              ? "Your account doesn't have an admin role assigned. Contact a super admin if you believe this is a mistake."
              : "Sign in with a staff account to access the admin portal."}
          </p>
          <Button variant="accent" size="lg" className="mt-6" asChild>
            {user ? (
              <Link to="/">Back to site</Link>
            ) : (
              <Link to="/auth" search={{ redirect: "/admin" }}>
                Sign in
              </Link>
            )}
          </Button>
        </div>
      </div>
    );
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="flex min-h-screen bg-secondary/30">
      <aside className="surface-ink hidden w-64 shrink-0 flex-col md:flex">
        <div className="px-5 py-6">
          <Link to="/" className="block">
            <BrandLogo variant="admin" inverted />
          </Link>
          <p className="mt-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-muted">
            Admin portal
          </p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exact" in item && item.exact }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-ink-foreground/10 hover:text-ink-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-ink-muted/20 px-4 py-4">
          <p className="truncate text-sm text-ink-foreground">
            {profile?.full_name || profile?.email}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-muted">{roles.join(", ")}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="onInk" size="sm" className="flex-1" asChild>
              <Link to="/">Back to site</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-ink-muted hover:text-ink-foreground"
              onClick={signOut}
            >
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3 md:hidden">
          <Link to="/">
            <BrandLogo variant="header" className="h-10 sm:h-10" />
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/" })}>
              Site
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-background px-2 py-1.5 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exact" in item && item.exact }}
              className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary [&.active]:bg-accent [&.active]:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
