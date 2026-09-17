export type MediaFolder = "products" | "projects" | "services" | "posts" | "site";

export type GalleryItem = {
  url: string;
  alt?: string;
};

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

export function parseGallery(value: unknown): GalleryItem[] {
  if (!Array.isArray(value)) return [];
  const items: GalleryItem[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim()) {
      items.push({ url: entry.trim() });
      continue;
    }
    if (entry && typeof entry === "object" && "url" in entry) {
      const url = (entry as { url?: unknown }).url;
      if (typeof url === "string" && url.trim()) {
        const alt = (entry as { alt?: unknown }).alt;
        const item: GalleryItem = { url: url.trim() };
        if (typeof alt === "string" && alt.trim()) item.alt = alt.trim();
        items.push(item);
      }
    }
  }
  return items;
}

export function coverUrl(imageUrl: string | null | undefined, gallery?: unknown): string | null {
  if (imageUrl?.trim()) return imageUrl.trim();
  return parseGallery(gallery)[0]?.url ?? null;
}

export function productImageUrls(product: {
  image_url: string | null;
  gallery?: unknown;
}): string[] {
  const urls = [
    product.image_url,
    ...parseGallery(product.gallery).map((item) => item.url),
  ].filter((url): url is string => Boolean(url && url.trim()));
  return [...new Set(urls)];
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Use a JPEG, PNG, WebP or GIF image.";
  }
  if (file.size > MAX_BYTES) {
    return "Images must be 5 MB or smaller.";
  }
  return null;
}

export function storageObjectPath(folder: MediaFolder, file: File): string {
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  return `${folder}/${crypto.randomUUID()}.${ext}`;
}
