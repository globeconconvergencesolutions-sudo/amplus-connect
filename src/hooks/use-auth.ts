import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery, rolesQuery } from "@/lib/account";
import { CART_STORAGE_KEY, useCart } from "@/lib/cart";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

/**
 * Signs the current user out on this device and returns them to the home page.
 * A full page load (not client navigation) guarantees no cached profile, order
 * or admin data from the previous session survives in React Query. The cart is
 * cleared too so the next person on a shared device doesn't inherit it.
 */
export function useSignOut() {
  const { clear } = useCart();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      setSigningOut(false);
      toast.error("Couldn't sign you out. Check your connection and try again.");
      return;
    }
    clear();
    window.localStorage.removeItem(CART_STORAGE_KEY);
    window.location.assign("/");
  }, [clear]);

  return { signOut, signingOut };
}

let endingNonStaff = false;

/** Signs out a customer session. Staff sign-in is the only account the shop keeps. */
export async function endNonStaffSession() {
  if (endingNonStaff) return;
  endingNonStaff = true;
  const { error } = await supabase.auth.signOut({ scope: "local" });
  endingNonStaff = false;
  if (error) {
    toast.error("Could not sign out. Refresh and try again.");
    return;
  }
  toast.error("This sign-in is for staff.");
}

export function useAccount() {
  const { session, user, loading: sessionLoading } = useSession();
  const profile = useQuery(profileQuery(user?.id));
  const roles = useQuery(rolesQuery(user?.id));
  // A disabled roles query is not "loaded". Wait until this user id has succeeded or failed.
  const rolesPending = Boolean(user) && !roles.isSuccess && !roles.isError;

  return {
    session,
    user,
    loading: sessionLoading || rolesPending,
    rolesError: Boolean(user) && roles.isError,
    profile: profile.data ?? null,
    roles: roles.data ?? [],
    isStaff: (roles.data ?? []).length > 0,
    hasRole: (...wanted: string[]) => (roles.data ?? []).some((role) => wanted.includes(role)),
  };
}
