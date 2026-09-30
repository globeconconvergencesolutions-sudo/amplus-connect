import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, type FormEvent } from "react";
import { z } from "zod";
import { ChevronLeft, ChevronRight, LifeBuoy, Loader2, LogOut, MapPin, MessageCircle, Package, Phone, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAccount, useSignOut } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { addressesQuery, loyaltyHistoryQuery, ordersQuery, ticketsQuery, wishlistQuery } from "@/lib/account";
import { createGeneralTicket } from "@/lib/support.functions";
import { COMPANY, supportLinks } from "@/lib/company";
import { loyaltySettingsQuery } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { formatDate, formatKes, ORDER_STATUS_LABELS, orderHeadline, tierLabel } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { AccountOrderCard, type AccountOrder } from "@/components/account-order-card";
import { TicketThread } from "@/components/ticket-thread";

const TABS = ["profile", "orders", "support", "addresses", "wishlist", "rewards"] as const;

export const Route = createFileRoute("/account/")({
  validateSearch: z.object({ tab: z.enum(TABS).optional() }),
  component: AccountPage,
});

function AccountPage() {
  const { user, profile, loading, isStaff } = useAccount();
  const { signOut, signingOut } = useSignOut();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  if (loading) {
    return (
      <PageShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
          <h1 className="text-2xl">Sign in to your account</h1>
          <Button variant="accent" size="lg" className="mt-6" asChild>
            <Link to="/auth" search={{ redirect: "/account" }}>
              Sign in / register
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="My account"
        title={profile?.full_name || "Welcome back"}
        description={`${tierLabel(profile?.tier)} member · ${profile?.loyalty_points ?? 0} loyalty points`}
      />
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-semibold text-foreground">{user.email}</span>
          </p>
          <Button variant="outline" size="sm" onClick={() => void signOut()} disabled={signingOut}>
            <LogOut /> {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>

        {isStaff ? (
          <div className="mb-6 flex flex-col gap-3 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>You have staff access.</span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin">Go to admin portal</Link>
            </Button>
          </div>
        ) : null}

        <Tabs
          value={tab ?? "profile"}
          onValueChange={(value) =>
            navigate({
              to: "/account",
              search: { tab: value as (typeof TABS)[number] },
              replace: true,
            })
          }
        >
          <TabsList className="flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto bg-secondary/60 p-1 [-webkit-overflow-scrolling:touch]">
            <TabsTrigger className="min-h-11 shrink-0 px-4" value="profile">
              Profile
            </TabsTrigger>
            <TabsTrigger className="min-h-11 shrink-0 px-4" value="orders">
              Orders
            </TabsTrigger>
            <TabsTrigger className="min-h-11 shrink-0 px-4" value="support">
              Support
            </TabsTrigger>
            <TabsTrigger className="min-h-11 shrink-0 px-4" value="addresses">
              Addresses
            </TabsTrigger>
            <TabsTrigger className="min-h-11 shrink-0 px-4" value="wishlist">
              Wishlist
            </TabsTrigger>
            <TabsTrigger className="min-h-11 shrink-0 px-4" value="rewards">
              Rewards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <ProfileTab userId={user.id} />
          </TabsContent>
          <TabsContent value="orders" className="mt-6">
            <OrdersTab userId={user.id} />
          </TabsContent>
          <TabsContent value="support" className="mt-6">
            <SupportTab userId={user.id} />
          </TabsContent>
          <TabsContent value="addresses" className="mt-6">
            <AddressesTab userId={user.id} />
          </TabsContent>
          <TabsContent value="wishlist" className="mt-6">
            <WishlistTab userId={user.id} />
          </TabsContent>
          <TabsContent value="rewards" className="mt-6">
            <RewardsTab userId={user.id} />
          </TabsContent>
        </Tabs>
      </section>
    </PageShell>
  );
}

function ProfileTab({ userId }: { userId: string }) {
  const { profile } = useAccount();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const full_name = String(form.get("full_name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();

    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name, phone }).eq("id", userId);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
    queryClient.invalidateQueries({ queryKey: ["profile", userId] });
  }

  return (
    <form onSubmit={onSave} className="panel mx-auto max-w-lg space-y-4 p-5 sm:p-6">
      <h2 className="text-lg">Profile details</h2>
      <p className="text-sm text-muted-foreground">
        {tierLabel(profile?.tier)} · {profile?.loyalty_points ?? 0} loyalty points
      </p>
      <div className="grid gap-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ""} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={profile?.email ?? ""} disabled />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={profile?.phone ?? ""} />
      </div>
      <Button type="submit" variant="accent" className="min-h-11 w-full sm:w-auto" disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

const ORDER_PAGE_SIZE = 5;

function OrdersTab({ userId }: { userId: string }) {
  const orders = useQuery(ordersQuery(userId));
  const [filter, setFilter] = useState<"all" | "pay" | "processing" | "paid" | "cancelled">("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [filter]);

  if (orders.isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-secondary" />;
  }

  const list = (orders.data ?? []) as AccountOrder[];
  if (list.length === 0) {
    return (
      <div className="panel flex flex-col items-center gap-3 p-10 text-center sm:p-12">
        <Package className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">You haven't placed any orders yet.</p>
        <Button variant="accent" className="min-h-11" asChild>
          <Link to="/products">Shop materials</Link>
        </Button>
      </div>
    );
  }

  const filtered = list.filter((order) => {
    if (filter === "pay") return order.status === "PENDING_PAYMENT";
    if (filter === "processing") return order.status === "PAYMENT_PROCESSING";
    if (filter === "paid") {
      return ["PAID", "FULFILLED", "SHIPPED", "DELIVERED"].includes(order.status);
    }
    if (filter === "cancelled") return order.status === "CANCELLED";
    return order.status !== "CANCELLED";
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / ORDER_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * ORDER_PAGE_SIZE, (safePage + 1) * ORDER_PAGE_SIZE);

  const payCount = list.filter((order) => order.status === "PENDING_PAYMENT").length;
  const processingCount = list.filter((order) => order.status === "PAYMENT_PROCESSING").length;

  const chips = [
    { id: "all" as const, label: "Active" },
    { id: "pay" as const, label: payCount > 0 ? `Pay now (${payCount})` : "Pay now" },
    { id: "processing" as const, label: processingCount > 0 ? `Processing (${processingCount})` : "Processing" },
    { id: "paid" as const, label: "Paid & delivery" },
    { id: "cancelled" as const, label: "Cancelled" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tap <span className="font-medium text-foreground">Pay now</span> on an order to see M-Pesa or
        bank steps. One method at a time — then paste your receipt.
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        {chips.map((chip) => (
          <Button
            key={chip.id}
            type="button"
            size="sm"
            variant={filter === chip.id ? "accent" : "outline"}
            className="min-h-11 shrink-0"
            onClick={() => setFilter(chip.id)}
          >
            {chip.label}
          </Button>
        ))}
      </div>
      {visible.map((order) => (
        <AccountOrderCard key={order.id} order={order} onUpdated={() => void orders.refetch()} />
      ))}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No orders in this filter.</p>
      ) : null}
      {filtered.length > ORDER_PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={safePage === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <p className="text-sm text-muted-foreground">
            {safePage + 1} of {pageCount}
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SupportTab({ userId }: { userId: string }) {
  const tickets = useQuery(ticketsQuery(userId));
  const orders = useQuery(ordersQuery(userId));
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [orderId, setOrderId] = useState("");
  const [sending, setSending] = useState(false);
  const links = supportLinks();

  if (tickets.isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-secondary" />;
  }

  const list = tickets.data?.tickets ?? [];
  const schemaMissing = tickets.data?.schemaMissing === true;
  const orderByRef = new Map(
    (orders.data ?? []).map((order) => [order.merchant_reference, order] as const),
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (schemaMissing) {
      toast.error("Support tables are not installed on this database yet.");
      return;
    }
    setSending(true);
    try {
      const result = await createGeneralTicket({
        data: {
          subject,
          message,
          orderId: orderId || null,
        },
      });
      toast.success(`Ticket ${result.ticketNumber} opened.`);
      setSubject("");
      setMessage("");
      setOrderId("");
      setOpenId(result.ticketId);
      await queryClient.invalidateQueries({ queryKey: ["support-tickets", userId] });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not open a ticket.";
      toast.error(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <LifeBuoy className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Open a ticket</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use this for deliveries, products, invoices, or anything else — not only payments. You
              can still open a payment ticket from an order if a transfer is waiting.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={links.callHref}>
                  <Phone className="size-4" /> Call {COMPANY.phone}
                </a>
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={links.whatsappHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>

        {schemaMissing ? (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            This project has not created the support tables yet. In the Supabase SQL editor, run{" "}
            <code className="text-xs">supabase/migrations/20260929120000_support_tickets.sql</code>,
            then refresh this page.
          </p>
        ) : null}

        <form className="mt-4 space-y-3" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input
              id="ticket-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Wrong item received"
              disabled={schemaMissing || sending}
              required
              minLength={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Related order (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Pick the materials this is about. You can leave it unselected.
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-0.5">
              <button
                type="button"
                disabled={schemaMissing || sending}
                onClick={() => setOrderId("")}
                className={cn(
                  "flex min-h-11 w-full items-center rounded-lg border px-3 py-2 text-left text-sm",
                  orderId === ""
                    ? "border-accent bg-accent/10 font-medium"
                    : "border-border hover:bg-secondary/60",
                )}
              >
                Not related to an order
              </button>
              {(orders.data ?? []).map((order) => {
                const title = orderHeadline(
                  order.order_items,
                  order.merchant_reference,
                );
                const selected = orderId === order.id;
                return (
                  <button
                    key={order.id}
                    type="button"
                    disabled={schemaMissing || sending}
                    onClick={() => setOrderId(order.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2.5 text-left",
                      selected ? "border-accent bg-accent/10" : "border-border hover:bg-secondary/60",
                    )}
                  >
                    <p className="truncate text-sm font-semibold">{title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ORDER_STATUS_LABELS[order.status] ?? order.status} · {formatDate(order.created_at)} ·{" "}
                      {formatKes(order.total_kes)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-message">Details</Label>
            <Textarea
              id="ticket-message"
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Tell us what happened and what you need."
              disabled={schemaMissing || sending}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" variant="accent" disabled={schemaMissing || sending}>
            {sending ? <Loader2 className="animate-spin" /> : null}
            Submit ticket
          </Button>
        </form>
      </div>

      {list.length === 0 && !schemaMissing ? (
        <p className="py-2 text-center text-sm text-muted-foreground">You have no tickets yet.</p>
      ) : null}

      {list.map((ticket) => (
        <div key={ticket.id} className="panel overflow-hidden">
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-between gap-3 p-4 text-left"
            onClick={() => setOpenId(openId === ticket.id ? null : ticket.id)}
          >
            <div>
              <p className="font-semibold">{ticket.subject || ticket.ticket_number}</p>
              <p className="text-xs text-muted-foreground">
                {ticket.ticket_number}
                {ticket.merchant_reference
                  ? ` · ${orderHeadline(orderByRef.get(ticket.merchant_reference)?.order_items, ticket.merchant_reference)}`
                  : ""}{" "}
                · {formatDate(ticket.created_at)}
              </p>
            </div>
            <Badge variant={ticket.status === "resolved" ? "secondary" : "default"}>
              {ticket.status.replaceAll("_", " ")}
            </Badge>
          </button>
          {openId === ticket.id ? (
            <div className="border-t border-border p-4">
              <TicketThread
                ticketId={ticket.id}
                ticketNumber={ticket.ticket_number}
                status={ticket.status}
                orderRef={ticket.merchant_reference}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function AddressesTab({ userId }: { userId: string }) {
  const addresses = useQuery(addressesQuery(userId));
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      user_id: userId,
      label: String(form.get("label") ?? "").trim() || null,
      recipient_name: String(form.get("recipient_name") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      county: String(form.get("county") ?? "").trim() || null,
      town: String(form.get("town") ?? "").trim() || null,
      street: String(form.get("street") ?? "").trim() || null,
      notes: String(form.get("notes") ?? "").trim() || null,
    };
    if (!payload.recipient_name || !payload.phone) {
      toast.error("Recipient name and phone are required.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("addresses").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Address saved");
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["addresses", userId] });
  }

  async function remove(id: string) {
    await supabase.from("addresses").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["addresses", userId] });
  }

  async function setDefault(id: string) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
    await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["addresses", userId] });
  }

  return (
    <div>
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="accent" size="sm">
              <Plus /> Add address
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add delivery address</DialogTitle>
            </DialogHeader>
            <form onSubmit={onAdd} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="label">Label (optional)</Label>
                <Input id="label" name="label" placeholder="Home, Site office…" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="recipient_name">Recipient</Label>
                  <Input id="recipient_name" name="recipient_name" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="county">County</Label>
                  <Input id="county" name="county" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="town">Town</Label>
                  <Input id="town" name="town" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="street">Street / building</Label>
                <Input id="street" name="street" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>
              <Button type="submit" variant="accent" disabled={saving}>
                {saving ? "Saving…" : "Save address"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 grid gap-4">
        {(addresses.data ?? []).map((address) => (
          <div key={address.id} className="panel p-4 sm:p-5">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <MapPin className="size-4 text-accent" /> {address.label || "Address"}
              {address.is_default ? <Badge>Default</Badge> : null}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {address.recipient_name} · {address.phone}
            </p>
            <p className="text-sm text-muted-foreground">
              {[address.street, address.town, address.county].filter(Boolean).join(", ")}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {!address.is_default ? (
                <Button
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={() => setDefault(address.id)}
                >
                  Set as default
                </Button>
              ) : null}
              <Button
                variant="ghost"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => remove(address.id)}
              >
                <Trash2 className="size-4 text-destructive" /> Remove
              </Button>
            </div>
          </div>
        ))}
        {!addresses.isLoading && (addresses.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved addresses yet.</p>
        ) : null}
      </div>
    </div>
  );
}

function WishlistTab({ userId }: { userId: string }) {
  const wishlist = useQuery(wishlistQuery(userId));
  const queryClient = useQueryClient();
  const { add } = useCart();

  async function remove(id: string) {
    await supabase.from("wishlist_items").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["wishlist", userId] });
  }

  const items = (wishlist.data ?? []) as Array<{
    id: string;
    product_id: string;
    products: {
      id: string;
      name: string;
      slug: string;
      price_kes: number;
      unit: string;
      image_url: string | null;
      stock: number;
    } | null;
  }>;

  if (!wishlist.isLoading && items.length === 0) {
    return <p className="text-sm text-muted-foreground">Your wishlist is empty.</p>;
  }

  return (
    <div className="grid gap-4">
      {items.map((item) =>
        item.products ? (
          <div key={item.id} className="panel flex gap-3 p-4 sm:items-center">
            {item.products.image_url ? (
              <img
                src={item.products.image_url}
                alt=""
                className="size-16 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="size-16 shrink-0 rounded-md bg-secondary" />
            )}
            <div className="min-w-0 flex-1">
              <Link
                to="/products/$slug"
                params={{ slug: item.products.slug }}
                className="font-medium hover:text-accent"
              >
                {item.products.name}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatKes(item.products.price_kes)} / {item.products.unit}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  className="min-h-11 w-full sm:w-auto"
                  variant="accent"
                  disabled={item.products.stock <= 0}
                  onClick={() =>
                    add({
                      productId: item.products!.id,
                      name: item.products!.name,
                      slug: item.products!.slug,
                      unitPrice: Number(item.products!.price_kes),
                      unit: item.products!.unit,
                      imageUrl: item.products!.image_url,
                    })
                  }
                >
                  Add to cart
                </Button>
                <Button
                  className="min-h-11 w-full sm:w-auto"
                  variant="ghost"
                  onClick={() => remove(item.id)}
                >
                  <Trash2 className="size-4 text-destructive" /> Remove
                </Button>
              </div>
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

function RewardsTab({ userId }: { userId: string }) {
  const { profile } = useAccount();
  const settings = useQuery(loyaltySettingsQuery());
  const history = useQuery(loyaltyHistoryQuery(userId));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-6 text-center">
          <Star className="mx-auto size-6 text-accent" />
          <p className="mt-2 text-2xl font-bold">{profile?.loyalty_points ?? 0}</p>
          <p className="text-xs text-muted-foreground">Points balance</p>
        </div>
        <div className="panel p-6 text-center">
          <p className="mt-2 text-2xl font-bold">{tierLabel(profile?.tier)}</p>
          <p className="text-xs text-muted-foreground">Current tier</p>
        </div>
        <div className="panel p-6 text-center">
          <p className="mt-2 text-2xl font-bold">
            {formatKes(
              (profile?.loyalty_points ?? 0) * Number(settings.data?.point_value_kes ?? 1),
            )}
          </p>
          <p className="text-xs text-muted-foreground">Redeemable value</p>
        </div>
      </div>

      <div className="panel p-6 text-sm text-muted-foreground">
        Earn 1 point for every {formatKes(settings.data?.kes_per_point ?? 100)} spent. Silver tier
        from {settings.data?.silver_threshold ?? 500} points, Gold tier from{" "}
        {settings.data?.gold_threshold ?? 2000} points. Redeem up to{" "}
        {settings.data?.max_redeem_percent ?? 20}% of an order with points at checkout.
      </div>

      <div className="panel overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Points history</h2>
        </div>
        <ul className="divide-y divide-border">
          {(history.data ?? []).map((entry) => (
            <li key={entry.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p>{entry.note ?? entry.kind}</p>
                <p className="text-xs text-muted-foreground">{formatDate(entry.created_at)}</p>
              </div>
              <span
                className={
                  entry.points >= 0
                    ? "font-semibold text-success"
                    : "font-semibold text-destructive"
                }
              >
                {entry.points >= 0 ? "+" : ""}
                {entry.points}
              </span>
            </li>
          ))}
          {!history.isLoading && (history.data ?? []).length === 0 ? (
            <li className="px-5 py-6 text-center text-sm text-muted-foreground">
              No points activity yet.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
