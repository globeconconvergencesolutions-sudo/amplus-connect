import { Check } from "lucide-react";
import { COMPANY, supportLinks } from "@/lib/company";
import { deliveryLabel, fulfilmentSteps } from "@/lib/fulfilment";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OrderTracking({
  status,
  deliveryOption,
  fulfilmentNote,
  orderRef,
}: {
  status: string;
  deliveryOption: string | null | undefined;
  fulfilmentNote?: string | null | undefined;
  orderRef?: string;
}) {
  const steps = fulfilmentSteps(status, deliveryOption);
  const current = steps.find((step) => step.current) ?? steps.find((step) => !step.done);
  const links = supportLinks(orderRef ? { orderRef } : undefined);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-accent">Delivery</p>
        <p className="mt-1 text-sm font-medium">{deliveryLabel(deliveryOption)}</p>
        {current ? <p className="mt-1 text-sm text-muted-foreground">{current.detail}</p> : null}
      </div>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step.key} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                step.done
                  ? "border-accent bg-accent text-accent-foreground"
                  : step.current
                    ? "border-accent text-accent"
                    : "border-border text-muted-foreground",
              )}
            >
              {step.done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <div>
              <p className={cn("text-sm font-semibold", !step.done && !step.current && "text-muted-foreground")}>
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      {fulfilmentNote ? (
        <p className="rounded-lg bg-secondary/60 p-3 text-sm">
          <span className="font-medium">Yard note: </span>
          {fulfilmentNote}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={links.callHref}>Call {COMPANY.phone}</a>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={links.whatsappHref} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}
