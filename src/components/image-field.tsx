import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { storageObjectPath, validateImageFile, type MediaFolder } from "@/lib/media";

type ImageFieldProps = {
  label: string;
  folder: MediaFolder;
  value: string | null;
  onChange: (url: string | null) => void;
};

export function ImageField({ label, folder, value, onChange }: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setUploading(true);
    const path = storageObjectPath(folder, file);
    const { error } = await supabase.storage.from("media").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      setUploading(false);
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  }

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-input bg-secondary/50"
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : uploading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : (
            <ImagePlus className="size-6 text-muted-foreground" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {value ? "Replace image" : "Upload image"}
            </Button>
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(null)}
              >
                <Trash2 className="size-4" /> Remove
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowUrl((open) => !open)}>
              {showUrl ? "Hide URL" : "Paste URL"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF. Max 5 MB.</p>
        </div>
      </div>
      {showUrl ? (
        <Input
          value={value ?? ""}
          placeholder="https://…"
          onChange={(event) => onChange(event.target.value.trim() || null)}
        />
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
