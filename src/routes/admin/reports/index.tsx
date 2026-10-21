import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  Download,
  FileSpreadsheet,
  Loader2,
  Package,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateStockSalesReport, listReportFilters } from "@/lib/reports.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/reports/")({
  component: AdminReportsPage,
});

type Mode = "all" | "brand" | "category";

function downloadBase64File(filename: string, mimeType: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function AdminReportsPage() {
  const filters = useQuery({
    queryKey: ["admin-report-filters"],
    queryFn: () => listReportFilters(),
  });

  const [mode, setMode] = useState<Mode>("all");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [lastMeta, setLastMeta] = useState<{
    filename: string;
    familyLabel: string;
    productCount: number;
    salesLineCount: number;
    openLineCount: number;
    leadCount: number;
  } | null>(null);

  useEffect(() => {
    if (!filters.data) return;
    if (!fromDate) setFromDate(filters.data.defaults.fromDate);
    if (!toDate) setToDate(filters.data.defaults.toDate);
    if (!brand && filters.data.brands.includes("Sato")) setBrand("Sato");
  }, [filters.data, fromDate, toDate, brand]);

  const brands = filters.data?.brands ?? [];
  const categories = filters.data?.categories ?? [];

  const familyPreview = useMemo(() => {
    if (mode === "brand") return brand.trim() || "Choose a brand";
    if (mode === "category") {
      const list = filters.data?.categories ?? [];
      return list.find((c) => c.id === categoryId)?.name ?? "Choose a category";
    }
    return "All products";
  }, [mode, brand, categoryId, filters.data?.categories]);

  async function onGenerate() {
    if (!fromDate || !toDate) {
      toast.error("Choose a from and to date.");
      return;
    }
    if (mode === "brand" && !brand.trim()) {
      toast.error("Choose a brand / product family.");
      return;
    }
    if (mode === "category" && !categoryId) {
      toast.error("Choose a category.");
      return;
    }

    setGenerating(true);
    try {
      const result = await generateStockSalesReport({
        data: {
          mode,
          brand: mode === "brand" ? brand.trim() : "",
          categoryId: mode === "category" ? categoryId : null,
          fromDate,
          toDate,
        },
      });
      downloadBase64File(result.filename, result.mimeType, result.base64);
      setLastMeta({
        filename: result.filename,
        familyLabel: result.meta.familyLabel,
        productCount: result.meta.productCount,
        salesLineCount: result.meta.salesLineCount,
        openLineCount: result.meta.openLineCount,
        leadCount: result.meta.leadCount,
      });
      toast.success(`Downloaded ${result.filename}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not generate the report.";
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent">
            Documentation
          </p>
          <h1 className="mt-1 text-2xl tracking-tight sm:text-3xl">Reports</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Generate a professional Excel stock &amp; sales workbook for a product family (for
            example Sato Pan / Flex / Stool) — cleaner and clearer than the old recon sheets.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <FileSpreadsheet className="size-3.5 text-accent" />
          .xlsx download
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="panel p-6 sm:p-7">
          <h2 className="text-lg tracking-tight">Stock &amp; sales workbook</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Includes Summary, Stock by SKU, Sales ledger, Open unpaid, By customer, and Interest
            leads.
          </p>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Product family
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { id: "all", label: "All products" },
                  { id: "brand", label: "By brand / family" },
                  { id: "category", label: "By category" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setMode(option.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                    mode === option.id
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {mode === "brand" ? (
              <div className="mt-4">
                <Label htmlFor="report-brand">Brand / family</Label>
                {brands.length > 0 ? (
                  <select
                    id="report-brand"
                    className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={brand}
                    onChange={(event) => setBrand(event.target.value)}
                  >
                    <option value="">Select brand…</option>
                    {brands.map((row) => (
                      <option key={row} value={row}>
                        {row}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="report-brand"
                    className="mt-1.5"
                    placeholder="e.g. Sato"
                    value={brand}
                    onChange={(event) => setBrand(event.target.value)}
                  />
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Matches products whose brand equals the family, or whose name contains it (e.g.
                  Sato Pan).
                </p>
              </div>
            ) : null}

            {mode === "category" ? (
              <div className="mt-4">
                <Label htmlFor="report-category">Category</Label>
                <select
                  id="report-category"
                  className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Select category…</option>
                  {categories.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="report-from">From</Label>
              <Input
                id="report-from"
                type="date"
                className="mt-1.5"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="report-to">To</Label>
              <Input
                id="report-to"
                type="date"
                className="mt-1.5"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                { label: "Last 7 days", days: 7 },
                { label: "Last 30 days", days: 30 },
                { label: "This month", days: "month" as const },
              ] as const
            ).map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  const to = new Date();
                  const from = new Date();
                  if (preset.days === "month") {
                    from.setDate(1);
                  } else {
                    from.setDate(from.getDate() - preset.days);
                  }
                  setFromDate(from.toISOString().slice(0, 10));
                  setToDate(to.toISOString().slice(0, 10));
                }}
              >
                <CalendarRange className="size-3.5" />
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button
              variant="accent"
              size="lg"
              className="rounded-full px-6"
              disabled={generating || filters.isLoading}
              onClick={() => void onGenerate()}
            >
              {generating ? (
                <>
                  <Loader2 className="animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Download /> Download Excel
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              Preview family: <span className="font-medium text-foreground">{familyPreview}</span>
            </p>
          </div>

          {filters.isError ? (
            <p className="mt-4 text-sm text-destructive">
              {filters.error instanceof Error
                ? filters.error.message
                : "Could not load report filters."}
            </p>
          ) : null}
        </section>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h3 className="text-sm font-semibold">What you get</h3>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <Package className="mt-0.5 size-4 shrink-0 text-accent" />
                Stock on hand per SKU with unit price and period sales
              </li>
              <li className="flex gap-2">
                <ShoppingBag className="mt-0.5 size-4 shrink-0 text-accent" />
                Confirmed sales ledger + open/unpaid lines
              </li>
              <li className="flex gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
                Interest leads for the same family (demand, not sales)
              </li>
            </ul>
          </div>

          {lastMeta ? (
            <div className="panel border-accent/30 bg-accent/5 p-5">
              <h3 className="text-sm font-semibold">Last download</h3>
              <p className="mt-1 truncate text-xs text-muted-foreground">{lastMeta.filename}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Family</dt>
                  <dd className="font-medium">{lastMeta.familyLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">SKUs</dt>
                  <dd className="font-medium">{lastMeta.productCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Sales lines</dt>
                  <dd className="font-medium">{lastMeta.salesLineCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Open unpaid</dt>
                  <dd className="font-medium">{lastMeta.openLineCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Leads</dt>
                  <dd className="font-medium">{lastMeta.leadCount}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="panel border-dashed p-5 text-sm text-muted-foreground">
              Tip: set product <span className="font-medium text-foreground">brand</span> to{" "}
              <span className="font-medium text-foreground">Sato</span> on Pan / Flex / Stool SKUs
              so family reports group cleanly — the way the old recon columns worked.
            </div>
          )}
        </aside>
      </div>
    </AdminShell>
  );
}
