import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  specifications: Record<string, string> | null;
  price_kes: number;
  stock: number;
  unit: string;
  brand: string | null;
  image_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  category_id: string | null;
  seo_description: string | null;
};

export type Category = { id: string; name: string; slug: string; description: string | null };

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
      return unwrap<Product[]>(await query);
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

export type Service = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  icon: string | null;
  seo_description: string | null;
};

export const servicesQuery = () =>
  queryOptions({
    queryKey: ["services"],
    queryFn: async () =>
      unwrap<Service[]>(
        await supabase
          .from("services")
          .select("id, title, slug, summary, description, icon, seo_description")
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
      const { data, error } = await supabase.from("posts").select("*").eq("slug", slug).maybeSingle();
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
