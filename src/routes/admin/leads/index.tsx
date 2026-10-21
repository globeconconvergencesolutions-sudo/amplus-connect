import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, Mail, Phone, Sparkles } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { deleteInterestLeads } from "@/lib/admin-delete.functions";
import { formatDate, formatKes } from "@/lib/format";
import { isMissingRelation } from "@/lib/supabase-errors";
import { customerWhatsAppHref } from "@/lib/company";
import { cn } from "@/lib/utils";

type LeadStatus = "new" | "contacted" | "closed";

type LeadRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  product_slug: string | null;
  product_unit: string | null;
  unit_price_kes: number | null;
  full_name: string;
  phone: string;
  location: string;
  email: string | null;
  quantity: number | null;
  notes: string | null;
  status: LeadStatus;
  staff_note: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  closed: "Closed",
};

const STATUS_FILTERS: Array<LeadStatus | "all"> = ["all", "new", "contacted", "closed"];

export const Route = createFileRoute("/admin/leads/")({
  component: AdminLeadsPage,
});

function useLeads() {
  return useQuery({
    queryKey: ["admin-interest-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interest_leads")
        .select(
          "id, product_id, product_name, product_slug, product_unit, unit_price_kes, full_name, phone, location, email, quantity, notes, status, staff_note, created_at",
        )
        .order("created_at", { ascending: false });
      if (isMissingRelation(error)) {
        throw new Error(
          "Interest leads table is missing. Run supabase/migrations/20261019120000_interest_leads.sql (or npm run apply:interest-leads).",
        );
      }
      if (error) throw new Error(error.message);
      return (data ?? []) as LeadRow[];
    },
  });
}

