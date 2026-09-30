/**
 * Paystack helper. Server-only: the secret key never reaches the browser.
 */

const API = "https://api.paystack.co";

export function paystackSecretKey(): string {
  return process.env["PAYSTACK_SECRET_KEY"] ?? "";
}

export function paystackPublicKey(): string {
  const fromMeta =
    typeof import.meta !== "undefined"
      ? ((import.meta as { env?: { VITE_PAYSTACK_PUBLIC_KEY?: string } }).env
          ?.VITE_PAYSTACK_PUBLIC_KEY ?? "")
      : "";
  return (
    process.env["VITE_PAYSTACK_PUBLIC_KEY"] ??
    process.env["NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY"] ??
    fromMeta ??
    ""
  );
}

export function paystackConfigured(): boolean {
  return Boolean(paystackSecretKey() && paystackPublicKey());
}

type InitializeResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

type PaystackCharge = {
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  channel?: string;
  gateway_response?: string;
  paid_at?: string;
  customer?: { email?: string };
};

function authHeaders() {
  return {
    Authorization: `Bearer ${paystackSecretKey()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function initializeTransaction(input: {
  email: string;
  amountKes: number;
  reference: string;
  callbackUrl: string;
}): Promise<InitializeResult> {
  const amount = Math.round(input.amountKes * 100);
  const response = await fetch(`${API}/transaction/initialize`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email,
      amount,
      currency: "KES",
      reference: input.reference,
      callback_url: input.callbackUrl,
    }),
  });
  const payload = (await response.json()) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; access_code?: string; reference?: string };
  };
  if (!payload.status || !payload.data?.access_code || !payload.data.reference) {
    throw new Error(payload.message ?? "Could not start payment");
  }
  return {
    authorizationUrl: payload.data.authorization_url ?? "",
    accessCode: payload.data.access_code,
    reference: payload.data.reference,
  };
}

export async function verifyTransaction(reference: string): Promise<PaystackCharge> {
  const response = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: authHeaders(),
  });
  const payload = (await response.json()) as {
    status?: boolean;
    message?: string;
    data?: PaystackCharge;
  };
  if (!payload.status || !payload.data) {
    throw new Error(payload.message ?? "Could not confirm payment");
  }
  return payload.data;
}

export function mapPaystackStatus(status: string | undefined) {
  const value = (status ?? "").toLowerCase();
  if (value === "success") return "PAID" as const;
  if (value === "failed" || value === "reversed") return "PAYMENT_FAILED" as const;
  if (value === "abandoned") return "PAYMENT_FAILED" as const;
  return "PAYMENT_PROCESSING" as const;
}

export async function paystackSignatureValid(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = paystackSecretKey();
  if (!secret || !signature) return false;
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const digest = createHmac("sha512", secret).update(rawBody, "utf8").digest("hex");
  try {
    const left = Buffer.from(digest, "utf8");
    const right = Buffer.from(signature, "utf8");
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}
