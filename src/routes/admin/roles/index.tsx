import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Loader2, Mail, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/hooks/use-auth";
import { assignRole, listStaffRoles, revokeRole } from "@/lib/admin.functions";
import { formatDate } from "@/lib/format";
import {
  inviteStaff,
  listStaffInvites,
  resendStaffInvite,
  revokeStaffInvite,
} from "@/lib/staff-invite.functions";

const ROLES = [
  "super_admin",
  "content_manager",
  "ecommerce_manager",
  "rewards_manager",
  "viewer",
] as const;

export const Route = createFileRoute("/admin/roles/")({
  component: AdminRolesPage,
});

function roleLabel(role: string) {
  return role.replaceAll("_", " ");
}

function AdminRolesPage() {
  const { hasRole } = useAccount();

  if (!hasRole("super_admin")) {
    return (
      <AdminShell>
        <div className="panel flex flex-col items-center gap-3 p-16 text-center">
          <ShieldAlert className="size-10 text-muted-foreground" />
          <h1 className="text-xl">Super admin access required</h1>
          <p className="text-sm text-muted-foreground">
            Only super admins can invite staff or manage roles.
          </p>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <RolesManager />
    </AdminShell>
  );
}

function RolesManager() {
  const queryClient = useQueryClient();
  const roles = useQuery({
    queryKey: ["admin-staff-roles"],
    queryFn: () => listStaffRoles(),
  });
  const invites = useQuery({
    queryKey: ["admin-staff-invites"],
    queryFn: () => listStaffInvites(),
    retry: false,
  });

  const [role, setRole] = useState<(typeof ROLES)[number]>("viewer");
  const [grantRole, setGrantRole] = useState<(typeof ROLES)[number]>("viewer");
  const [saving, setSaving] = useState(false);
  const [granting, setGranting] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);

  const pendingInvites = (invites.data ?? []).filter(
    (row) => row.status === "pending" || row.status === "expired",
  );

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const email = String(form.get("email") ?? "").trim();
    const fullName = String(form.get("full_name") ?? "").trim();
    if (!email) {
      toast.error("Enter the invitee's email.");
      return;
    }

    setSaving(true);
    try {
      const result = await inviteStaff({
        data: {
          email,
          role,
          ...(fullName ? { fullName } : {}),
          origin: window.location.origin,
        },
      });
      if (result.kind === "existing") {
        toast.success(
          `Granted ${roleLabel(role)} to ${email}. They can sign in with their password.`,
        );
      } else {
        toast.success(
          `Invite sent to ${email}. Role assigned — they set a password via the email link.`,
        );
      }
      formEl.reset();
      queryClient.invalidateQueries({ queryKey: ["admin-staff-invites"] });
      queryClient.invalidateQueries({ queryKey: ["admin-staff-roles"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send invite.");
    } finally {
      setSaving(false);
    }
  }

  async function onGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const email = String(form.get("email") ?? "").trim();
    if (!email) {
      toast.error("Enter the user's email.");
      return;
    }

    setGranting(true);
    try {
      await assignRole({ data: { email, role: grantRole } });
      toast.success(`Granted ${roleLabel(grantRole)} to ${email}`);
      formEl.reset();
      queryClient.invalidateQueries({ queryKey: ["admin-staff-roles"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not grant role.");
    } finally {
      setGranting(false);
    }
  }

  async function onRevoke(roleId: string) {
    try {
      await revokeRole({ data: { roleId } });
      toast.success("Role revoked");
      queryClient.invalidateQueries({ queryKey: ["admin-staff-roles"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke role.");
    }
  }

  async function onResend(inviteId: string) {
    setBusyInviteId(inviteId);
    try {
      await resendStaffInvite({
        data: { inviteId, origin: window.location.origin },
      });
      toast.success("Invite resent");
      queryClient.invalidateQueries({ queryKey: ["admin-staff-invites"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resend invite.");
    } finally {
      setBusyInviteId(null);
    }
  }

  async function onRevokeInvite(inviteId: string) {
    setBusyInviteId(inviteId);
    try {
      await revokeStaffInvite({ data: { inviteId } });
      toast.success("Invite revoked");
      queryClient.invalidateQueries({ queryKey: ["admin-staff-invites"] });
      queryClient.invalidateQueries({ queryKey: ["admin-staff-roles"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke invite.");
    } finally {
      setBusyInviteId(null);
    }
  }

  return (
    <>
      <div>
        <h1 className="text-2xl">Staff &amp; roles</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Invite people by email. New accounts get a Gmail link to set their own password; the role
          is assigned when you send the invite. Existing accounts keep their password and get an
          access notice instead.
        </p>
      </div>

      <form
        onSubmit={onInvite}
        className="panel mt-6 grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
      >
        <div className="grid gap-2 sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Invite staff
          </p>
        </div>
        <div className="grid gap-2 sm:col-span-1">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="colleague@amplus.co.ke"
            autoComplete="off"
          />
        </div>
        <div className="grid gap-2 sm:col-span-1">
          <Label htmlFor="invite-name">Name (optional)</Label>
          <Input id="invite-name" name="full_name" placeholder="Full name" autoComplete="off" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invite-role">Role</Label>
          <Select value={role} onValueChange={(value) => setRole(value as (typeof ROLES)[number])}>
            <SelectTrigger id="invite-role" className="w-full min-w-44 sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabel(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="accent" disabled={saving} className="sm:mb-0">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          {saving ? "Sending…" : "Send invite"}
        </Button>
      </form>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Pending invites</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Waiting for the invitee to set a password. Links expire after 72 hours.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Invitee</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pendingInvites.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.full_name || row.email}</p>
                    {row.full_name ? (
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{roleLabel(row.role)}</Badge>
                      {row.status === "expired" ? (
                        <Badge variant="outline" className="text-destructive">
                          Expired
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(row.last_sent_at)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.expires_at ? formatDate(row.expires_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyInviteId === row.id}
                        onClick={() => void onResend(row.id)}
                      >
                        {busyInviteId === row.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                        Resend
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={busyInviteId === row.id}
                        onClick={() => void onRevokeInvite(row.id)}
                        aria-label="Revoke invite"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {invites.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Loading invites…
                  </td>
                </tr>
              ) : null}
              {!invites.isLoading && pendingInvites.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {invites.isError
                      ? invites.error instanceof Error
                        ? invites.error.message
                        : "Could not load invites."
                      : "No pending invites."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <div>
          <h2 className="text-lg font-semibold">Active staff</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Everyone with an admin role. Use grant below only for people who already signed up as
            customers.
          </p>
        </div>

        <form
          onSubmit={onGrant}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border bg-secondary/20 p-4"
        >
          <div className="grid w-full gap-2 sm:w-auto">
            <Label htmlFor="grant-email">Existing account email</Label>
            <Input
              id="grant-email"
              name="email"
              type="email"
              required
              className="w-full sm:w-64"
              placeholder="staff@amplus.co.ke"
            />
          </div>
          <div className="grid w-full gap-2 sm:w-auto">
            <Label htmlFor="grant-role">Role</Label>
            <Select
              value={grantRole}
              onValueChange={(value) => setGrantRole(value as (typeof ROLES)[number])}
            >
              <SelectTrigger id="grant-role" className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="outline" disabled={granting}>
            {granting ? "Granting…" : "Grant role"}
          </Button>
        </form>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Granted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(roles.data ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.profile?.full_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{row.profile?.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{roleLabel(row.role)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void onRevoke(row.id)}
                      aria-label="Revoke role"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!roles.isLoading && (roles.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                    No staff roles assigned yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
