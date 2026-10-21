import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  FileSpreadsheet,
  LifeBuoy,
  Mail,
  Package,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/use-auth";
import { canAccessAdminPath } from "@/lib/admin-access";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatKes, ORDER_STATUS_LABELS } from "@/lib/format";
import { countOpenSupportTickets } from "@/lib/support.functions";
import { isMissingRelation } from "@/lib/supabase-errors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function useCount(
  table: "products" | "orders" | "profiles" | "contact_messages" | "interest_leads",
  filter?: [string, string],
) {
  return useQuery({
    queryKey: ["admin-count", table, filter],
    retry: false,
    queryFn: async () => {
      let query = supabase.from(table).select("*", { count: "exact", head: true });
      if (filter) query = query.eq(filter[0], filter[1]);
      const { count, error } = await query;
      if (isMissingRelation(error)) return 0;
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function StatLink({
  label,
  value,
  to,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | undefined;
  to: string;
  icon: typeof Package;
  tone?: "default" | "attention";
}) {
  return (
    <Link
      to={to}
      className={cn(
        "panel group flex items-start gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-lift)]",
        tone === "attention" && (value ?? 0) > 0 && "border-accent/40 bg-accent/5",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          tone === "attention" && (value ?? 0) > 0
            ? "bg-accent/15 text-accent"
            : "bg-secondary text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold tracking-tight">{value ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <ArrowRight className="ml-auto size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function AdminDashboard() {
  const { profile, roles } = useAccount();
  const can = (path: string) => canAccessAdminPath(roles, path);
  const firstName =
    profile?.full_name?.trim().split(/\s+/)[0] || profile?.email?.split("@")[0] || "there";

  const canCommerce = can("/admin/orders");
  const canCustomers = can("/admin/customers");
  const canMessages = can("/admin/messages");
  const canTickets = can("/admin/tickets");

  const productCount = useCount("products");
  const orderCount = useCount("orders");
  const pendingCount = useCount("orders", ["status", "PENDING_PAYMENT"]);
  const awaitingCount = useCount("orders", ["status", "PAYMENT_PROCESSING"]);
  const customerCount = useCount("profiles");
  const unhandledMessages = useCount("contact_messages", ["handled", "false"]);
  const newLeads = useCount("interest_leads", ["status", "new"]);
  const openTickets = useQuery({
    queryKey: ["admin-count", "support_tickets-open"],
    retry: false,
    enabled: canTickets,
    queryFn: () => countOpenSupportTickets(),
  });

  const recentOrders = useQuery({
    queryKey: ["admin-recent-orders"],
    enabled: canCommerce,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, merchant_reference, status, total_kes, customer_email, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const recentLeads = useQuery({
    queryKey: ["admin-recent-leads"],
    retry: false,
    enabled: canCommerce,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interest_leads")
        .select("id, full_name, product_name, phone, status, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (isMissingRelation(error)) return [];
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const recentMessages = useQuery({
    queryKey: ["admin-recent-messages"],
    enabled: canMessages,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("id, name, email, subject, handled, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const attention = [
    {
      key: "leads",
      label: "New leads to call",
      value: newLeads.data ?? 0,
      to: "/admin/leads" as const,
      icon: Sparkles,
      show: canCommerce,
    },
    {
      key: "awaiting",
      label: "Payments to confirm",
      value: awaitingCount.data ?? 0,
      to: "/admin/orders" as const,
      icon: ShoppingBag,
      show: canCommerce,
    },
    {
      key: "pending",
      label: "Awaiting transfer",
      value: pendingCount.data ?? 0,
      to: "/admin/orders" as const,
      icon: ShoppingBag,
      show: canCommerce,
    },
    {
      key: "tickets",
      label: "Open tickets",
      value: openTickets.data ?? 0,
      to: "/admin/tickets" as const,
      icon: LifeBuoy,
      show: canTickets,
    },
    {
      key: "messages",
      label: "Unread messages",
      value: unhandledMessages.data ?? 0,
      to: "/admin/messages" as const,
      icon: Mail,
      show: canMessages,
    },
  ].filter((row) => row.show);

  const needsAttention = attention.filter((row) => row.value > 0);
  const attentionTotal = needsAttention.reduce((sum, row) => sum + row.value, 0);
  const hour = new Date().getHours();

  const glance = [
    {
      label: "Products",
      value: productCount.data,
      to: "/admin/products",
      icon: Package,
      show: can("/admin/products"),
    },
    {
      label: "Orders",
      value: orderCount.data,
      to: "/admin/orders",
      icon: ShoppingBag,
      show: canCommerce,
    },
    {
      label: "Customers",
      value: customerCount.data,
      to: "/admin/customers",
      icon: Users,
      show: canCustomers,
    },
    {
      label: "New leads",
      value: newLeads.data,
      to: "/admin/leads",
      icon: Sparkles,
      show: canCommerce,
      tone: "attention" as const,
    },
  ].filter((row) => row.show);

  const quickLinks = [
    { to: "/admin/leads" as const, label: "Leads", icon: Sparkles, accent: true },
    { to: "/admin/orders" as const, label: "Orders", icon: null, accent: false },
    { to: "/admin/products" as const, label: "Products", icon: null, accent: false },
    { to: "/admin/reports" as const, label: "Reports", icon: FileSpreadsheet, accent: false },
  ].filter((link) => can(link.to));

  const clearQueueLinks = [
    { to: "/admin/delivery" as const, label: "Delivery", icon: Truck },
    { to: "/admin/products" as const, label: "Products", icon: Package },
  ].filter((link) => can(link.to));

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent">
            Overview
          </p>
          <h1 className="mt-1 text-2xl tracking-tight sm:text-3xl">
            {greetingForHour(hour)}, {firstName}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            {attentionTotal > 0
              ? `${attentionTotal} item${attentionTotal === 1 ? "" : "s"} need attention — start with your queue below.`
              : "Nothing urgent in your areas right now."}
          </p>
        </div>
        {quickLinks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <Button
                key={link.to}
                variant={link.accent ? "accent" : "outline"}
                size="sm"
                className="rounded-full"
                asChild
              >
                <Link to={link.to}>
                  {link.icon ? <link.icon className="size-3.5" /> : null} {link.label}
                </Link>
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {needsAttention.length > 0 ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Needs attention</h2>
            <Badge className="bg-accent text-accent-foreground">{attentionTotal} open</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {attention.map((row) => (
              <StatLink
                key={row.key}
                label={row.label}
                value={row.value}
                to={row.to}
                icon={row.icon}
                tone="attention"
              />
            ))}
          </div>
        </section>
      ) : (
        <section className="panel mt-8 border-dashed p-5">
          <p className="text-sm font-medium">Queue is clear</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing in your assigned areas needs attention right now.
          </p>
          {clearQueueLinks.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {clearQueueLinks.map((link) => (
                <Button key={link.to} variant="outline" size="sm" className="rounded-full" asChild>
                  <Link to={link.to}>
                    <link.icon className="size-3.5" /> {link.label}
                  </Link>
                </Button>
              ))}
            </div>
          ) : null}
        </section>
      )}

      {glance.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold">At a glance</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {glance.map((row) => (
              <StatLink
                key={row.to}
                label={row.label}
                value={row.value}
                to={row.to}
                icon={row.icon}
                {...(row.tone ? { tone: row.tone } : {})}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div
        className={cn(
          "mt-8 grid gap-6",
          [canCommerce, canCommerce, canMessages].filter(Boolean).length > 1
            ? "lg:grid-cols-3"
            : "lg:grid-cols-1",
        )}
      >
        {canCommerce ? (
          <div className="panel lg:col-span-1">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">Recent leads</h2>
              <Link
                to="/admin/leads"
                className="inline-flex items-center gap-1 text-xs text-accent"
              >
                View all <ArrowRight className="size-3" />
              </Link>
            </div>
            <ul className="divide-y divide-border">
              {(recentLeads.data ?? []).map((lead) => (
                <li key={lead.id}>
                  <Link
                    to="/admin/leads"
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-secondary/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{lead.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {lead.product_name} · {lead.phone}
                      </p>
                    </div>
                    {lead.status === "new" ? (
                      <Badge className="shrink-0 bg-accent text-accent-foreground">New</Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0 text-[0.65rem]">
                        {lead.status}
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
              {!recentLeads.isLoading && (recentLeads.data ?? []).length === 0 ? (
                <li className="px-5 py-6 text-center text-sm text-muted-foreground">
                  No leads yet.
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {canCommerce ? (
          <div className="panel lg:col-span-1">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">Recent orders</h2>
              <Link
                to="/admin/orders"
                className="inline-flex items-center gap-1 text-xs text-accent"
              >
                View all <ArrowRight className="size-3" />
              </Link>
            </div>
            <ul className="divide-y divide-border">
              {(recentOrders.data ?? []).map((order) => (
                <li
                  key={order.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{order.merchant_reference}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.customer_email} · {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{formatKes(order.total_kes)}</p>
                    <Badge variant="secondary" className="mt-1 text-[0.65rem]">
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                  </div>
                </li>
              ))}
              {!recentOrders.isLoading && (recentOrders.data ?? []).length === 0 ? (
                <li className="px-5 py-6 text-center text-sm text-muted-foreground">
                  No orders yet.
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {canMessages ? (
          <div className="panel lg:col-span-1">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">Recent messages</h2>
              <Link
                to="/admin/messages"
                className="inline-flex items-center gap-1 text-xs text-accent"
              >
                View all <ArrowRight className="size-3" />
              </Link>
            </div>
            <ul className="divide-y divide-border">
              {(recentMessages.data ?? []).map((message) => (
                <li key={message.id}>
                  <Link
                    to="/admin/messages"
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-secondary/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{message.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {message.subject || message.email}
                      </p>
                    </div>
                    {!message.handled ? (
                      <Badge className="shrink-0 bg-accent text-accent-foreground">New</Badge>
                    ) : null}
                  </Link>
                </li>
              ))}
              {!recentMessages.isLoading && (recentMessages.data ?? []).length === 0 ? (
                <li className="px-5 py-6 text-center text-sm text-muted-foreground">
                  No messages yet.
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
