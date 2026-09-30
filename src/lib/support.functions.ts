import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isMissingRelation } from "@/lib/supabase-errors";

function ticketNumber() {
  return `AMP-HT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export const createPaymentTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        merchantReference: z.string().min(3),
        message: z.string().min(8).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, merchant_reference, user_id, total_kes")
      .eq("merchant_reference", data.merchantReference)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order || order.user_id !== userId) throw new Error("Order not found");

    const { data: openTickets, error: openError } = await supabase
      .from("support_tickets")
      .select("id, ticket_number, status")
      .eq("user_id", userId)
      .eq("order_id", order.id)
      .eq("kind", "payment_verification")
      .neq("status", "resolved")
      .limit(1);
    if (isMissingRelation(openError)) {
      throw new Error(
        "Support tables are not installed. Run supabase/migrations/20260929120000_support_tickets.sql in the Supabase SQL editor.",
      );
    }
    if (openError) throw new Error(openError.message);
    const existing = openTickets?.[0];
    if (existing) {
      return {
        ticketId: existing.id,
        ticketNumber: existing.ticket_number,
        reused: true as const,
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const number = ticketNumber();
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        ticket_number: number,
        user_id: userId,
        order_id: order.id,
        merchant_reference: order.merchant_reference,
        subject: `Payment verification · ${order.merchant_reference}`,
        kind: "payment_verification",
        status: "waiting_on_us",
      })
      .select("id, ticket_number")
      .single();
    if (ticketError || !ticket) throw new Error(ticketError?.message ?? "Could not open a ticket");

    const { error: msgError } = await supabaseAdmin.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      author_id: userId,
      from_staff: false,
      body: data.message,
    });
    if (msgError) throw new Error(msgError.message);

    return { ticketId: ticket.id, ticketNumber: ticket.ticket_number, reused: false as const };
  });

export const createGeneralTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        subject: z.string().trim().min(3).max(120),
        message: z.string().trim().min(8).max(2000),
        orderId: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let orderId: string | null = data.orderId ?? null;
    let merchantReference: string | null = null;

    if (orderId) {
      const { data: order, error } = await supabase
        .from("orders")
        .select("id, merchant_reference, user_id")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!order || order.user_id !== userId) throw new Error("Order not found");
      merchantReference = order.merchant_reference;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const number = ticketNumber();
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        ticket_number: number,
        user_id: userId,
        order_id: orderId,
        merchant_reference: merchantReference,
        subject: data.subject,
        kind: "general",
        status: "open",
      })
      .select("id, ticket_number")
      .single();
    if (isMissingRelation(ticketError)) {
      throw new Error(
        "Support tables are not installed. Run supabase/migrations/20260929120000_support_tickets.sql in the Supabase SQL editor.",
      );
    }
    if (ticketError || !ticket) throw new Error(ticketError?.message ?? "Could not open a ticket");

    const { error: msgError } = await supabaseAdmin.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      author_id: userId,
      from_staff: false,
      body: data.message,
    });
    if (msgError) throw new Error(msgError.message);

    return { ticketId: ticket.id, ticketNumber: ticket.ticket_number };
  });

export const addTicketReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ ticketId: z.string().uuid(), body: z.string().min(2).max(2000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isStaff = (roles ?? []).length > 0;

    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .select("id, user_id, status")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("Ticket not found");
    if (!isStaff && ticket.user_id !== userId) throw new Error("Ticket not found");

    const { error: msgError } = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      author_id: userId,
      from_staff: isStaff,
      body: data.body.trim(),
    });
    if (msgError) throw new Error(msgError.message);

    const nextStatus = isStaff ? "waiting_on_you" : "waiting_on_us";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("support_tickets")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", ticket.id);

    return { ok: true as const };
  });

export const setTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        status: z.enum(["open", "waiting_on_us", "waiting_on_you", "resolved"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    if (!(roles ?? []).length) throw new Error("Staff access required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (isMissingRelation(error)) {
      return { tickets: [], schemaMissing: true as const };
    }
    if (error) throw new Error(error.message);
    return { tickets: data ?? [], schemaMissing: false as const };
  });

export const listStaffTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    if (!(roles ?? []).length) throw new Error("Staff access required.");

    const { data, error } = await context.supabase
      .from("support_tickets")
      .select("*, orders(customer_phone, total_kes, status, merchant_reference, order_items(product_name, quantity))")
      .order("updated_at", { ascending: false });
    if (isMissingRelation(error)) return [];
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const countOpenSupportTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error(roleError.message);
    if (!(roles ?? []).length) throw new Error("Staff access required.");

    const { count, error } = await context.supabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .neq("status", "resolved");
    if (isMissingRelation(error)) return 0;
    if (error) throw new Error(error.message);
    return count ?? 0;
  });
