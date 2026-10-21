import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { endNonStaffSession, useAccount } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { staffNextPath } from "@/lib/staff-path";

/**
 * Staff sign-in. Public registration stays out of this form.
 * A signed-in staff member is sent to `next`. Anyone else is signed out.
 */
export function StaffSignIn({ next = "/admin" }: { next?: string }) {
  const { user, isStaff, loading, rolesError } = useAccount();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const settling = useRef(false);
  const destination = staffNextPath(next);

  useEffect(() => {
    if (!user) {
      settling.current = false;
      return;
    }
    if (loading || rolesError || settling.current) return;
    settling.current = true;
    if (!isStaff) {
      void endNonStaffSession().then(() => {
        void navigate({ to: "/" });
      });
      return;
    }
    void navigate({ href: destination });
  }, [loading, user, isStaff, rolesError, destination, navigate]);

  async function onSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
  }

  async function onForgotPassword(email: string) {
    if (!email) {
      toast.error("Enter your email above first, then click Forgot password.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent.");
  }

  if (rolesError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
        <div className="panel max-w-md p-8 text-center">
          <h1 className="text-xl">Could not confirm staff access</h1>
          <p className="mt-2 text-sm text-muted-foreground">Refresh the page and try again.</p>
        </div>
      </div>
    );
  }

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/40">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-16">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center">
          <BrandLogo variant="auth" />
        </Link>

        <div className="panel p-6 sm:p-8">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent">
            Staff access
          </p>
          <h1 className="mt-2 text-2xl tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The shop does not need an account. This sign-in opens the admin portal.
          </p>
          <form onSubmit={onSignIn} className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="signin-email">Email</Label>
              <Input id="signin-email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="signin-password">Password</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-accent hover:underline"
                  onClick={(event) => {
                    const form = event.currentTarget.closest("form");
                    const email =
                      (form?.elements.namedItem("email") as HTMLInputElement | null)?.value ?? "";
                    void onForgotPassword(email);
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="signin-password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" variant="accent" size="lg" disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null} Sign in
            </Button>
          </form>
          {/* Public registration is commented out. Staff are added with an invite.
          <TabsTrigger value="signup">Create account</TabsTrigger>
          */}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Back to the shop
          </Link>
        </p>
      </div>
    </div>
  );
}
