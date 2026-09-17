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
import { GalleryField } from "@/components/gallery-field";
import { parseGallery } from "@/lib/media";
import { slugify } from "@/lib/admin-utils";
import { formatDate } from "@/lib/format";

type ProjectRow = {
  id: string;
  title: string;
  slug: string;
  sector: string | null;
  location: string | null;
  client: string | null;
  summary: string | null;
  description: string | null;
  image_url: string | null;
  gallery: unknown;
  completed_on: string | null;
  is_featured: boolean;
  is_published: boolean;
  seo_title: string | null;
  seo_description: string | null;
};

export const Route = createFileRoute("/admin/projects/")({
  component: AdminProjectsPage,
});

function useAllProjects() {
  return useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("completed_on", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as ProjectRow[];
    },
  });
}

function AdminProjectsPage() {
  const projects = useAllProjects();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProjectRow | "new" | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  async function togglePublished(project: ProjectRow) {
    const { error } = await supabase
      .from("projects")
      .update({ is_published: !project.is_published })
      .eq("id", project.id);
    if (error) toast.error(error.message);
    else invalidate();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Project deleted");
      invalidate();
    }
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projects.data?.length ?? 0} projects
          </p>
        </div>
        <Button variant="accent" onClick={() => setEditing("new")}>
          <Plus /> New project
        </Button>
      </div>

      <div className="mt-6 grid gap-3">
        {(projects.data ?? []).map((project) => (
          <div key={project.id} className="panel flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium">{project.title}</p>
                {project.is_featured ? (
                  <Badge className="bg-accent text-accent-foreground">Featured</Badge>
                ) : null}
                {!project.is_published ? <Badge variant="secondary">Draft</Badge> : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {project.sector} · {project.location} · {formatDate(project.completed_on)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Switch
                checked={project.is_published}
                onCheckedChange={() => togglePublished(project)}
              />
              <Button variant="ghost" size="icon" onClick={() => setEditing(project)}>
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
                    <AlertDialogTitle>Delete {project.title}?</AlertDialogTitle>
                    <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(project.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
        {!projects.isLoading && (projects.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No projects yet.</p>
        ) : null}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New project" : "Edit project"}</DialogTitle>
          </DialogHeader>
          {editing !== null ? (
            <ProjectForm
              project={editing === "new" ? null : editing}
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

function ProjectForm({ project, onSaved }: { project: ProjectRow | null; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(project?.title ?? "");
  const [slug, setSlug] = useState(project?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(project));
  const [imageUrl, setImageUrl] = useState<string | null>(project?.image_url ?? null);
  const [gallery, setGallery] = useState(parseGallery(project?.gallery));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") ?? "").trim(),
      slug: String(form.get("slug") ?? "").trim(),
      sector: String(form.get("sector") ?? "").trim() || null,
      location: String(form.get("location") ?? "").trim() || null,
      client: String(form.get("client") ?? "").trim() || null,
      summary: String(form.get("summary") ?? "").trim() || null,
      description: String(form.get("description") ?? "").trim() || null,
      image_url: imageUrl,
      gallery: gallery.filter((item) => item.url),
      completed_on: String(form.get("completed_on") ?? "") || null,
      is_featured: form.get("is_featured") === "on",
      is_published: form.get("is_published") === "on",
      seo_title: String(form.get("seo_title") ?? "").trim() || null,
      seo_description: String(form.get("seo_description") ?? "").trim() || null,
    };
    if (!payload.title || !payload.slug) {
      toast.error("Title and slug are required.");
      return;
    }

    setSaving(true);
    const { error } = project
      ? await supabase.from("projects").update(payload).eq("id", project.id)
      : await supabase.from("projects").insert(payload);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(project ? "Project updated" : "Project created");
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
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="sector">Sector</Label>
          <Input
            id="sector"
            name="sector"
            placeholder="Commercial, Residential…"
            defaultValue={project?.sector ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={project?.location ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="client">Client</Label>
          <Input id="client" name="client" defaultValue={project?.client ?? ""} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="summary">Summary</Label>
        <Input id="summary" name="summary" defaultValue={project?.summary ?? ""} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={project?.description ?? ""}
        />
      </div>
      <ImageField label="Cover image" folder="projects" value={imageUrl} onChange={setImageUrl} />
      <GalleryField folder="projects" items={gallery} onChange={setGallery} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="completed_on">Completed on</Label>
          <Input
            id="completed_on"
            name="completed_on"
            type="date"
            defaultValue={project?.completed_on ?? ""}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="seo_title">SEO title</Label>
          <Input id="seo_title" name="seo_title" defaultValue={project?.seo_title ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="seo_description">SEO description</Label>
          <Input
            id="seo_description"
            name="seo_description"
            defaultValue={project?.seo_description ?? ""}
          />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch name="is_published" defaultChecked={project?.is_published ?? true} /> Published
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch name="is_featured" defaultChecked={project?.is_featured ?? false} /> Featured
        </label>
      </div>
      <Button type="submit" variant="accent" size="lg" disabled={saving}>
        {saving ? "Saving…" : project ? "Save changes" : "Create project"}
      </Button>
    </form>
  );
}
