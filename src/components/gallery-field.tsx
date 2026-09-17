import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageField } from "@/components/image-field";
import type { GalleryItem, MediaFolder } from "@/lib/media";

export function GalleryField({
  folder,
  items,
  onChange,
}: {
  folder: MediaFolder;
  items: GalleryItem[];
  onChange: (items: GalleryItem[]) => void;
}) {
  function setUrl(index: number, url: string | null) {
    if (!url) {
      onChange(items.filter((_, i) => i !== index));
      return;
    }
    onChange(items.map((item, i) => (i === index ? { ...item, url } : item)));
  }

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= items.length) return;
    const copy = [...items];
    const [removed] = copy.splice(index, 1);
    copy.splice(next, 0, removed!);
    onChange(copy);
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Gallery</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, { url: "" }])}
        >
          <Plus className="size-4" /> Add photo
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Optional extra photos. The cover image is separate, above.
        </p>
      ) : null}
      {items.map((item, index) => (
        <div key={`${item.url}-${index}`} className="rounded-md border border-border p-3">
          <ImageField
            label={`Photo ${index + 1}`}
            folder={folder}
            value={item.url || null}
            onChange={(url) => setUrl(index, url)}
          />
          <div className="mt-2 flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => move(index, -1)}>
              <ArrowUp className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => move(index, 1)}>
              <ArrowDown className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
