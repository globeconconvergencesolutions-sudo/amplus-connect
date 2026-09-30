import { useState } from "react";
import { Building2, Check, Copy, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BANK_ACCOUNT } from "@/lib/company";
import { formatKes } from "@/lib/format";
import { cn } from "@/lib/utils";

function CopyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="min-w-0 break-all font-mono text-base font-semibold leading-snug">{value}</p>
        <Button
          type="button"
          variant={copied ? "secondary" : "outline"}
          size="sm"
          className="shrink-0"
          onClick={() => void copy()}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function BankTransferDetails({
  merchantReference,
  amountKes,
}: {
  merchantReference: string;
  amountKes: number;
}) {
  const [method, setMethod] = useState<"mpesa" | "bank">("mpesa");

  return (
    <div className="space-y-4 text-left">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={cn(
            "flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
            method === "mpesa"
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border bg-background hover:bg-secondary",
          )}
          onClick={() => setMethod("mpesa")}
        >
          <Smartphone className="size-4" />
          M-Pesa
        </button>
        <button
          type="button"
          className={cn(
            "flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
            method === "bank"
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border bg-background hover:bg-secondary",
          )}
          onClick={() => setMethod("bank")}
        >
          <Building2 className="size-4" />
          Bank
        </button>
      </div>

      {method === "mpesa" ? (
        <div className="space-y-3">
          <ol className="space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                1
              </span>
              <span>Open M-Pesa → Lipa na M-Pesa → Pay Bill.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                2
              </span>
              <span>Paste the Pay Bill and account numbers below. Do not type the AMP order code.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                3
              </span>
              <span>Send {formatKes(amountKes)}, then come back and paste your M-Pesa code.</span>
            </li>
          </ol>
          <CopyField label="Pay Bill" value={BANK_ACCOUNT.paybill} />
          <CopyField
            label="Account number"
            value={BANK_ACCOUNT.accountNumber}
            hint="This is the Equity account number, not your order reference."
          />
          <CopyField label="Amount" value={String(Math.round(amountKes))} hint={formatKes(amountKes)} />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Transfer from the Equity app or any bank, then use your order code as the narration.
          </p>
          <CopyField label="Account name" value={BANK_ACCOUNT.accountName} />
          <CopyField label="Bank" value={BANK_ACCOUNT.bankName} />
          <CopyField label="Account number" value={BANK_ACCOUNT.accountNumber} />
          <CopyField
            label="Narration / reference"
            value={merchantReference}
            hint="This AMP code is only for bank transfers, not for M-Pesa Pay Bill."
          />
          <CopyField label="Amount" value={String(Math.round(amountKes))} hint={formatKes(amountKes)} />
        </div>
      )}
    </div>
  );
}
