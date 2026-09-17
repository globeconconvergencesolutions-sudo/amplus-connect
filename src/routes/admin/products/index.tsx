import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, type Product } from "@/lib/catalog";
import { formatKes } from "@/lib/format";
import { ImageField } from "@/components/image-field";
import { GalleryField } from "@/components/gallery-field";
import { parseGallery, coverUrl } from "@/lib/media";
import { slugify } from "@/lib/admin-utils";

export const Route = createFileRoute("/admin/products/")({
  component: AdminProductsPage,
});

function useAllProducts() {
  return useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw new Error(error.message);
      return (data ?? []) as Product[];
    },
  });
}

function specsToText(specs: unknown): string {
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) return "";
  return Object.entries(specs as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function textToSpecs(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function AdminProductsPage() {
  const products = useAllProducts();
  const categories = useQuery(categoriesQuery());
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const list = products.data ?? [];
    if (categoryFilter === "all") return list;
    return list.filter((p) => p.category_id === categoryFilter);
  }, [products.data, categoryFilter]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  async function toggle(product: Product, field: "is_active" | "is_featured") {
    const payload =
      field === "is_active"
        ? { is_active: !product.is_active }
        : { is_featured: !product.is_featured };
    const { error } = await supabase.from("products").update(payload).eq("id", product.id);
    if (error) toast.error(error.message);
    else invalidate();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Product deleted");
      invalidate();
    }
  }

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} of {products.data?.length ?? 0} products
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories.data ?? []).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="accent" onClick={() => setEditing("new")}>
            <Plus /> New product
          </Button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Featured</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((product) => (
              <tr key={product.id} className="align-middle">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-secondary">
                      {coverUrl(product.image_url, product.gallery) ? (
                        <img
                          src={coverUrl(product.image_url, product.gallery)!}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{product.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{formatKes(product.price_kes)}</td>
                <td className="px-4 py-3">
                  <span className={product.stock <= 0 ? "text-destructive" : ""}>
                    {product.stock}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Switch
                    checked={product.is_active}
                    onCheckedChange={() => toggle(product, "is_active")}
                  />
                </td>
                <td className="px-4 py-3">
                  <Switch
                    checked={product.is_featured}
                    onCheckedChange={() => toggle(product, "is_featured")}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(product)}>
                      <Pencil className="size-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This can't be undone. The product will be removed from the catalogue.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(product.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            ))}
            {!products.isLoading && filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No products found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing === "new" ? "New product" : `Edit ${(editing as Product)?.name ?? ""}`}
            </DialogTitle>
          </DialogHeader>
          {editing !== null ? (
            <ProductForm
              product={editing === "new" ? null : editing}
              categories={categories.data ?? []}
              onSaved={() => {
                setEditing(null);
                invalidate();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function ProductForm({
  product,
  categories,
  onSaved,
}: {
  product: Product | null;
  categories: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null);
  const [gallery, setGallery] = useState(parseGallery(product?.gallery));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      slug: String(form.get("slug") ?? "").trim(),
      short_description: String(form.get("short_description") ?? "").trim() || null,
      description: String(form.get("description") ?? "").trim() || null,
      price_kes: Number(form.get("price_kes") ?? 0),
      stock: Number(form.get("stock") ?? 0),
      unit: String(form.get("unit") ?? "unit").trim() || "unit",
      brand: String(form.get("brand") ?? "").trim() || null,
      category_id: (String(form.get("category_id") ?? "") || null) as string | null,
      image_url: imageUrl,
      gallery: gallery.filter((item) => item.url),
      is_featured: form.get("is_featured") === "on",
      is_active: form.get("is_active") === "on",
      seo_title: String(form.get("seo_title") ?? "").trim() || null,
      seo_description: String(form.get("seo_description") ?? "").trim() || null,
      specifications: textToSpecs(String(form.get("specifications") ?? "")),
    };

    if (!payload.name || !payload.slug) {
      toast.error("Name and slug are required.");
      return;
    }

    setSaving(true);
    const { error } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(product ? "Product updated" : "Product created");
    onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            name="slug"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="short_description">Short description</Label>
        <Input
          id="short_description"
          name="short_description"
          defaultValue={product?.short_description ?? ""}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={product?.description ?? ""}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="price_kes">Price (KES)</Label>
          <Input
            id="price_kes"
            name="price_kes"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={product?.price_kes ?? 0}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="stock">Stock</Label>
          <Input
            id="stock"
            name="stock"
            type="number"
            min="0"
            required
            defaultValue={product?.stock ?? 0}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="unit">Unit</Label>
          <Input id="unit" name="unit" defaultValue={product?.unit ?? "unit"} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="brand">Brand</Label>
          <Input id="brand" name="brand" defaultValue={product?.brand ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="category_id">Category</Label>
          <select
            id="category_id"
            name="category_id"
            defaultValue={product?.category_id ?? ""}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ImageField label="Cover image" folder="products" value={imageUrl} onChange={setImageUrl} />
      <GalleryField folder="products" items={gallery} onChange={setGallery} />

      <div className="grid gap-2">
        <Label htmlFor="specifications">Specifications (one per line, "Key: Value")</Label>
        <Textarea
          id="specifications"
          name="specifications"
          rows={4}
          placeholder={"Grade: 32.5N\nWeight: 50 kg"}
          defaultValue={specsToText(product?.specifications)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="seo_title">SEO title</Label>
          <Input id="seo_title" name="seo_title" defaultValue={product?.seo_title ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="seo_description">SEO description</Label>
          <Input
            id="seo_description"
            name="seo_description"
            defaultValue={product?.seo_description ?? ""}
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch name="is_active" defaultChecked={product?.is_active ?? true} /> Active
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch name="is_featured" defaultChecked={product?.is_featured ?? false} /> Featured
        </label>
      </div>

      <Button type="submit" variant="accent" size="lg" disabled={saving}>
        {saving ? "Saving…" : product ? "Save changes" : "Create product"}
      </Button>
    </form>
  );
}
