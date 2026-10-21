import { COMPANY } from "@/lib/company";
import { mailConfigured, sendMail } from "@/lib/mail.server";

export type StaffRoleLabel =
  "super_admin" | "content_manager" | "ecommerce_manager" | "rewards_manager" | "viewer";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function roleDisplayName(role: string) {
  return role.replaceAll("_", " ");
}

function firstName(name: string | null | undefined, email: string) {
  const fromName = name?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = email.split("@")[0]?.trim();
  return local || "there";
}

function appOrigin(origin?: string) {
  const fromArg = origin?.trim();
  const fromEnv = process.env["PUBLIC_APP_URL"]?.trim();
  const base = (fromArg || fromEnv || "http://localhost:8080").replace(/\/$/, "");
  return base;
}

function brandedShell(input: {
  preheader: string;
  eyebrow: string;
  title: string;
  greeting: string;
  intro: string;
  bodyHtml: string;
  bodyText: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const cta =
    input.ctaHref && input.ctaLabel
      ? `<p style="margin:28px 0 0"><a href="${escapeHtml(input.ctaHref)}" style="display:inline-block;background:#c45c26;color:#ffffff;padding:12px 22px;text-decoration:none;border-radius:6px;font-weight:600">${escapeHtml(input.ctaLabel)}</a></p>`
      : "";
  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#f5f1eb;font-family:Georgia,'Times New Roman',serif">
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1eb;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7e0d6">
          <tr>
            <td style="background:#1c1917;color:#faf6f1;padding:22px 28px">
              <p style="margin:0;letter-spacing:0.18em;font-size:11px;text-transform:uppercase;color:#e8b089">Amplus Construction Solutions</p>
              <p style="margin:8px 0 0;font-size:20px;font-weight:700">${escapeHtml(input.eyebrow)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;color:#1c1917;line-height:1.55;font-size:15px">
              <p style="margin:0 0 12px">Hi ${escapeHtml(input.greeting)},</p>
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${escapeHtml(input.title)}</h1>
              <p style="margin:0 0 16px;color:#44403c">${escapeHtml(input.intro)}</p>
              ${input.bodyHtml}
              ${cta}
              <p style="margin:28px 0 0;font-size:13px;color:#78716c">Need help? Call ${escapeHtml(COMPANY.phone)} or reply to this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #e7e0d6;color:#78716c;font-size:12px;line-height:1.5">
              ${escapeHtml(COMPANY.name)}<br/>
              ${escapeHtml(COMPANY.address)}<br/>
              ${escapeHtml(COMPANY.hours)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${input.greeting},`,
    "",
    input.title,
    input.intro,
    "",
    input.bodyText,
    "",
    input.ctaHref ? `${input.ctaLabel ?? "Open"}: ${input.ctaHref}` : "",
    "",
    COMPANY.name,
    COMPANY.phone,
    COMPANY.address,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { html, text };
}

export function assertMailReady() {
  if (!mailConfigured()) {
    throw new Error(
      "Staff invites need email. Add GMAIL_USER and GMAIL_APP_PASSWORD (or Resend) to the server env.",
    );
  }
}

export async function sendSetPasswordInviteMail(input: {
  to: string;
  fullName?: string | null;
  role: string;
  token: string;
  expiresAt: Date;
  origin?: string;
}) {
  assertMailReady();
  const roleLabel = roleDisplayName(input.role);
  const acceptUrl = `${appOrigin(input.origin)}/auth/invite?token=${encodeURIComponent(input.token)}`;
  const expiresLabel = input.expiresAt.toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const shell = brandedShell({
    preheader: `Set your Amplus staff password — ${roleLabel}`,
    eyebrow: "Staff invitation",
    title: "You have been invited to Amplus admin",
    greeting: firstName(input.fullName, input.to),
    intro: `You have been granted the ${roleLabel} role. Set a password to access the admin console.`,
    bodyHtml: `<p style="margin:0;color:#44403c">This link expires on <strong>${escapeHtml(expiresLabel)}</strong>. If you did not expect this email, ignore it and tell your Amplus contact.</p>`,
    bodyText: `Role: ${roleLabel}\nExpires: ${expiresLabel}`,
    ctaLabel: "Set password & join",
    ctaHref: acceptUrl,
  });
  const ok = await sendMail({
    to: input.to,
    subject: `Amplus staff invite — ${roleLabel}`,
    text: shell.text,
    html: shell.html,
  });
  if (!ok)
    throw new Error(
      "Could not send the invite email. Check Gmail / Resend settings, then use Resend.",
    );
}

export async function sendExistingStaffAccessMail(input: {
  to: string;
  fullName?: string | null;
  role: string;
  origin?: string;
}) {
  assertMailReady();
  const roleLabel = roleDisplayName(input.role);
  const signInUrl = `${appOrigin(input.origin)}/auth?redirect=${encodeURIComponent("/admin")}`;
  const shell = brandedShell({
    preheader: `Staff access granted — ${roleLabel}`,
    eyebrow: "Staff access",
    title: "You now have Amplus admin access",
    greeting: firstName(input.fullName, input.to),
    intro: `Your account has been granted the ${roleLabel} role. Sign in with your existing password to open the admin console.`,
    bodyHtml: `<p style="margin:0;color:#44403c">If you forgot your password, use “Forgot password?” on the sign-in page, or ask a super admin for help.</p>`,
    bodyText: `Role: ${roleLabel}\nSign in: ${signInUrl}`,
    ctaLabel: "Sign in to admin",
    ctaHref: signInUrl,
  });
  const ok = await sendMail({
    to: input.to,
    subject: `Amplus staff access — ${roleLabel}`,
    text: shell.text,
    html: shell.html,
  });
  if (!ok) throw new Error("Could not send the access email. Check Gmail / Resend settings.");
}
