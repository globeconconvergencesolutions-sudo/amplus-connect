import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery, rolesQuery } from "@/lib/account";

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

export function useAccount() {
  const { session, user, loading } = useSession();
  const profile = useQuery(profileQuery(user?.id));
  const roles = useQuery(rolesQuery(user?.id));

  return {
    session,
    user,
    loading,
    profile: profile.data ?? null,
    roles: roles.data ?? [],
    isStaff: (roles.data ?? []).length > 0,
    hasRole: (...wanted: string[]) => (roles.data ?? []).some((role) => wanted.includes(role)),
  };
}
