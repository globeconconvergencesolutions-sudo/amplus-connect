import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminBulkDeleteBar,
  AdminDeleteButton,
  AdminRowCheckbox,
  AdminSelectAll,
} from "@/components/admin-bulk-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { deleteCustomers } from "@/lib/admin-delete.functions";
import { formatDate, formatKes, tierLabel } from "@/lib/format";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  loyalty_points: number;
  tier: string;
  created_at: string;
};

export const Route = createFileRoute("/admin/customers/")({
  component: AdminCustomersPage,
});

function useAllProfiles() {
  return useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as ProfileRow[];
    },
  });
}

function AdminCustomersPage() {
  const customers = useAllProfiles();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const rows = customers.data ?? [];
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (c) =>
        (c.full_name ?? "").toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q),
    );
  }, [customers.data, search]);

  const ids = useMemo(() => filtered.map((row) => row.id), [filtered]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = ids.some((id) => selected.has(id));

  async function removeCustomers(customerIds: string[]) {
    setDeleting(true);
    try {
      const result = await deleteCustomers({ data: { ids: customerIds } });
      toast.success(`Deleted ${result.deleted} customer${result.deleted === 1 ? "" : "s"}`);
      setSelected(new Set());
      setExpanded(null);
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-count"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete customers.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} of {customers.data?.length ?? 0}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          {ids.length > 0 ? (
            <AdminSelectAll
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              onCheckedChange={(next) => setSelected(next ? new Set(ids) : new Set())}
            />
          ) : null}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full sm:w-64"
          />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <AdminBulkDeleteBar
          count={selected.size}
          noun="customer"
          warning="This permanently deletes each selected account (auth user), their profile, orders, tickets, and related data. You cannot delete yourself or the last super admin."
          deleting={deleting}
          onClear={() => setSelected(new Set())}
          onConfirm={() => removeCustomers([...selected])}
        />
        {filtered.map((customer) => (
          <div key={customer.id} className="panel overflow-hidden">
            <div className="flex items-start gap-3 p-4">
              <div className="pt-1">
                <AdminRowCheckbox
                  checked={selected.has(customer.id)}
                  onCheckedChange={(next) => {
                    setSelected((prev) => {
                      const copy = new Set(prev);
                      if (next) copy.add(customer.id);
                      else copy.delete(customer.id);
                      return copy;
                    });
                  }}
                  label={`Select ${customer.full_name || customer.email || "customer"}`}
                />
              </div>
              <button
                type="button"
                className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 text-left"
                onClick={() => setExpanded(expanded === customer.id ? null : customer.id)}
              >
                <div>
                  <p className="font-medium">{customer.full_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground">
                    {customer.email} · {customer.phone} · Joined {formatDate(customer.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{tierLabel(customer.tier)}</Badge>
                  <span className="text-sm font-semibold">{customer.loyalty_points} pts</span>
                  {expanded === customer.id ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </div>
              </button>
            </div>
            {expanded === customer.id ? (
              <div className="border-t border-border bg-secondary/30 p-4">
                <CustomerDetail
                  customer={customer}
                  deleting={deleting}
                  onDelete={() => removeCustomers([customer.id])}
                />
              </div>
            ) : null}
          </div>
        ))}
        {!customers.isLoading && filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No customers found.</p>
        ) : null}
      </div>
    </AdminShell>
  );
}

const TIERS = ["bronze", "silver", "gold"] as const;

function CustomerDetail({
  customer,
  deleting,
  onDelete,
}: {
  customer: ProfileRow;
  deleting: boolean;
  onDelete: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [tier, setTier] = useState<(typeof TIERS)[number]>(
    (TIERS as readonly string[]).includes(customer.tier)
      ? (customer.tier as (typeof TIERS)[number])
      : "bronze",
  );

  const orders = useQuery({
    queryKey: ["admin-customer-orders", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, merchant_reference, status, total_kes, created_at")
        .eq("user_id", customer.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  async function onAdjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const loyalty_points = Number(form.get("loyalty_points") ?? customer.loyalty_points);

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ loyalty_points, tier })
      .eq("id", customer.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Customer updated");
    queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Recent orders
        </h3>
        <ul className="mt-2 space-y-1 text-sm">
          {(orders.data ?? []).map((order) => (
            <li key={order.id} className="flex justify-between">
              <span className="text-muted-foreground">{order.merchant_reference}</span>
              <span>{formatKes(order.total_kes)}</span>
            </li>
          ))}
          {!orders.isLoading && (orders.data ?? []).length === 0 ? (
            <li className="text-muted-foreground">No orders yet.</li>
          ) : null}
        </ul>
      </div>
      <form onSubmit={onAdjust} className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Adjust loyalty (rewards manager)
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`points-${customer.id}`}>Points</Label>
            <Input
              id={`points-${customer.id}`}
              name="loyalty_points"
              type="number"
              defaultValue={customer.loyalty_points}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`tier-${customer.id}`}>Tier</Label>
            <Select
              value={tier}
              onValueChange={(value) => setTier(value as (typeof TIERS)[number])}
            >
              <SelectTrigger id={`tier-${customer.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bronze">Bronze</SelectItem>
                <SelectItem value="silver">Silver</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <AdminDeleteButton
            label={`Delete ${customer.full_name || customer.email || "this customer"}?`}
            warning="This permanently deletes their account, profile, orders, tickets, and related data. You cannot delete yourself or the last super admin."
            deleting={deleting}
            onConfirm={onDelete}
          />
        </div>
      </form>
    </div>
  );
}
