import { COMPANY } from "@/lib/company";
import { formatKes } from "@/lib/format";

type PaidOrderMail = {
  merchantReference: string;
  totalKes: number;
  customerEmail: string | null;
  customerName?: string | null;
  items: { name: string; quantity: number; lineTotal: number }[];
};

export async function notifyOrderPaid(order: PaidOrderMail): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM"];
  if (!apiKey || !from) return;

  const lines = order.items
    .map((item) => `${item.quantity} × ${item.name} — ${formatKes(item.lineTotal)}`)
    .join("\n");
  const body = [
    `Order ${order.merchantReference} is paid.`,
    `Total: ${formatKes(order.totalKes)}`,
    "",
    lines,
    "",
    COMPANY.name,
  ].join("\n");

  const recipients = new Set<string>();
  if (order.customerEmail) recipients.add(order.customerEmail);
  if (process.env["ORDER_NOTIFY_EMAIL"]) recipients.add(process.env["ORDER_NOTIFY_EMAIL"]);

  if (recipients.size === 0) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [...recipients],
      subject: `Amplus order ${order.merchantReference} paid`,
      text: body,
    }),
  }).catch((error: unknown) => {
    console.error("Order paid email failed", error);
  });
}
