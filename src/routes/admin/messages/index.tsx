import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Mail, MailOpen } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminBulkDeleteBar,
  AdminDeleteButton,
  AdminRowCheckbox,
  AdminSelectAll,
} from "@/components/admin-bulk-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { deleteContactMessages } from "@/lib/admin-delete.functions";
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const rows = useMemo(() => messages.data ?? [], [messages.data]);
  const ids = useMemo(() => rows.map((row) => row.id), [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = ids.some((id) => selected.has(id));

  async function toggleHandled(message: MessageRow) {
    const { error } = await supabase
      .from("contact_messages")
      .update({ handled: !message.handled })
      .eq("id", message.id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
  }

  async function removeMessages(messageIds: string[]) {
    setDeleting(true);
    try {
      const result = await deleteContactMessages({ data: { ids: messageIds } });
      toast.success(`Deleted ${result.deleted} message${result.deleted === 1 ? "" : "s"}`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-count", "contact_messages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-recent-messages"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete messages.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Messages</h1>
          <p className="mt-1 text-sm text-muted-foreground">{rows.length} messages</p>
        </div>
        {ids.length > 0 ? (
          <AdminSelectAll
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onCheckedChange={(next) => setSelected(next ? new Set(ids) : new Set())}
          />
        ) : null}
      </div>

      <div className="mt-6 space-y-3">
        <AdminBulkDeleteBar
          count={selected.size}
          noun="message"
          warning="Selected contact messages will be permanently removed."
          deleting={deleting}
          onClear={() => setSelected(new Set())}
          onConfirm={() => removeMessages([...selected])}
        />
        {rows.map((message) => (
          <div key={message.id} className="panel overflow-hidden">
            <div className="flex items-start gap-3 p-4">
              <div className="pt-1">
                <AdminRowCheckbox
                  checked={selected.has(message.id)}
                  onCheckedChange={(next) => {
                    setSelected((prev) => {
                      const copy = new Set(prev);
                      if (next) copy.add(message.id);
                      else copy.delete(message.id);
                      return copy;
                    });
                  }}
                  label={`Select message from ${message.name}`}
                />
              </div>
              <button
                type="button"
                className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 text-left"
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
            </div>
            {expanded === message.id ? (
              <div className="border-t border-border bg-secondary/30 p-4">
                <p className="text-sm text-muted-foreground">
                  {message.email} {message.phone ? `· ${message.phone}` : ""}
                </p>
                <p className="mt-3 whitespace-pre-line text-sm">{message.message}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`mailto:${message.email}`}>Reply by email</a>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleHandled(message)}>
                    Mark as {message.handled ? "unhandled" : "handled"}
                  </Button>
                  <AdminDeleteButton
                    label={`Delete message from ${message.name}?`}
                    warning="This contact message will be permanently removed."
                    deleting={deleting}
                    onConfirm={() => removeMessages([message.id])}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {!messages.isLoading && rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No messages yet.</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
