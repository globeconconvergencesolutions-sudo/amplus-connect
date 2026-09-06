import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  loyalty_points: number;
  tier: string;
};

export const profileQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as Profile | null;
    },
  });

export const rolesQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["roles", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId!);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => row.role as string);
    },
  });

export const ordersQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["orders", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*), payments(*)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const addressesQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["addresses", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const wishlistQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["wishlist", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("id, product_id, products(*)")
        .eq("user_id", userId!);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

export const loyaltyHistoryQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["loyalty-history", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_transactions")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
