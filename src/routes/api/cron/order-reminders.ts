import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/order-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const origin =
          process.env["PUBLIC_APP_URL"]?.trim() || new URL(request.url).origin;
        const { sendDueAbandonedReminders } = await import("@/lib/cancel.server");
        const result = await sendDueAbandonedReminders(origin);
        return Response.json(result);
      },
      GET: async ({ request }) => {
        const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const origin =
          process.env["PUBLIC_APP_URL"]?.trim() || new URL(request.url).origin;
        const { sendDueAbandonedReminders } = await import("@/lib/cancel.server");
        const result = await sendDueAbandonedReminders(origin);
        return Response.json(result);
      },
    },
  },
});
