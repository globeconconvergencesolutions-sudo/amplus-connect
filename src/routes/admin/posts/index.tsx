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
import { formatDate } from "@/lib/format";

type PostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  category: string | null;
  tags: string[] | null;
  image_url: string | null;
  author: string | null;
  is_published: boolean;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export const Route = createFileRoute("/admin/posts/")({
  component: AdminPostsPage,
});

function useAllPosts() {
  return useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as PostRow[];
    },
  });
}

function AdminPostsPage() {
  const posts = useAllPosts();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<PostRow | "new" | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
    queryClient.invalidateQueries({ queryKey: ["posts"] });
  }

  async function togglePublished(post: PostRow) {
    const nextPublished = !post.is_published;
    const { error } = await supabase
      .from("posts")
      .update({
        is_published: nextPublished,
        published_at: nextPublished
          ? (post.published_at ?? new Date().toISOString())
          : post.published_at,
      })
      .eq("id", post.id);
    if (error) toast.error(error.message);
    else invalidate();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Article deleted");
      invalidate();
    }
  }

  return (
    <AdminShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">{posts.data?.length ?? 0} articles</p>
        </div>
        <Button variant="accent" onClick={() => setEditing("new")}>
          <Plus /> New article
        </Button>
      </div>

      <div className="mt-6 grid gap-3">
        {(posts.data ?? []).map((post) => (
          <div key={post.id} className="panel flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium">{post.title}</p>
                {!post.is_published ? <Badge variant="secondary">Draft</Badge> : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {post.category} · {formatDate(post.published_at) || "Unpublished"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Switch checked={post.is_published} onCheckedChange={() => togglePublished(post)} />
              <Button variant="ghost" size="icon" onClick={() => setEditing(post)}>
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
                    <AlertDialogTitle>Delete {post.title}?</AlertDialogTitle>
                    <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(post.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
        {!posts.isLoading && (posts.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No articles yet.</p>
        ) : null}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New article" : "Edit article"}</DialogTitle>
          </DialogHeader>
          {editing !== null ? (
            <PostForm
              post={editing === "new" ? null : editing}
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

function PostForm({ post, onSaved }: { post: PostRow | null; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [imageUrl, setImageUrl] = useState<string | null>(post?.image_url ?? null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const isPublished = form.get("is_published") === "on";
    const tagsRaw = String(form.get("tags") ?? "");
    const payload = {
      title: String(form.get("title") ?? "").trim(),
      slug: String(form.get("slug") ?? "").trim(),
      excerpt: String(form.get("excerpt") ?? "").trim() || null,
      body: String(form.get("body") ?? "").trim() || null,
      category: String(form.get("category") ?? "").trim() || null,
      tags: tagsRaw
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      image_url: imageUrl,
      author: String(form.get("author") ?? "").trim() || null,
      is_published: isPublished,
      published_at: isPublished ? (post?.published_at ?? new Date().toISOString()) : null,
      seo_title: String(form.get("seo_title") ?? "").trim() || null,
      seo_description: String(form.get("seo_description") ?? "").trim() || null,
    };
    if (!payload.title || !payload.slug) {
      toast.error("Title and slug are required.");
      return;
    }

    setSaving(true);
    const { error } = post
      ? await supabase.from("posts").update(payload).eq("id", post.id)
      : await supabase.from("posts").insert(payload);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(post ? "Article updated" : "Article created");
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
        <Label htmlFor="excerpt">Excerpt</Label>
        <Input id="excerpt" name="excerpt" defaultValue={post?.excerpt ?? ""} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body">Body</Label>
        <Textarea id="body" name="body" rows={8} defaultValue={post?.body ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" defaultValue={post?.category ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" name="tags" defaultValue={(post?.tags ?? []).join(", ")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="author">Author</Label>
          <Input id="author" name="author" defaultValue={post?.author ?? ""} />
        </div>
      </div>
      <ImageField label="Cover image" folder="posts" value={imageUrl} onChange={setImageUrl} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="seo_title">SEO title</Label>
          <Input id="seo_title" name="seo_title" defaultValue={post?.seo_title ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="seo_description">SEO description</Label>
          <Input
            id="seo_description"
            name="seo_description"
            defaultValue={post?.seo_description ?? ""}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch name="is_published" defaultChecked={post?.is_published ?? false} /> Published
      </label>
      <Button type="submit" variant="accent" size="lg" disabled={saving}>
        {saving ? "Saving…" : post ? "Save changes" : "Create article"}
      </Button>
    </form>
  );
}
