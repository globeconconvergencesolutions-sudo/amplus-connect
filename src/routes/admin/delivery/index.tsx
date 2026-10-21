import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DeliveryMap } from "@/components/delivery-map";
import { supabase } from "@/integrations/supabase/client";
import { deliveryBandsQuery, deliveryDropPointsQuery, deliverySettingsQuery } from "@/lib/catalog";
import { formatKes } from "@/lib/format";
import { KENYA_COUNTIES, type DeliveryBand, type DeliveryDropPoint } from "@/lib/delivery";

export const Route = createFileRoute("/admin/delivery/")({
  component: AdminDeliveryPage,
});

function AdminDeliveryPage() {
  const settings = useQuery(deliverySettingsQuery());
  const bands = useQuery(deliveryBandsQuery());
  const points = useQuery(deliveryDropPointsQuery({ staff: true }));
  const queryClient = useQueryClient();
  const [editingBand, setEditingBand] = useState<DeliveryBand | "new" | null>(null);
  const [editingPoint, setEditingPoint] = useState<DeliveryDropPoint | "new" | null>(null);
  const [saving, setSaving] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["delivery-settings"] });
    queryClient.invalidateQueries({ queryKey: ["delivery-bands"] });
    queryClient.invalidateQueries({ queryKey: ["delivery-drop-points"] });
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const { error } = await supabase
      .from("delivery_settings")
      .update({
        hq_label: String(form.get("hq_label") ?? "").trim(),
        hq_lat: Number(form.get("hq_lat")),
        hq_lng: Number(form.get("hq_lng")),
        road_factor: Number(form.get("road_factor")),
        max_km: Number(form.get("max_km")),
        quote_phone: String(form.get("quote_phone") ?? "").trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error(
        error.message.includes("schema cache") || error.code === "PGRST205"
          ? "Run supabase/migrations/20261009120000_delivery_zones.sql on the live project first."
          : error.message,
      );
      return;
    }
    toast.success("Yard and pricing rules saved");
    invalidate();
  }

  const hq = {
    lat: Number(settings.data?.hq_lat ?? -1.3308),
    lng: Number(settings.data?.hq_lng ?? 36.8605),
    label: settings.data?.hq_label ?? "Amplus yard",
  };

  return (
    <AdminShell>
      <h1 className="text-2xl">Delivery</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Fees are calculated from the yard pin to a drop point or a customer pin. Checkout never
        trusts a fee typed in the browser.
      </p>

      <form onSubmit={saveSettings} className="panel mt-6 grid gap-4 p-5 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="hq_label">Yard / HQ label</Label>
          <Input
            id="hq_label"
            name="hq_label"
            defaultValue={settings.data?.hq_label ?? ""}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="hq_lat">HQ latitude</Label>
          <Input
            id="hq_lat"
            name="hq_lat"
            type="number"
            step="any"
            defaultValue={settings.data?.hq_lat ?? -1.3308}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="hq_lng">HQ longitude</Label>
          <Input
            id="hq_lng"
            name="hq_lng"
            type="number"
            step="any"
            defaultValue={settings.data?.hq_lng ?? 36.8605}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="road_factor">Road factor (straight-line × this)</Label>
          <Input
            id="road_factor"
            name="road_factor"
            type="number"
            step="0.05"
            min="1"
            defaultValue={settings.data?.road_factor ?? 1.3}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="max_km">Max standard km</Label>
          <Input
            id="max_km"
            name="max_km"
            type="number"
            min="1"
            defaultValue={settings.data?.max_km ?? 600}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="quote_phone">Phone for over-radius quotes</Label>
          <Input
            id="quote_phone"
            name="quote_phone"
            defaultValue={settings.data?.quote_phone ?? ""}
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" variant="accent" disabled={saving}>
            Save yard settings
          </Button>
        </div>
      </form>

      <div className="mt-6">
        <DeliveryMap hq={hq} dropPoints={points.data ?? []} />
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-lg">Distance bands</h2>
        <Button size="sm" onClick={() => setEditingBand("new")}>
          <Plus /> Add band
        </Button>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2">From km</th>
              <th>To km</th>
              <th>Fee</th>
              <th>Days</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(bands.data ?? []).map((band) => (
              <tr key={band.id} className="border-t border-border">
                <td className="py-2">{band.km_from}</td>
                <td>{band.km_to}</td>
                <td>{formatKes(band.fee_kes)}</td>
                <td>{band.eta_days}</td>
                <td className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setEditingBand(band)}>
                    <Pencil className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-lg">Drop points</h2>
        <Button size="sm" onClick={() => setEditingPoint("new")}>
          <Plus /> Add drop point
        </Button>
      </div>
      <ul className="mt-3 space-y-2">
        {(points.data ?? []).map((point) => (
          <li
            key={point.id}
            className="panel flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {point.name}
                {!point.is_active ? (
                  <span className="ml-2 text-xs text-muted-foreground">(hidden)</span>
                ) : null}
              </p>
              <p className="text-sm text-muted-foreground">
                {point.landmark} · {point.town}, {point.county}
                {point.fee_override_kes != null
                  ? ` · override ${formatKes(point.fee_override_kes)}`
                  : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditingPoint(point)}>
                <Pencil className="size-4" /> Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost">
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {point.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Customers will no longer see this drop point.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        const { error } = await supabase
                          .from("delivery_drop_points")
                          .delete()
                          .eq("id", point.id);
                        if (error) toast.error(error.message);
                        else {
                          toast.success("Drop point deleted");
                          invalidate();
                        }
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </li>
        ))}
      </ul>

      <BandDialog
        band={editingBand}
        onClose={() => setEditingBand(null)}
        onSaved={() => {
          setEditingBand(null);
          invalidate();
        }}
      />
      <PointDialog
        point={editingPoint}
        hq={hq}
        onClose={() => setEditingPoint(null)}
        onSaved={() => {
          setEditingPoint(null);
          invalidate();
        }}
      />
    </AdminShell>
  );
}

function BandDialog({
  band,
  onClose,
  onSaved,
}: {
  band: DeliveryBand | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = band === "new";
  const current = isNew ? null : band;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      km_from: Number(form.get("km_from")),
      km_to: Number(form.get("km_to")),
      fee_kes: Number(form.get("fee_kes")),
      eta_days: Number(form.get("eta_days")),
      sort_order: Number(form.get("sort_order") ?? 0),
    };
    const result = isNew
      ? await supabase.from("delivery_bands").insert(payload)
      : await supabase.from("delivery_bands").update(payload).eq("id", current!.id);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(isNew ? "Band added" : "Band updated");
      onSaved();
    }
  }

  return (
    <Dialog open={band !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Add band" : "Edit band"}</DialogTitle>
        </DialogHeader>
        {band ? (
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="km_from">From km</Label>
              <Input
                id="km_from"
                name="km_from"
                type="number"
                step="0.1"
                defaultValue={current?.km_from ?? 0}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="km_to">To km</Label>
              <Input
                id="km_to"
                name="km_to"
                type="number"
                step="0.1"
                defaultValue={current?.km_to ?? 15}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fee_kes">Fee (KES)</Label>
              <Input
                id="fee_kes"
                name="fee_kes"
                type="number"
                defaultValue={current?.fee_kes ?? 1500}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="eta_days">Working days</Label>
              <Input
                id="eta_days"
                name="eta_days"
                type="number"
                min="0"
                defaultValue={current?.eta_days ?? 2}
                required
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="sort_order">Sort</Label>
              <Input
                id="sort_order"
                name="sort_order"
                type="number"
                defaultValue={current?.sort_order ?? 0}
              />
            </div>
            <Button type="submit" variant="accent" className="sm:col-span-2">
              Save
            </Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PointDialog({
  point,
  hq,
  onClose,
  onSaved,
}: {
  point: DeliveryDropPoint | "new" | null;
  hq: { lat: number; lng: number; label: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = point === "new";
  const current = isNew ? null : point;
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const shown = pin ?? (current ? { lat: current.lat, lng: current.lng } : null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const override = String(form.get("fee_override_kes") ?? "").trim();
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      county: String(form.get("county") ?? "").trim(),
      town: String(form.get("town") ?? "").trim(),
      landmark: String(form.get("landmark") ?? "").trim(),
      lat: Number(form.get("lat")),
      lng: Number(form.get("lng")),
      fee_override_kes: override === "" ? null : Number(override),
      notes: String(form.get("notes") ?? "").trim() || null,
      is_active: String(form.get("is_active")) === "on",
      sort_order: Number(form.get("sort_order") ?? 0),
    };
    const result = isNew
      ? await supabase.from("delivery_drop_points").insert(payload)
      : await supabase.from("delivery_drop_points").update(payload).eq("id", current!.id);
    if (result.error) toast.error(result.error.message);
    else {
      toast.success(isNew ? "Drop point added" : "Drop point updated");
      onSaved();
    }
  }

  return (
    <Dialog
      open={point !== null}
      onOpenChange={(open) => {
        if (!open) {
          setPin(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add drop point" : "Edit drop point"}</DialogTitle>
        </DialogHeader>
        {point ? (
          <form onSubmit={onSubmit} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={current?.name ?? ""} required />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="county">County</Label>
                <select
                  id="county"
                  name="county"
                  defaultValue={current?.county ?? "Nairobi"}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {KENYA_COUNTIES.map((county) => (
                    <option key={county} value={county}>
                      {county}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="town">Town</Label>
                <Input id="town" name="town" defaultValue={current?.town ?? ""} required />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="landmark">Landmark</Label>
              <Input
                id="landmark"
                name="landmark"
                defaultValue={current?.landmark ?? ""}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">Tap the map to set coordinates.</p>
            <DeliveryMap hq={hq} pin={shown} onPin={setPin} interactive />
            <div className="grid grid-cols-2 gap-2">
              <Input
                name="lat"
                type="number"
                step="any"
                required
                value={shown?.lat ?? ""}
                readOnly
              />
              <Input
                name="lng"
                type="number"
                step="any"
                required
                value={shown?.lng ?? ""}
                readOnly
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fee_override_kes">Fee override (blank = use bands)</Label>
              <Input
                id="fee_override_kes"
                name="fee_override_kes"
                type="number"
                defaultValue={current?.fee_override_kes ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Driver notes</Label>
              <Textarea id="notes" name="notes" rows={2} defaultValue={current?.notes ?? ""} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_active" defaultChecked={current?.is_active ?? true} />
              Visible at checkout
            </label>
            <Input type="hidden" name="sort_order" defaultValue={current?.sort_order ?? 0} />
            <Button type="submit" variant="accent">
              Save drop point
            </Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
