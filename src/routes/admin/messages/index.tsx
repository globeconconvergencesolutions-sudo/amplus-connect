import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Mail, MailOpen } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

type MessageRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  handled: boolean;
  created_at: string;
};

export const Route = createFileRoute("/admin/messages/")({
  component: AdminMessagesPage,
});

function useAllMessages() {
  return useQuery({
    queryKey: ["admin-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as MessageRow[];
    },
  });
}

function AdminMessagesPage() {
  const messages = useAllMessages();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  async function toggleHandled(message: MessageRow) {
    const { error } = await supabase
      .from("contact_messages")
      .update({ handled: !message.handled })
      .eq("id", message.id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
  }

  return (
    <AdminShell>
      <h1 className="text-2xl">Messages</h1>
      <p className="mt-1 text-sm text-muted-foreground">{messages.data?.length ?? 0} messages</p>

      <div className="mt-6 space-y-3">
        {(messages.data ?? []).map((message) => (
          <div key={message.id} className="panel overflow-hidden">
            <button
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
              onClick={() => setExpanded(expanded === message.id ? null : message.id)}
            >
              <div className="flex items-center gap-3">
                {message.handled ? (
                  <MailOpen className="size-4 text-muted-foreground" />
                ) : (
                  <Mail className="size-4 text-accent" />
                )}
                <div>
                  <p className="font-medium">
                    {message.name}{" "}
                    {!message.handled ? (
                      <Badge className="ml-2 bg-accent text-accent-foreground">New</Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {message.subject || message.email} · {formatDate(message.created_at)}
                  </p>
                </div>
              </div>
            </button>
            {expanded === message.id ? (
              <div className="border-t border-border bg-secondary/30 p-4">
                <p className="text-sm text-muted-foreground">
                  {message.email} {message.phone ? `· ${message.phone}` : ""}
                </p>
                <p className="mt-3 whitespace-pre-line text-sm">{message.message}</p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`mailto:${message.email}`}>Reply by email</a>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleHandled(message)}>
                    Mark as {message.handled ? "unhandled" : "handled"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {!messages.isLoading && (messages.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No messages yet.</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
