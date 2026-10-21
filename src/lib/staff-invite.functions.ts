import { createHash, randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isMissingRelation } from "@/lib/supabase-errors";

const ROLES = [
  "super_admin",
  "content_manager",
  "ecommerce_manager",
  "rewards_manager",
  "viewer",
] as const;

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

// Service-role client is loaded dynamically; keep helpers loose like other admin modules.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

async function requireSuperAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only super admins can manage staff invites.");
}

function missingInvitesHint(error: { code?: string; message?: string } | null) {
  if (!error) return null;
  if (isMissingRelation(error)) {
    return "Staff invites are not installed. Run supabase/migrations/20261020140000_staff_invites.sql (or npm run apply:staff-invites).";
  }
  return null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(raw: string) {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

function newTempPassword() {
  return randomBytes(32).toString("base64url");
}

function expiresAtFromNow() {
  return new Date(Date.now() + INVITE_TTL_MS);
}

async function findProfileByEmail(admin: AdminClient, email: string) {
  const normalized = normalizeEmail(email);
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;

  // Fallback: scan auth users if profile email differs / missing.
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw new Error(listError.message);
  const match = (listed.users ?? []).find(
    (u: { id: string; email?: string; user_metadata?: Record<string, unknown> }) =>
      (u.email ?? "").toLowerCase() === normalized,
  );
  if (!match) return null;
  return {
    id: match.id,
    full_name: (match.user_metadata?.["full_name"] as string | undefined) ?? null,
    email: match.email ?? normalized,
  };
}

async function ensureRole(admin: AdminClient, userId: string, role: (typeof ROLES)[number]) {
  const { error } = await admin.from("user_roles").insert({ user_id: userId, role });
  if (error) {
    if (error.code === "23505") return { alreadyHad: true as const };
    throw new Error(error.message);
  }
  return { alreadyHad: false as const };
}

async function createPendingInvite(
  admin: AdminClient,
  input: {
    email: string;
    userId: string;
    role: (typeof ROLES)[number];
    invitedBy: string;
    fullName?: string | null;
    rawToken: string;
    expiresAt: Date;
  },
) {
  const { data, error } = await admin
    .from("staff_invites")
    .insert({
      email: input.email,
      user_id: input.userId,
      role: input.role,
      token_hash: hashToken(input.rawToken),
      expires_at: input.expiresAt.toISOString(),
      status: "pending",
      invited_by: input.invitedBy,
      full_name: input.fullName ?? null,
      last_sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  const hint = missingInvitesHint(error);
  if (hint) throw new Error(hint);
  if (error) {
    if (error.code === "23505") {
      throw new Error("A pending invite already exists for this email. Use Resend on that invite.");
    }
    throw new Error(error.message);
  }
  return data.id as string;
}

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().email(),
        role: z.enum(ROLES),
        fullName: z.string().trim().max(120).optional(),
        origin: z.string().url().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const { assertMailReady, sendExistingStaffAccessMail, sendSetPasswordInviteMail } =
      await import("@/lib/staff-invite-mail.server");
    assertMailReady();

    const email = normalizeEmail(data.email);
    const fullName = data.fullName?.trim() || null;
    const actorEmail =
      typeof context.claims?.email === "string" ? context.claims.email.toLowerCase() : "";
    if (actorEmail && email === actorEmail) {
      throw new Error("You cannot invite your own account.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!actorEmail) {
      const { data: actor } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", context.userId)
        .maybeSingle();
      if (actor?.email && normalizeEmail(actor.email) === email) {
        throw new Error("You cannot invite your own account.");
      }
    }

    const existing = await findProfileByEmail(supabaseAdmin, email);

    if (existing) {
      const roleResult = await ensureRole(supabaseAdmin, existing.id, data.role);
      if (roleResult.alreadyHad) {
        throw new Error("This user already has that role.");
      }
      await sendExistingStaffAccessMail({
        to: email,
        fullName: fullName ?? existing.full_name,
        role: data.role,
        ...(data.origin ? { origin: data.origin } : {}),
      });
      if (fullName) {
        await supabaseAdmin.from("profiles").update({ full_name: fullName }).eq("id", existing.id);
      }
      return {
        kind: "existing" as const,
        userId: existing.id,
        email,
        role: data.role,
      };
    }

    const tempPassword = newTempPassword();
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        ...(fullName ? { full_name: fullName } : {}),
        invited_staff: true,
      },
    });
    if (createError || !created.user) {
      const msg = createError?.message ?? "Could not create the staff account.";
      if (/already|registered|exists/i.test(msg)) {
        throw new Error(
          "An account with that email already exists but could not be matched. Ask them to sign in once, then grant the role.",
        );
      }
      throw new Error(msg);
    }

    const userId = created.user.id;
    let inviteId: string | null = null;
    const rawToken = newToken();
    const expiresAt = expiresAtFromNow();

    try {
      await ensureRole(supabaseAdmin, userId, data.role);
      inviteId = await createPendingInvite(supabaseAdmin, {
        email,
        userId,
        role: data.role,
        invitedBy: context.userId,
        fullName,
        rawToken,
        expiresAt,
      });
      await sendSetPasswordInviteMail({
        to: email,
        fullName,
        role: data.role,
        token: rawToken,
        expiresAt,
        ...(data.origin ? { origin: data.origin } : {}),
      });
    } catch (error) {
      // Leave pending invite if only mail failed; otherwise roll back new user.
      if (inviteId) {
        throw error instanceof Error
          ? error
          : new Error("Invite was created but the email failed. Use Resend.");
      }
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw error instanceof Error ? error : new Error("Could not complete the invite.");
    }

    return {
      kind: "invited" as const,
      inviteId,
      userId,
      email,
      role: data.role,
      expiresAt: expiresAt.toISOString(),
    };
  });

