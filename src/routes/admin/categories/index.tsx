import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { slugify } from "@/lib/admin-utils";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  parent_id: string | null;
};

export const Route = createFileRoute("/admin/categories/")({
  component: AdminCategoriesPage,
});

function useAllCategories() {
  return useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, description, sort_order, parent_id")
        .order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as Category[];
    },
  });
}

function AdminCategoriesPage() {
  const categories = useAllCategories();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Category | "new" | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Category deleted");
      invalidate();
    }
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {categories.data?.length ?? 0} categories
          </p>
        </div>
        <Button variant="accent" onClick={() => setEditing("new")}>
          <Plus /> New category
        </Button>
      </div>

      <div className="mt-6 grid gap-3">
        {(categories.data ?? []).map((category) => (
          <div key={category.id} className="panel flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{category.name}</p>
              <p className="text-xs text-muted-foreground">/{category.slug}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => setEditing(category)}>
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
                    <AlertDialogTitle>Delete {category.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Products in this category will keep their other data but lose this category
                      link.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(category.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
        {!categories.isLoading && (categories.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No categories yet.</p>
        ) : null}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New category" : "Edit category"}</DialogTitle>
          </DialogHeader>
          {editing !== null ? (
            <CategoryForm
              category={editing === "new" ? null : editing}
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

function CategoryForm({
  category,
  categories,
  onSaved,
}: {
  category: Category | null;
  categories: Category[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      slug: String(form.get("slug") ?? "").trim(),
      description: String(form.get("description") ?? "").trim() || null,
      sort_order: Number(form.get("sort_order") ?? 0),
      parent_id: (String(form.get("parent_id") ?? "") || null) as string | null,
    };
    if (!payload.name || !payload.slug) {
      toast.error("Name and slug are required.");
      return;
    }

    setSaving(true);
    const { error } = category
      ? await supabase.from("categories").update(payload).eq("id", category.id)
      : await supabase.from("categories").insert(payload);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(category ? "Category updated" : "Category created");
    onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
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
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={category?.description ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="sort_order">Sort order</Label>
          <Input
            id="sort_order"
            name="sort_order"
            type="number"
            defaultValue={category?.sort_order ?? 0}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="parent_id">Parent category</Label>
          <select
            id="parent_id"
            name="parent_id"
            defaultValue={category?.parent_id ?? ""}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">None</option>
            {categories
              .filter((c) => c.id !== category?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      <Button type="submit" variant="accent" size="lg" disabled={saving}>
        {saving ? "Saving…" : category ? "Save changes" : "Create category"}
      </Button>
    </form>
  );
}
