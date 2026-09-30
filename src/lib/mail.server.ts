import nodemailer from "nodemailer";
import { COMPANY } from "@/lib/company";

export type OutboundMail = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

function gmailConfigured() {
  const user = process.env["GMAIL_USER"]?.trim();
  const pass = process.env["GMAIL_APP_PASSWORD"]?.replace(/\s/g, "");
  return Boolean(user && pass);
}

function fromHeader() {
  const user = process.env["GMAIL_USER"]?.trim() ?? "";
  const name = process.env["GMAIL_FROM_NAME"]?.trim() || COMPANY.shortName;
  if (user) return `"${name.replace(/"/g, "")}" <${user}>`;
  return process.env["RESEND_FROM"]?.trim() ?? `${COMPANY.shortName} <${COMPANY.email}>`;
}

async function sendViaGmail(mail: OutboundMail) {
  const user = process.env["GMAIL_USER"]!.trim();
  const pass = process.env["GMAIL_APP_PASSWORD"]!.replace(/\s/g, "");
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  const to = Array.isArray(mail.to) ? mail.to : [mail.to];
  await transport.sendMail({
    from: fromHeader(),
    to,
    subject: mail.subject,
    text: mail.text,
    ...(mail.html ? { html: mail.html } : {}),
  });
}

async function sendViaResend(mail: OutboundMail) {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM"];
  if (!apiKey || !from) {
    throw new Error("No mail transport is configured.");
  }
  const to = Array.isArray(mail.to) ? mail.to : [mail.to];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend rejected the email (${response.status})`);
  }
}

export function mailConfigured() {
  return gmailConfigured() || Boolean(process.env["RESEND_API_KEY"] && process.env["RESEND_FROM"]);
}

export async function sendMail(mail: OutboundMail): Promise<boolean> {
  const recipients = (Array.isArray(mail.to) ? mail.to : [mail.to]).map((row) => row.trim()).filter(Boolean);
  if (recipients.length === 0) return false;
  const payload = { ...mail, to: recipients };
  try {
    if (gmailConfigured()) {
      await sendViaGmail(payload);
      return true;
    }
    await sendViaResend(payload);
    return true;
  } catch (error) {
    console.error("Email send failed", error);
    return false;
  }
}
