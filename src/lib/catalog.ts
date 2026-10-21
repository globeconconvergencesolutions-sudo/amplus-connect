import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isMissingRelation } from "@/lib/supabase-errors";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export type Product = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  specifications: unknown;
  price_kes: number;
  stock: number;
  unit: string;
  brand: string | null;
  image_url: string | null;
  gallery?: unknown;
  is_featured: boolean;
  is_active: boolean;
  category_id: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export type Category = { id: string; name: string; slug: string; description: string | null };

function specText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(specText).filter(Boolean).join(" ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${key} ${specText(entry)}`)
      .join(" ");
  }
  return "";
}

/** True when every word in the query appears in the product's public copy. */
export function productMatchesQuery(
  product: Product,
  query: string,
  categoryName?: string | null,
): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = [
    product.name,
    product.brand,
    product.unit,
    product.short_description,
    product.description,
    product.seo_title,
    product.seo_description,
    categoryName,
    specText(product.specifications),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

export function filterShopProducts(
  products: Product[],
  categories: Category[],
  search: { q?: string | null; category?: string | null },
): Product[] {
  let list = products;
  const categorySlug = search.category?.trim();
  if (categorySlug) {
    const match = categories.find((row) => row.slug === categorySlug);
    list = match ? list.filter((product) => product.category_id === match.id) : [];
  }
  const q = search.q?.trim() ?? "";
  if (!q) return list;
  const names = new Map(categories.map((row) => [row.id, row.name]));
  return list.filter((product) =>
    productMatchesQuery(product, q, product.category_id ? names.get(product.category_id) : null),
  );
}

export const categoriesQuery = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: async () =>
      unwrap<Category[]>(
        await supabase
          .from("categories")
          .select("id, name, slug, description")
          .order("sort_order", { ascending: true }),
      ),
  });

export const productsQuery = (options?: { featured?: boolean; categoryId?: string | null }) =>
  queryOptions({
    queryKey: ["products", options?.featured ?? false, options?.categoryId ?? null],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (options?.featured) query = query.eq("is_featured", true);
      if (options?.categoryId) query = query.eq("category_id", options.categoryId);
      return unwrap<Product[]>((await query) as never);
    },
  });

export const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as Product | null;
    },
  });

export const relatedProductsQuery = (categoryId: string | null, excludeId: string) =>
  queryOptions({
    queryKey: ["related-products", categoryId, excludeId],
    queryFn: async () => {
      if (!categoryId) return [] as Product[];
      return unwrap<Product[]>(
        await supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .eq("category_id", categoryId)
          .neq("id", excludeId)
          .order("name", { ascending: true })
          .limit(64),
      );
    },
  });

export type Service = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  seo_description: string | null;
};

export const servicesQuery = () =>
  queryOptions({
    queryKey: ["services"],
    queryFn: async () =>
      unwrap<Service[]>(
        await supabase
          .from("services")
          .select("id, title, slug, summary, description, icon, image_url, seo_description")
          .eq("is_published", true)
          .order("sort_order", { ascending: true }),
      ),
  });

export const serviceQuery = (slug: string) =>
  queryOptions({
    queryKey: ["service", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as Service | null;
    },
  });

export type Project = {
  id: string;
  title: string;
  slug: string;
  sector: string | null;
  location: string | null;
  client: string | null;
  summary: string | null;
  description: string | null;
  image_url: string | null;
  gallery?: unknown;
  completed_on: string | null;
  is_featured: boolean;
};

export const projectsQuery = (options?: { featured?: boolean }) =>
  queryOptions({
    queryKey: ["projects", options?.featured ?? false],
    queryFn: async () => {
      let query = supabase
        .from("projects")
        .select("*")
        .eq("is_published", true)
        .order("completed_on", { ascending: false });
      if (options?.featured) query = query.eq("is_featured", true);
      return unwrap<Project[]>(await query);
    },
  });

export const projectQuery = (slug: string) =>
  queryOptions({
    queryKey: ["project", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as Project | null;
    },
  });

export type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  category: string | null;
  tags: string[] | null;
  author: string | null;
  image_url: string | null;
  published_at: string | null;
  seo_description: string | null;
};

export const postsQuery = (limit?: number) =>
  queryOptions({
    queryKey: ["posts", limit ?? null],
    queryFn: async () => {
      let query = supabase
        .from("posts")
        .select("*")
        .eq("is_published", true)
        .order("published_at", { ascending: false });
      if (limit) query = query.limit(limit);
      return unwrap<Post[]>(await query);
    },
  });

export const postQuery = (slug: string) =>
  queryOptions({
    queryKey: ["post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as Post | null;
    },
  });

export type LoyaltySettings = {
  kes_per_point: number;
  point_value_kes: number;
  silver_threshold: number;
  gold_threshold: number;
  max_redeem_percent: number;
};

export const deliverySettingsQuery = () =>
  queryOptions({
    queryKey: ["delivery-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) {
        if (isMissingRelation(error)) return null;
        throw new Error(error.message);
      }
      return data;
    },
  });

export const deliveryBandsQuery = () =>
  queryOptions({
    queryKey: ["delivery-bands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_bands")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) {
        if (isMissingRelation(error)) return [];
        throw new Error(error.message);
      }
      return data ?? [];
    },
  });

export const deliveryDropPointsQuery = (opts?: { staff?: boolean }) =>
  queryOptions({
    queryKey: ["delivery-drop-points", opts?.staff ?? false],
    queryFn: async () => {
      let query = supabase
        .from("delivery_drop_points")
        .select("*")
        .order("sort_order", { ascending: true });
      if (!opts?.staff) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) {
        if (isMissingRelation(error)) return [];
        throw new Error(error.message);
      }
      return data ?? [];
    },
  });

export const loyaltySettingsQuery = () =>
  queryOptions({
    queryKey: ["loyalty-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as LoyaltySettings | null;
    },
  });
