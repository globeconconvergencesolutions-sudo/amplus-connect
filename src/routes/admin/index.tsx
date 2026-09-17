import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Mail, Package, ShoppingBag, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatKes, ORDER_STATUS_LABELS } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function useCount(
  table: "products" | "orders" | "profiles" | "contact_messages",
  filter?: [string, string],
) {
  return useQuery({
    queryKey: ["admin-count", table, filter],
    queryFn: async () => {
      let query = supabase.from(table).select("*", { count: "exact", head: true });
      if (filter) query = query.eq(filter[0], filter[1]);
      const { count, error } = await query;
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
}

function AdminDashboard() {
  const productCount = useCount("products");
  const orderCount = useCount("orders");
  const pendingCount = useCount("orders", ["status", "PENDING_PAYMENT"]);
  const customerCount = useCount("profiles");
  const unhandledMessages = useCount("contact_messages", ["handled", "false"]);

  const recentOrders = useQuery({
    queryKey: ["admin-recent-orders"],
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

  const recentMessages = useQuery({
    queryKey: ["admin-recent-messages"],
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

  const stats = [
    { label: "Products", value: productCount.data, icon: Package, to: "/admin/products" },
    { label: "Orders", value: orderCount.data, icon: ShoppingBag, to: "/admin/orders" },
    { label: "Pending payment", value: pendingCount.data, icon: ShoppingBag, to: "/admin/orders" },
    { label: "Customers", value: customerCount.data, icon: Users, to: "/admin/customers" },
    { label: "Unread messages", value: unhandledMessages.data, icon: Mail, to: "/admin/messages" },
  ] as const;

  return (
    <AdminShell>
      <h1 className="text-2xl">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">An overview of your store and content.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className="panel p-5 transition-shadow hover:shadow-[var(--shadow-lift)]"
          >
            <stat.icon className="size-5 text-accent" />
            <p className="mt-3 text-2xl font-bold">{stat.value ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="panel">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Recent orders</h2>
            <Link to="/admin/orders" className="inline-flex items-center gap-1 text-xs text-accent">
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {(recentOrders.data ?? []).map((order) => (
              <li key={order.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">{order.merchant_reference}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.customer_email} · {formatDate(order.created_at)}
                  </p>
                </div>
                <div className="text-right">
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

        <div className="panel">
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
              <li key={message.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">{message.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {message.subject || message.email}
                  </p>
                </div>
                {!message.handled ? (
                  <Badge className="bg-accent text-accent-foreground">New</Badge>
                ) : null}
              </li>
            ))}
            {!recentMessages.isLoading && (recentMessages.data ?? []).length === 0 ? (
              <li className="px-5 py-6 text-center text-sm text-muted-foreground">
                No messages yet.
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </AdminShell>
  );
}
