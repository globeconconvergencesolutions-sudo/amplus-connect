import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";
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

function AdminRolesPage() {
  const { hasRole } = useAccount();

  if (!hasRole("super_admin")) {
    return (
      <AdminShell>
        <div className="panel flex flex-col items-center gap-3 p-16 text-center">
          <ShieldAlert className="size-10 text-muted-foreground" />
          <h1 className="text-xl">Super admin access required</h1>
          <p className="text-sm text-muted-foreground">
            Only super admins can grant or revoke staff roles.
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
  const [role, setRole] = useState<(typeof ROLES)[number]>("viewer");
  const [saving, setSaving] = useState(false);

  async function onGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (!email) {
      toast.error("Enter the user's email.");
      return;
    }

    setSaving(true);
    try {
      await assignRole({ data: { email, role } });
      toast.success(`Granted ${role.replace("_", " ")} to ${email}`);
      event.currentTarget.reset();
      queryClient.invalidateQueries({ queryKey: ["admin-staff-roles"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not grant role.");
    } finally {
      setSaving(false);
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

  return (
    <>
      <h1 className="text-2xl">Staff roles</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Grant or revoke admin access. The user must already have an account (they sign up like any
        customer first).
      </p>

      <form onSubmit={onGrant} className="panel mt-6 flex flex-wrap items-end gap-3 p-5">
        <div className="grid gap-2">
          <Label htmlFor="email">User email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            className="w-64"
            placeholder="staff@amplus.co.ke"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="role">Role</Label>
          <Select value={role} onValueChange={(value) => setRole(value as (typeof ROLES)[number])}>
            <SelectTrigger id="role" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="accent" disabled={saving}>
          {saving ? "Granting…" : "Grant role"}
        </Button>
      </form>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
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
                  <Badge variant="secondary">{row.role.replace("_", " ")}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(row.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => onRevoke(row.id)}>
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
    </>
  );
}
