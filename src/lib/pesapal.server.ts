/**
 * Pesapal API 3.0 helper. Server-only: consumer key/secret never reach the browser.
 */
type TokenResponse = { token?: string; error?: unknown; message?: string };

function baseUrl() {
  const env = (process.env["PESAPAL_ENVIRONMENT"] ?? "sandbox").toLowerCase();
  return env === "live" ? "https://pay.pesapal.com/v3" : "https://cybqa.pesapal.com/pesapalv3";
}

export function pesapalConfigured() {
  return Boolean(process.env["PESAPAL_CONSUMER_KEY"] && process.env["PESAPAL_CONSUMER_SECRET"]);
}

export async function getToken(): Promise<string> {
  const response = await fetch(`${baseUrl()}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      consumer_key: process.env["PESAPAL_CONSUMER_KEY"],
      consumer_secret: process.env["PESAPAL_CONSUMER_SECRET"],
    }),
  });
  const payload = (await response.json()) as TokenResponse;
  if (!payload.token) throw new Error("Could not authenticate with Pesapal");
  return payload.token;
}

export async function registerIpn(token: string, ipnUrl: string): Promise<string> {
  const existing = process.env["PESAPAL_IPN_ID"];
  if (existing) return existing;
  const response = await fetch(`${baseUrl()}/api/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "POST" }),
  });
  const payload = (await response.json()) as { ipn_id?: string };
  if (!payload.ipn_id) throw new Error("Could not register the Pesapal notification URL");
  return payload.ipn_id;
}

export type SubmitOrderInput = {
  merchantReference: string;
  amount: number;
  description: string;
  callbackUrl: string;
  cancellationUrl: string;
  notificationId: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
};

export async function submitOrder(token: string, input: SubmitOrderInput) {
  const response = await fetch(`${baseUrl()}/api/Transactions/SubmitOrderRequest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      id: input.merchantReference,
      currency: "KES",
      amount: Number(input.amount.toFixed(2)),
      description: input.description.slice(0, 100),
      callback_url: input.callbackUrl,
      cancellation_url: input.cancellationUrl,
      notification_id: input.notificationId,
      billing_address: {
        email_address: input.email ?? undefined,
        phone_number: input.phone ?? undefined,
        first_name: input.firstName ?? undefined,
      },
    }),
  });
  const payload = (await response.json()) as {
    order_tracking_id?: string;
    redirect_url?: string;
    error?: { code?: string; message?: string };
  };
  if (!payload.order_tracking_id || !payload.redirect_url) {
    throw new Error(payload.error?.message ?? "Pesapal did not return a payment link");
  }
  return { orderTrackingId: payload.order_tracking_id, redirectUrl: payload.redirect_url };
}

export type TransactionStatus = {
  payment_method?: string;
  amount?: number;
  confirmation_code?: string;
  payment_status_description?: string;
  description?: string;
  status_code?: number;
  merchant_reference?: string;
  payment_account?: string;
  currency?: string;
};

export async function getTransactionStatus(token: string, orderTrackingId: string) {
  const response = await fetch(
    `${baseUrl()}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`,
    { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } },
  );
  return (await response.json()) as TransactionStatus;
}

/** Maps a Pesapal payment status to the internal order state. */
export function mapStatus(description: string | undefined) {
  switch ((description ?? "").toUpperCase()) {
    case "COMPLETED":
      return "PAID" as const;
    case "FAILED":
      return "PAYMENT_FAILED" as const;
    case "REVERSED":
      return "PAYMENT_REVERSED" as const;
    case "INVALID":
      return "PAYMENT_FAILED" as const;
    default:
      return "PAYMENT_PROCESSING" as const;
  }
}
