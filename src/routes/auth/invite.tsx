import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { acceptStaffInvite, previewStaffInvite } from "@/lib/staff-invite.functions";

export const Route = createFileRoute("/auth/invite")({
  validateSearch: z.object({
    token: z.string().optional(),
  }),
  component: AcceptInvitePage,
});

function roleLabel(role: string) {
  return role.replaceAll("_", " ");
}

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const preview = useQuery({
    queryKey: ["staff-invite-preview", token],
    enabled: Boolean(token && token.length >= 20),
    retry: false,
    queryFn: async () => previewStaffInvite({ data: { token: token! } }),
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("full_name") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (fullName.length < 2) {
      toast.error("Enter your full name.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await acceptStaffInvite({
        data: { token, password, fullName },
      });
      const { error } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });
      if (error) {
        toast.success("Password set. Sign in to continue.");
        navigate({ to: "/auth", search: { redirect: "/admin" } });
        return;
      }
      toast.success("Welcome to Amplus admin");
      navigate({ to: "/admin" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not accept this invite.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(196,92,38,0.12),_transparent_55%),linear-gradient(180deg,#f5f1eb_0%,#ebe4da_100%)]"
      />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center">
          <BrandLogo variant="auth" />
        </Link>

        <div className="panel p-6 sm:p-8">
          {!token || token.length < 20 ? (
            <InviteState
              title="Invite link missing"
              body="Open the link from your Amplus staff email, or ask a super admin to resend the invite."
            />
          ) : preview.isLoading ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              <p className="text-sm">Checking your invite…</p>
            </div>
          ) : preview.isError ? (
            <InviteState
              title="Could not verify invite"
              body={
                preview.error instanceof Error
                  ? preview.error.message
                  : "Something went wrong. Try again or ask a super admin to resend."
              }
            />
          ) : !preview.data?.ok ? (
            <InviteState
              title={
                preview.data?.reason === "expired"
                  ? "Invite expired"
                  : preview.data?.reason === "revoked"
                    ? "Invite revoked"
                    : preview.data?.reason === "accepted"
                      ? "Invite already used"
                      : "Invite not valid"
              }
              body={
                preview.data?.reason === "expired"
                  ? "Ask a super admin to resend your invite from Admin → Roles."
                  : preview.data?.reason === "revoked"
                    ? "This invitation was cancelled. Ask a super admin if you still need access."
                    : preview.data?.reason === "accepted"
                      ? "You already set a password. Sign in to open the admin console."
                      : "This link is invalid or incomplete. Request a fresh invite."
              }
              showSignIn={preview.data?.reason === "accepted"}
            />
          ) : (
            <>
              <div className="mb-6 flex items-start gap-3">
                <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Staff invitation
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight">Set your password</h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {preview.data.email} · {roleLabel(preview.data.role)}
                  </p>
                </div>
              </div>

              <form onSubmit={onSubmit} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="invite-name">Full name</Label>
                  <Input
                    id="invite-name"
                    name="full_name"
                    required
                    autoComplete="name"
                    defaultValue={preview.data.fullName ?? ""}
                    placeholder="Your name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invite-password">Password</Label>
                  <Input
                    id="invite-password"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invite-confirm">Confirm password</Label>
                  <Input
                    id="invite-confirm"
                    name="confirm"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
                <Button type="submit" variant="accent" size="lg" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" /> : null}
                  Join Amplus admin
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/auth" search={{ redirect: "/admin" }} className="hover:text-foreground">
            Already have a password? Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function InviteState({
  title,
  body,
  showSignIn,
}: {
  title: string;
  body: string;
  showSignIn?: boolean;
}) {
  return (
    <div className="space-y-4 py-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
      {showSignIn ? (
        <Button variant="accent" asChild>
          <Link to="/auth" search={{ redirect: "/admin" }}>
            Sign in
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
