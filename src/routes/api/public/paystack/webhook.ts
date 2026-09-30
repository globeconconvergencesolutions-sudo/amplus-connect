import { createFileRoute } from "@tanstack/react-router";

/**
 * Paystack webhook. Signature is HMAC SHA512 of the raw body with the secret key.
 * Status is still confirmed via Paystack verify inside reconcileOrder.
 */
export const Route = createFileRoute("/api/public/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-paystack-signature");
        const { paystackSignatureValid } = await import("@/lib/paystack.server");
        const valid = await paystackSignatureValid(rawBody, signature);
        if (!valid) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: { event?: string; data?: { reference?: string } };
        try {
          payload = JSON.parse(rawBody) as { event?: string; data?: { reference?: string } };
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const reference = payload.data?.reference;
        if (!reference) {
          return Response.json({ received: true });
        }

        try {
          const { reconcileOrder } = await import("@/lib/reconcile.server");
          await reconcileOrder(reference, "ipn");
          return Response.json({ received: true });
        } catch (error) {
          console.error("Paystack webhook failed", error);
          return Response.json({ received: false }, { status: 500 });
        }
      },
    },
  },
});
