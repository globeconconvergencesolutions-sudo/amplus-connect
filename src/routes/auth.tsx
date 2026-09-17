import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-auth";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAccount();
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: redirect ?? "/account" });
    }
  }, [loading, user, redirect, navigate]);

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
    navigate({ to: redirect ?? "/account" });
  }

  async function onSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("full_name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo: window.location.origin,
      },
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. You can now sign in.");
    setMode("signin");
  }

  async function onForgotPassword(email: string) {
    if (!email) {
      toast.error("Enter your email above first, then click 'Forgot password'.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-16">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="surface-amber flex size-9 items-center justify-center rounded-sm font-display text-lg font-extrabold">
            A
          </span>
          <span className="leading-none">
            <span className="block font-display text-lg font-extrabold tracking-tight">AMPLUS</span>
            <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {COMPANY.shortName === "Amplus" ? "Construction Solutions" : COMPANY.shortName}
            </span>
          </span>
        </Link>

        <div className="panel p-6 sm:p-8">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={onSignIn} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <button
                      type="button"
                      className="text-xs font-medium text-accent hover:underline"
                      onClick={(e) => {
                        const form = e.currentTarget.closest("form");
                        const email =
                          (form?.elements.namedItem("email") as HTMLInputElement | null)?.value ??
                          "";
                        onForgotPassword(email);
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
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={onSignUp} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="signup-name">Full name</Label>
                  <Input id="signup-name" name="full_name" required autoComplete="name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signup-phone">Phone</Label>
                  <Input id="signup-phone" name="phone" type="tel" autoComplete="tel" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={6}
                  />
                </div>
                <Button type="submit" variant="accent" size="lg" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" /> : null} Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