export const listStaffInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("staff_invites")
      .select(
        "id, email, user_id, role, status, full_name, expires_at, created_at, last_sent_at, accepted_at, revoked_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    const hint = missingInvitesHint(error);
    if (hint) throw new Error(hint);
    if (error) throw new Error(error.message);

    const now = Date.now();
    return (data ?? []).map((row) => {
      const expired =
        row.status === "pending" &&
        row.expires_at != null &&
        new Date(row.expires_at).getTime() < now;
      return {
        ...row,
        status: expired ? "expired" : row.status,
      };
    });
  });

export const resendStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        inviteId: z.string().uuid(),
        origin: z.string().url().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const { assertMailReady, sendSetPasswordInviteMail } =
      await import("@/lib/staff-invite-mail.server");
    assertMailReady();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite, error } = await supabaseAdmin
      .from("staff_invites")
      .select("id, email, role, status, full_name, expires_at")
      .eq("id", data.inviteId)
      .maybeSingle();
    const hint = missingInvitesHint(error);
    if (hint) throw new Error(hint);
    if (error) throw new Error(error.message);
    if (!invite) throw new Error("Invite not found.");
    if (invite.status === "revoked") throw new Error("This invite was revoked.");
    if (invite.status === "accepted") throw new Error("This invite was already accepted.");
    if (invite.status !== "pending") throw new Error("Only pending invites can be resent.");

    const rawToken = newToken();
    const expiresAt = expiresAtFromNow();
    const { error: updateError } = await supabaseAdmin
      .from("staff_invites")
      .update({
        token_hash: hashToken(rawToken),
        expires_at: expiresAt.toISOString(),
        last_sent_at: new Date().toISOString(),
        status: "pending",
      })
      .eq("id", invite.id);
    if (updateError) throw new Error(updateError.message);

    await sendSetPasswordInviteMail({
      to: invite.email,
      fullName: invite.full_name,
      role: invite.role,
      token: rawToken,
      expiresAt,
      ...(data.origin ? { origin: data.origin } : {}),
    });

    return { ok: true as const, expiresAt: expiresAt.toISOString() };
  });

export const revokeStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ inviteId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite, error } = await supabaseAdmin
      .from("staff_invites")
      .select("id, user_id, role, status")
      .eq("id", data.inviteId)
      .maybeSingle();
    const hint = missingInvitesHint(error);
    if (hint) throw new Error(hint);
    if (error) throw new Error(error.message);
    if (!invite) throw new Error("Invite not found.");
    if (invite.status === "accepted") {
      throw new Error(
        "This invite was already accepted. Revoke the role from Active staff instead.",
      );
    }
    if (invite.status === "revoked") return { ok: true as const };

    const { error: updateError } = await supabaseAdmin
      .from("staff_invites")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        token_hash: null,
        expires_at: null,
      })
      .eq("id", invite.id);
    if (updateError) throw new Error(updateError.message);

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", invite.user_id)
      .eq("role", invite.role);

    return { ok: true as const };
  });

export const previewStaffInvite = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ token: z.string().min(20).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = hashToken(data.token);
    const { data: invite, error } = await supabaseAdmin
      .from("staff_invites")
      .select("id, email, role, status, full_name, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    const hint = missingInvitesHint(error);
    if (hint) throw new Error(hint);
    if (error) throw new Error(error.message);
    if (!invite) return { ok: false as const, reason: "invalid" as const };

    if (invite.status === "revoked") return { ok: false as const, reason: "revoked" as const };
    if (invite.status === "accepted") {
      return { ok: false as const, reason: "accepted" as const, email: invite.email };
    }
    if (invite.status !== "pending") return { ok: false as const, reason: "invalid" as const };
    if (!invite.expires_at || new Date(invite.expires_at).getTime() < Date.now()) {
      return { ok: false as const, reason: "expired" as const };
    }

    return {
      ok: true as const,
      email: invite.email,
      role: invite.role,
      fullName: invite.full_name,
      expiresAt: invite.expires_at,
    };
  });

export const acceptStaffInvite = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(20).max(200),
        password: z.string().min(8).max(128),
        fullName: z.string().trim().min(1).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = hashToken(data.token);
    const { data: invite, error } = await supabaseAdmin
      .from("staff_invites")
      .select("id, email, user_id, role, status, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    const hint = missingInvitesHint(error);
    if (hint) throw new Error(hint);
    if (error) throw new Error(error.message);
    if (!invite) throw new Error("This invite link is invalid.");
    if (invite.status === "revoked")
      throw new Error("This invite was revoked. Ask a super admin to send a new one.");
    if (invite.status === "accepted")
      throw new Error("This invite was already used. Sign in instead.");
    if (invite.status !== "pending") throw new Error("This invite link is no longer valid.");
    if (!invite.expires_at || new Date(invite.expires_at).getTime() < Date.now()) {
      throw new Error("This invite has expired. Ask a super admin to resend it.");
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(invite.user_id, {
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName.trim(),
        invited_staff: true,
      },
    });
    if (authError) throw new Error(authError.message);

    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName.trim(), email: invite.email })
      .eq("id", invite.user_id);

    const { error: acceptError } = await supabaseAdmin
      .from("staff_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        token_hash: null,
        expires_at: null,
        full_name: data.fullName.trim(),
      })
      .eq("id", invite.id)
      .eq("status", "pending");
    if (acceptError) throw new Error(acceptError.message);

    return { email: invite.email, role: invite.role };
  });
