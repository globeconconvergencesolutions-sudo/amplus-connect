import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Loader2, MapPin, Package, Plus, Star, Trash2 } from "lucide-react";
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
import { useAccount } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { addressesQuery, loyaltyHistoryQuery, ordersQuery, wishlistQuery } from "@/lib/account";
import { loyaltySettingsQuery } from "@/lib/catalog";
import { formatDate, formatKes, ORDER_STATUS_LABELS, tierLabel } from "@/lib/format";
import { useCart } from "@/lib/cart";

const TABS = ["profile", "orders", "addresses", "wishlist", "rewards"] as const;

export const Route = createFileRoute("/account/")({
  validateSearch: z.object({ tab: z.enum(TABS).optional() }),
  component: AccountPage,
});

function AccountPage() {
  const { user, profile, loading, isStaff } = useAccount();
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
        {isStaff ? (
          <div className="mb-6 flex items-center justify-between rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
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
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-secondary/60 p-1">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
            <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <ProfileTab userId={user.id} />
          </TabsContent>
          <TabsContent value="orders" className="mt-6">
            <OrdersTab userId={user.id} />
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

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={onSave} className="panel space-y-4 p-6">
        <h2 className="text-lg">Profile details</h2>
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
        <Button type="submit" variant="accent" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>

      <div className="panel space-y-4 p-6">
        <h2 className="text-lg">Account</h2>
        <p className="text-sm text-muted-foreground">
          Tier: <span className="font-semibold text-foreground">{tierLabel(profile?.tier)}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Loyalty points:{" "}
          <span className="font-semibold text-foreground">{profile?.loyalty_points ?? 0}</span>
        </p>
        <Button variant="outline" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}

function OrdersTab({ userId }: { userId: string }) {
  const orders = useQuery(ordersQuery(userId));

  if (orders.isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-secondary" />;
  }

  const list = orders.data ?? [];
  if (list.length === 0) {
    return (
      <div className="panel flex flex-col items-center gap-3 p-12 text-center">
        <Package className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">You haven't placed any orders yet.</p>
        <Button variant="accent" asChild>
          <Link to="/products">Shop materials</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {list.map((order) => (
        <div key={order.id} className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{order.merchant_reference}</p>
              <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
            </div>
            <Badge
              variant={
                order.status === "PAID" || order.status === "DELIVERED" ? "default" : "secondary"
              }
            >
              {ORDER_STATUS_LABELS[order.status] ?? order.status}
            </Badge>
          </div>
          <ul className="mt-4 divide-y divide-border text-sm">
            {(order.order_items ?? []).map(
              (item: {
                id: string;
                product_name: string;
                quantity: number;
                line_total_kes: number;
              }) => (
                <li key={item.id} className="flex justify-between py-2">
                  <span className="text-muted-foreground">
                    {item.product_name} × {item.quantity}
                  </span>
                  <span>{formatKes(item.line_total_kes)}</span>
                </li>
              ),
            )}
          </ul>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>Total</span>
            <span>{formatKes(order.total_kes)}</span>
          </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="recipient_name">Recipient</Label>
                  <Input id="recipient_name" name="recipient_name" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
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

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {(addresses.data ?? []).map((address) => (
          <div key={address.id} className="panel p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 font-semibold">
                  <MapPin className="size-4 text-accent" /> {address.label || "Address"}
                  {address.is_default ? <Badge className="ml-1">Default</Badge> : null}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {address.recipient_name} · {address.phone}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[address.street, address.town, address.county].filter(Boolean).join(", ")}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(address.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
            {!address.is_default ? (
              <Button
                variant="link"
                size="sm"
                className="mt-2 h-auto p-0"
                onClick={() => setDefault(address.id)}
              >
                Set as default
              </Button>
            ) : null}
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) =>
        item.products ? (
          <div key={item.id} className="panel flex flex-col p-4">
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
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
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
              <Button size="sm" variant="ghost" onClick={() => remove(item.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
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
