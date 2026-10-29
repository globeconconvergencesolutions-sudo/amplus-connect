import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCustomer,
  createOrderFromCustomer,
  deleteCustomer,
  getCustomerDetail,
  listCustomers,
  updateCustomer,
} from "@/lib/customers.functions";
import { listProductsForInvoice } from "@/lib/invoice.functions";
import { formatDate, formatKes, ORDER_STATUS_LABELS } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/customers/")({
  component: AdminCustomersPage,
});

function AdminCustomersPage() {
  const queryClient = useQueryClient();
  const customers = useQuery({
    queryKey: ["admin-crm-customers"],
    retry: false,
    queryFn: () => listCustomers(),
  });
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const rows = customers.data ?? [];
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.location ?? "").toLowerCase().includes(q),
    );
  }, [customers.data, search]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setCreating(true);
    try {
      await createCustomer({
        data: {
          fullName: String(form.get("full_name") ?? ""),
          phone: String(form.get("phone") ?? ""),
          email: String(form.get("email") ?? ""),
          location: String(form.get("location") ?? ""),
          notes: String(form.get("notes") ?? ""),
        },
      });
      toast.success("Customer created");
      formEl.reset();
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["admin-crm-customers"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create customer.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CRM contacts only — staff accounts never appear here. Phone is enough; email unlocks a
            future login link.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email…"
            className="w-64"
          />
          <Button type="button" variant="accent" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="size-4" />
            {showCreate ? "Hide form" : "New customer"}
          </Button>
        </div>
      </div>

      {showCreate ? (
        <form onSubmit={onCreate} className="panel mt-6 grid gap-3 p-5 sm:grid-cols-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">
            Create customer
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" required placeholder="07… or +254…" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="location">Location (optional)</Label>
            <Input id="location" name="location" />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="accent" disabled={creating}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : null}
              Save customer
            </Button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 space-y-3">
        {customers.isError ? (
          <p className="panel p-6 text-sm text-destructive">
            {customers.error instanceof Error
              ? customers.error.message
              : "Could not load customers."}
          </p>
        ) : null}
        {filtered.map((customer) => (
          <div key={customer.id} className="panel overflow-hidden">
            <button
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
              onClick={() => setExpanded(expanded === customer.id ? null : customer.id)}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <UserRound className="size-4" />
                </span>
                <div>
                  <p className="font-medium">{customer.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {customer.phone}
                    {customer.email ? ` · ${customer.email}` : ""}
                    {customer.location ? ` · ${customer.location}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {customer.user_id ? <Badge variant="secondary">Has login</Badge> : null}
                <span className="text-xs text-muted-foreground">
                  Added {formatDate(customer.created_at)}
                </span>
                {expanded === customer.id ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </div>
            </button>
            {expanded === customer.id ? (
              <div className="border-t border-border bg-secondary/30 p-4">
                <CustomerDetail
                  customerId={customer.id}
                  onChanged={() => {
                    queryClient.invalidateQueries({ queryKey: ["admin-crm-customers"] });
                    queryClient.invalidateQueries({
                      queryKey: ["admin-crm-customer", customer.id],
                    });
                  }}
                />
              </div>
            ) : null}
          </div>
        ))}
        {!customers.isLoading && filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No CRM customers yet. Create one or convert a won lead.
          </p>
        ) : null}
      </div>
    </AdminShell>
  );
}

function CustomerDetail({ customerId, onChanged }: { customerId: string; onChanged: () => void }) {
  const detail = useQuery({
    queryKey: ["admin-crm-customer", customerId],
    queryFn: () => getCustomerDetail({ data: { id: customerId } }),
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await updateCustomer({
        data: {
          id: customerId,
          fullName: String(form.get("full_name") ?? ""),
          phone: String(form.get("phone") ?? ""),
          email: String(form.get("email") ?? ""),
          location: String(form.get("location") ?? ""),
          notes: String(form.get("notes") ?? ""),
        },
      });
      toast.success("Customer updated");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    const ok = window.confirm("Delete this CRM customer? Linked leads will keep their history.");
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteCustomer({ data: { id: customerId } });
      toast.success("Customer deleted");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete.");
    } finally {
      setDeleting(false);
    }
  }

  if (detail.isLoading || !detail.data) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </p>
    );
  }

  const { customer, leads, invoices, orders } = detail.data;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={onSave} className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Details
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`name-${customerId}`}>Name</Label>
            <Input
              id={`name-${customerId}`}
              name="full_name"
              defaultValue={customer.full_name}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`phone-${customerId}`}>Phone</Label>
            <Input id={`phone-${customerId}`} name="phone" defaultValue={customer.phone} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`email-${customerId}`}>Email</Label>
            <Input
              id={`email-${customerId}`}
              name="email"
              type="email"
              defaultValue={customer.email ?? ""}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`loc-${customerId}`}>Location</Label>
            <Input
              id={`loc-${customerId}`}
              name="location"
              defaultValue={customer.location ?? ""}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`notes-${customerId}`}>Notes</Label>
          <Textarea
            id={`notes-${customerId}`}
            name="notes"
            rows={3}
            defaultValue={customer.notes ?? ""}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={deleting}
            onClick={() => void onDelete()}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </form>

      <div className="space-y-5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Linked leads
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {leads.map((lead) => (
              <li key={lead.id} className="flex justify-between gap-2">
                <Link to="/admin/leads" className="text-accent hover:underline">
                  {lead.product_name}
                </Link>
                <span className="text-muted-foreground">{lead.status}</span>
              </li>
            ))}
            {leads.length === 0 ? (
              <li className="text-muted-foreground">No linked interest leads.</li>
            ) : null}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Orders
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {orders.map((ord) => (
              <li key={ord.id} className="flex justify-between gap-2">
                <Link to="/admin/orders" className="text-accent hover:underline">
                  {ord.merchant_reference}
                </Link>
                <span className="text-muted-foreground">
                  {ORDER_STATUS_LABELS[ord.status as keyof typeof ORDER_STATUS_LABELS] ??
                    ord.status}{" "}
                  · {formatKes(ord.total_kes)}
                </span>
              </li>
            ))}
            {orders.length === 0 ? (
              <li className="text-muted-foreground">No linked orders yet.</li>
            ) : null}
          </ul>
          <CreateOrderForCustomer
            customerId={customerId}
            onCreated={() => {
              onChanged();
              void detail.refetch();
            }}
          />
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Invoices
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex justify-between gap-2">
                <Link to="/admin/invoices" className="text-accent hover:underline">
                  {inv.invoice_number}
                  {inv.document_kind === "proforma" ? " (proforma)" : ""}
                </Link>
                <span className="text-muted-foreground">{formatKes(inv.total_kes)}</span>
              </li>
            ))}
            {invoices.length === 0 ? (
              <li className="text-muted-foreground">No invoices yet.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CreateOrderForCustomer({
  customerId,
  onCreated,
}: {
  customerId: string;
  onCreated: () => void;
}) {
  const products = useQuery({
    queryKey: ["admin-invoice-products"],
    queryFn: () => listProductsForInvoice(),
  });
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [lines, setLines] = useState<{ productId: string; name: string; quantity: number }[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function addLine() {
    const product = (products.data ?? []).find((row) => row.id === productId);
    if (!product) return;
    const qty = Math.max(1, Number(quantity) || 1);
    setLines((prev) => {
      const existing = prev.find((line) => line.productId === product.id);
      if (existing) {
        return prev.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + qty } : line,
        );
      }
      return [...prev, { productId: product.id, name: product.name, quantity: qty }];
    });
    setQuantity("1");
  }

  async function submit(markPaid: boolean) {
    if (!lines.length) {
      toast.error("Add at least one product line.");
      return;
    }
    setBusy(true);
    try {
      const result = await createOrderFromCustomer({
        data: {
          customerId,
          lines: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
          notes,
          issuePendingPayment: !markPaid,
        },
      });
      toast.success(`Order ${result.merchantReference} created`);
      setLines([]);
      setNotes("");
      setOpen(false);
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
        <Plus className="size-3.5" />
        {open ? "Close order form" : "New order"}
      </Button>
      {open ? (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-background p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_5rem_auto]">
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent>
                {(products.data ?? []).map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} · {formatKes(product.price_kes)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-label="Quantity"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={addLine}
              disabled={!productId}
            >
              Add
            </Button>
          </div>
          <ul className="space-y-1 text-sm">
            {lines.map((line) => (
              <li key={line.productId} className="flex justify-between gap-2">
                <span>
                  {line.name} × {line.quantity}
                </span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setLines((prev) => prev.filter((row) => row.productId !== line.productId))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
            {lines.length === 0 ? <li className="text-muted-foreground">No lines yet.</li> : null}
          </ul>
          <Textarea
            rows={2}
            placeholder="Order notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="accent"
              disabled={busy}
              onClick={() => void submit(false)}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Create (awaiting payment)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void submit(true)}
            >
              Create as paid
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
