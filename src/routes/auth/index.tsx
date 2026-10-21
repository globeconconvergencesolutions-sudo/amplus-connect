import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { StaffSignIn } from "@/components/staff-sign-in";
import { staffNextPath } from "@/lib/staff-path";

export const Route = createFileRoute("/auth/")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  return <StaffSignIn next={staffNextPath(redirect)} />;
}

/*
Public registration is commented out. New staff get an invite from the admin
portal (/auth/invite). Restore this only if customers should create accounts again.

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
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, phone }, emailRedirectTo: window.location.origin },
  });
  if (error) toast.error(error.message);
  else toast.success("Account created. You can now sign in.");
}

<TabsTrigger value="signup">Create account</TabsTrigger>
<TabsContent value="signup">
  Full name, phone, email, password, and a "Create account" button.
</TabsContent>
*/
