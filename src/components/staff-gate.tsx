import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { useAccount } from "@/hooks/use-auth";

/** Cart, checkout, and account stay in the app. Only staff get past this gate. */
export function StaffGate({ children }: { children: ReactNode }) {
  const { user, isStaff, loading, rolesError } = useAccount();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || rolesError) return;
    if (!user || !isStaff) {
      void navigate({ to: "/", replace: true });
    }
  }, [loading, rolesError, user, isStaff, navigate]);

  if (rolesError) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-xl">Could not confirm staff access</h1>
          <p className="mt-2 text-sm text-muted-foreground">Refresh the page and try again.</p>
        </div>
      </PageShell>
    );
  }

  if (loading || !user || !isStaff) {
    return (
      <PageShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  return children;
}
