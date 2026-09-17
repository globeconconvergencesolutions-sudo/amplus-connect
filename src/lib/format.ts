export function formatKes(value: number | string | null | undefined): string {
  const amount = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAYMENT_PROCESSING: "Payment processing",
  PAID: "Paid",
  PAYMENT_FAILED: "Payment failed",
  PAYMENT_REVERSED: "Payment reversed",
  CANCELLED: "Cancelled",
  FULFILLED: "Being prepared",
  SHIPPED: "Out for delivery",
  DELIVERED: "Delivered",
  REFUND_REQUESTED: "Refund requested",
};

export function tierLabel(tier: string | null | undefined) {
  if (!tier) return "Bronze";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