function AdminLeadsPage() {
  const leads = useLeads();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const rows = leads.data ?? [];
    const byStatus = filter === "all" ? rows : rows.filter((row) => row.status === filter);
    const q = query.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((row) =>
      [row.full_name, row.phone, row.email, row.product_name, row.location, row.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [leads.data, filter, query]);

  const filteredIds = useMemo(() => filtered.map((row) => row.id), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someFilteredSelected = filteredIds.some((id) => selected.has(id));

  const newCount = (leads.data ?? []).filter((row) => row.status === "new").length;

  function toggleSelected(id: string, next: boolean) {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  async function removeLeads(ids: string[]) {
    setDeleting(true);
    try {
      const result = await deleteInterestLeads({ data: { ids } });
      toast.success(`Deleted ${result.deleted} lead${result.deleted === 1 ? "" : "s"}`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-interest-leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin-count", "interest_leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin-recent-leads"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete leads.");
    } finally {
      setDeleting(false);
    }
  }

  async function setStatus(lead: LeadRow, status: LeadStatus) {
    setSavingId(lead.id);
    const { error } = await supabase.from("interest_leads").update({ status }).eq("id", lead.id);
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Marked as ${STATUS_LABEL[status].toLowerCase()}`);
    queryClient.invalidateQueries({ queryKey: ["admin-interest-leads"] });
    queryClient.invalidateQueries({ queryKey: ["admin-count", "interest_leads"] });
  }

  async function saveStaffNote(lead: LeadRow) {
    const note = (draftNotes[lead.id] ?? lead.staff_note ?? "").trim();
    setSavingId(lead.id);
    const { error } = await supabase
      .from("interest_leads")
      .update({ staff_note: note || null })
      .eq("id", lead.id);
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Staff note saved");
    queryClient.invalidateQueries({ queryKey: ["admin-interest-leads"] });
  }

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Interest leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Expressions of interest from the shop — call or WhatsApp while the lead is warm.
          </p>
        </div>
        {newCount > 0 ? (
          <Badge className="bg-accent text-accent-foreground">
            <Sparkles className="mr-1 size-3.5" />
            {newCount} new
          </Badge>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full flex-col gap-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, phone, product…"
            className="w-full sm:max-w-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={filter === key ? "accent" : "outline"}
                className="rounded-full"
                onClick={() => setFilter(key)}
              >
                {key === "all" ? "All" : STATUS_LABEL[key]}
                {key !== "all" ? (
                  <span className="ml-1.5 text-xs opacity-70">
                    {(leads.data ?? []).filter((row) => row.status === key).length}
                  </span>
                ) : null}
              </Button>
            ))}
          </div>
        </div>
        {filteredIds.length > 0 ? (
          <AdminSelectAll
            checked={allFilteredSelected}
            indeterminate={someFilteredSelected && !allFilteredSelected}
            onCheckedChange={(next) => {
              setSelected((prev) => {
                const copy = new Set(prev);
                for (const id of filteredIds) {
                  if (next) copy.add(id);
                  else copy.delete(id);
                }
                return copy;
              });
            }}
            label="Select visible"
          />
        ) : null}
      </div>

      {leads.isError ? (
        <p className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {leads.error.message}
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        <AdminBulkDeleteBar
          count={selected.size}
          noun="lead"
          warning="Selected interest leads will be permanently removed. This cannot be undone."
          deleting={deleting}
          onClear={() => setSelected(new Set())}
          onConfirm={() => removeLeads([...selected])}
        />
        {filtered.map((lead) => {
          const open = expanded === lead.id;
          const tel = lead.phone.replace(/\s/g, "");
          const first = lead.full_name.trim().split(/\s+/)[0] || lead.full_name;
          const wa = customerWhatsAppHref(
            lead.phone,
            `Hi ${first}, re your interest in ${lead.product_name} for ${lead.location}`,
          );
          return (
            <div key={lead.id} className="panel overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <div className="pt-1">
                  <AdminRowCheckbox
                    checked={selected.has(lead.id)}
                    onCheckedChange={(next) => toggleSelected(lead.id, next)}
                    label={`Select ${lead.full_name}`}
                  />
                </div>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 text-left"
                  onClick={() => setExpanded(open ? null : lead.id)}
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {lead.full_name}
                      {lead.status === "new" ? (
                        <Badge className="ml-2 bg-accent text-accent-foreground">New</Badge>
                      ) : (
                        <Badge variant="secondary" className="ml-2">
                          {STATUS_LABEL[lead.status]}
                        </Badge>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {lead.product_name}
                      {lead.quantity != null
                        ? ` · qty ${lead.quantity}${lead.product_unit ? ` ${lead.product_unit}` : ""}`
                        : ""}
                      {" · "}
                      {lead.location}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{formatDate(lead.created_at)}</p>
                    <p className="mt-0.5 font-medium text-foreground">{lead.phone}</p>
                  </div>
                </button>
              </div>

              {open ? (
                <div className="border-t border-border bg-secondary/30 p-4">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Product
                      </dt>
                      <dd className="mt-0.5 font-medium">
                        {lead.product_slug ? (
                          <Link
                            to="/products/$slug"
                            params={{ slug: lead.product_slug }}
                            className="inline-flex items-center gap-1 hover:text-accent"
                            target="_blank"
                          >
                            {lead.product_name}
                            <ExternalLink className="size-3.5" />
                          </Link>
                        ) : (
                          lead.product_name
                        )}
                        {lead.unit_price_kes != null ? (
                          <span className="ml-2 text-muted-foreground">
                            {formatKes(lead.unit_price_kes)}
                            {lead.product_unit ? ` / ${lead.product_unit}` : ""}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Location
                      </dt>
                      <dd className="mt-0.5">{lead.location}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Phone
                      </dt>
                      <dd className="mt-0.5">{lead.phone}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        Email
                      </dt>
                      <dd className="mt-0.5">{lead.email ?? "—"}</dd>
                    </div>
                    {lead.quantity != null ? (
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                          Quantity
                        </dt>
                        <dd className="mt-0.5">
                          {lead.quantity}
                          {lead.product_unit ? ` ${lead.product_unit}` : ""}
                        </dd>
                      </div>
                    ) : null}
                    {lead.notes ? (
                      <div className="sm:col-span-2">
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                          Customer notes
                        </dt>
                        <dd className="mt-0.5 whitespace-pre-line">{lead.notes}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="mt-4">
                    <label
                      htmlFor={`staff-note-${lead.id}`}
                      className="text-xs uppercase tracking-wide text-muted-foreground"
                    >
                      Staff note
                    </label>
                    <Textarea
                      id={`staff-note-${lead.id}`}
                      className="mt-1.5"
                      rows={2}
                      value={draftNotes[lead.id] ?? lead.staff_note ?? ""}
                      onChange={(event) =>
                        setDraftNotes((prev) => ({ ...prev, [lead.id]: event.target.value }))
                      }
                      placeholder="Call outcome, quote given, next step…"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={`tel:${tel}`}>
                        <Phone className="size-3.5" /> Call
                      </a>
                    </Button>
                    {wa ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={wa} target="_blank" rel="noreferrer">
                          WhatsApp
                        </a>
                      </Button>
                    ) : null}
                    {lead.email ? (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`mailto:${lead.email}?subject=${encodeURIComponent(`Re: ${lead.product_name}`)}`}
                        >
                          <Mail className="size-3.5" /> Email
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={savingId === lead.id}
                      onClick={() => saveStaffNote(lead)}
                    >
                      Save note
                    </Button>
                    <AdminDeleteButton
                      label={`Delete lead from ${lead.full_name}?`}
                      warning="This interest lead will be permanently removed."
                      deleting={deleting}
                      onConfirm={() => removeLeads([lead.id])}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                    {(["new", "contacted", "closed"] as LeadStatus[]).map((status) => (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant={lead.status === status ? "accent" : "outline"}
                        className={cn(
                          "rounded-full",
                          lead.status === status && "pointer-events-none",
                        )}
                        disabled={savingId === lead.id || lead.status === status}
                        onClick={() => setStatus(lead, status)}
                      >
                        {STATUS_LABEL[status]}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        {!leads.isLoading && !leads.isError && filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {filter === "all"
              ? "No interest leads yet."
              : `No ${STATUS_LABEL[filter].toLowerCase()} leads.`}
          </p>
        ) : null}
      </div>
    </AdminShell>
  );
}
