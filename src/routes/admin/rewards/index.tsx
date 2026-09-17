import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { loyaltySettingsQuery } from "@/lib/catalog";

export const Route = createFileRoute("/admin/rewards/")({
  component: AdminRewardsPage,
});

function AdminRewardsPage() {
  const settings = useQuery(loyaltySettingsQuery());
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      kes_per_point: Number(form.get("kes_per_point") ?? 100),
      point_value_kes: Number(form.get("point_value_kes") ?? 1),
      silver_threshold: Number(form.get("silver_threshold") ?? 500),
      gold_threshold: Number(form.get("gold_threshold") ?? 2000),
      max_redeem_percent: Number(form.get("max_redeem_percent") ?? 20),
    };

    setSaving(true);
    const { error } = await supabase.from("loyalty_settings").update(payload).eq("id", 1);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Loyalty settings updated");
    queryClient.invalidateQueries({ queryKey: ["loyalty-settings"] });
  }

  if (settings.isLoading) {
    return (
      <AdminShell>
        <div className="h-64 animate-pulse rounded-lg bg-secondary" />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1 className="text-2xl">Rewards programme</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tune how customers earn and redeem loyalty points storewide.
      </p>

      <form onSubmit={onSubmit} className="panel mt-6 max-w-xl space-y-5 p-6">
        <div className="grid gap-2">
          <Label htmlFor="kes_per_point">KES spent per point earned</Label>
          <Input
            id="kes_per_point"
            name="kes_per_point"
            type="number"
            step="0.01"
            min="1"
            defaultValue={settings.data?.kes_per_point ?? 100}
          />
          <p className="text-xs text-muted-foreground">
            e.g. 100 means a customer earns 1 point for every KES 100 spent.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="point_value_kes">Redemption value per point (KES)</Label>
          <Input
            id="point_value_kes"
            name="point_value_kes"
            type="number"
            step="0.01"
            min="0"
            defaultValue={settings.data?.point_value_kes ?? 1}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="silver_threshold">Silver tier from (points)</Label>
            <Input
              id="silver_threshold"
              name="silver_threshold"
              type="number"
              min="0"
              defaultValue={settings.data?.silver_threshold ?? 500}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gold_threshold">Gold tier from (points)</Label>
            <Input
              id="gold_threshold"
              name="gold_threshold"
              type="number"
              min="0"
              defaultValue={settings.data?.gold_threshold ?? 2000}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="max_redeem_percent">Max % of an order payable with points</Label>
          <Input
            id="max_redeem_percent"
            name="max_redeem_percent"
            type="number"
            min="0"
            max="100"
            defaultValue={settings.data?.max_redeem_percent ?? 20}
          />
        </div>
        <Button type="submit" variant="accent" size="lg" disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </AdminShell>
  );
}
