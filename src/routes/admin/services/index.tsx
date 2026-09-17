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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { ImageField } from "@/components/image-field";
import { slugify } from "@/lib/admin-utils";

type ServiceRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  sort_order: number;
  is_published: boolean;
  seo_title: string | null;
  seo_description: string | null;
};

export const Route = createFileRoute("/admin/services/")({
  component: AdminServicesPage,
});

function useAllServices() {
  return useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("sort_order");
      if (error) throw new Error(error.message);
      return (data ?? []) as ServiceRow[];
    },
  });
}

function AdminServicesPage() {
  const services = useAllServices();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-services"] });
    queryClient.invalidateQueries({ queryKey: ["services"] });
  }

  async function togglePublished(service: ServiceRow) {
    const { error } = await supabase
      .from("services")
      .update({ is_published: !service.is_published })
      .eq("id", service.id);
    if (error) toast.error(error.message);
    else invalidate();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Service deleted");
      invalidate();
    }
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {services.data?.length ?? 0} services
          </p>
        </div>
        <Button variant="accent" onClick={() => setEditing("new")}>
          <Plus /> New service
        </Button>
      </div>

      <div className="mt-6 grid gap-3">
        {(services.data ?? []).map((service) => (
          <div key={service.id} className="panel flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{service.title}</p>
                {!service.is_published ? <Badge variant="secondary">Draft</Badge> : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">{service.summary}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Switch
                checked={service.is_published}
                onCheckedChange={() => togglePublished(service)}
              />
              <Button variant="ghost" size="icon" onClick={() => setEditing(service)}>
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
                    <AlertDialogTitle>Delete {service.title}?</AlertDialogTitle>
                    <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(service.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
        {!services.isLoading && (services.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No services yet.</p>
        ) : null}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New service" : "Edit service"}</DialogTitle>
          </DialogHeader>
          {editing !== null ? (
            <ServiceForm
              service={editing === "new" ? null : editing}
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

function ServiceForm({ service, onSaved }: { service: ServiceRow | null; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(service?.title ?? "");
  const [slug, setSlug] = useState(service?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(service));
  const [imageUrl, setImageUrl] = useState<string | null>(service?.image_url ?? null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") ?? "").trim(),
      slug: String(form.get("slug") ?? "").trim(),
      summary: String(form.get("summary") ?? "").trim() || null,
      description: String(form.get("description") ?? "").trim() || null,
      image_url: imageUrl,
      icon: String(form.get("icon") ?? "").trim() || null,
      sort_order: Number(form.get("sort_order") ?? 0),
      is_published: form.get("is_published") === "on",
      seo_title: String(form.get("seo_title") ?? "").trim() || null,
      seo_description: String(form.get("seo_description") ?? "").trim() || null,
    };
    if (!payload.title || !payload.slug) {
      toast.error("Title and slug are required.");
      return;
    }

    setSaving(true);
    const { error } = service
      ? await supabase.from("services").update(payload).eq("id", service.id)
      : await supabase.from("services").insert(payload);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(service ? "Service updated" : "Service created");
    onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
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
        <Label htmlFor="summary">Summary</Label>
        <Input id="summary" name="summary" defaultValue={service?.summary ?? ""} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={service?.description ?? ""}
        />
      </div>
      <ImageField label="Cover image" folder="services" value={imageUrl} onChange={setImageUrl} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="icon">Icon (lucide name, optional)</Label>
          <Input
            id="icon"
            name="icon"
            placeholder="building, road, compass…"
            defaultValue={service?.icon ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sort_order">Sort order</Label>
          <Input
            id="sort_order"
            name="sort_order"
            type="number"
            defaultValue={service?.sort_order ?? 0}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="seo_title">SEO title</Label>
          <Input id="seo_title" name="seo_title" defaultValue={service?.seo_title ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="seo_description">SEO description</Label>
          <Input
            id="seo_description"
            name="seo_description"
            defaultValue={service?.seo_description ?? ""}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch name="is_published" defaultChecked={service?.is_published ?? true} /> Published
      </label>
      <Button type="submit" variant="accent" size="lg" disabled={saving}>
        {saving ? "Saving…" : service ? "Save changes" : "Create service"}
      </Button>
    </form>
  );
}
