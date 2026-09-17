import { createFileRoute } from "@tanstack/react-router";

/**
 * Pesapal IPN listener. Pesapal only sends identifiers here; the authoritative
 * status is fetched server-side with GetTransactionStatus before anything changes.
 */
async function handle(reference: string | null, trackingId: string | null) {
  if (!reference || !trackingId) {
    return Response.json({ orderNotificationType: "IPNCHANGE", status: 500 }, { status: 400 });
  }
  try {
    const { reconcileOrder } = await import("@/lib/reconcile.server");
    await reconcileOrder(reference, "ipn", trackingId);
    return Response.json({
      orderNotificationType: "IPNCHANGE",
      orderTrackingId: trackingId,
      orderMerchantReference: reference,
      status: 200,
    });
  } catch (error) {
    console.error("Pesapal IPN failed", error);
    return Response.json({ orderNotificationType: "IPNCHANGE", status: 500 }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/pesapal/ipn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          OrderTrackingId?: string;
          OrderMerchantReference?: string;
        };
        return handle(body.OrderMerchantReference ?? null, body.OrderTrackingId ?? null);
      },
      GET: async ({ request }) => {
        const url = new URL(request.url);
        return handle(
          url.searchParams.get("OrderMerchantReference"),
          url.searchParams.get("OrderTrackingId"),
        );
      },
    },
  },
});
