import { useId, useState, type FormEvent } from "react";
import { CheckCircle2, ChevronDown, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitInterestLead } from "@/lib/interest.functions";
import { COMPANY, supportLinks } from "@/lib/company";
import { cn } from "@/lib/utils";

type InterestFormProps = {
  productId: string;
  productName: string;
  productSlug: string;
  productUnit: string;
  unitPriceKes: number;
  className?: string;
};

export function InterestForm({
  productId,
  productName,
  productSlug,
  productUnit,
  unitPriceKes,
  className,
}: InterestFormProps) {
  const formId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const links = supportLinks({ orderRef: productName });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const fullName = String(data.get("fullName") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const location = String(data.get("location") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const quantityRaw = String(data.get("quantity") ?? "").trim();
    const notes = String(data.get("notes") ?? "").trim();
    const website = String(data.get("website") ?? "");

    const nextErrors: Record<string, string> = {};
    if (fullName.length < 2) nextErrors["fullName"] = "Enter your name";
    if (phone.replace(/\D/g, "").length < 9) nextErrors["phone"] = "Enter a valid phone number";
    if (location.length < 2) nextErrors["location"] = "Enter your location / site";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors["email"] = "Enter a valid email, or leave blank";
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      if (!email && !quantityRaw && !notes && !moreOpen) {
        /* keep more details closed unless they typed invalid email inside */
      } else if (nextErrors["email"] || quantityRaw || notes) {
        setMoreOpen(true);
      }
      toast.error("Please check the highlighted fields.");
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      const result = await submitInterestLead({
        data: {
          productId,
          productName,
          productSlug,
          productUnit,
          unitPriceKes,
          fullName,
          phone,
          location,
          email,
          quantity: quantityRaw ? Number(quantityRaw) : null,
          notes,
          website,
        },
      });
      if (!result.ok) {
        toast.error("Could not send your interest. Please try again.");
        return;
      }
      setSent(true);
      form.reset();
      setMoreOpen(false);
      toast.success(
        result.mailedCustomer
          ? "Interest sent — check your email, and we will call you shortly."
          : "Interest sent — we will call you shortly.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send your interest.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div
        id="express-interest"
        className={cn(
          "scroll-mt-28 rounded-2xl border border-border bg-card/95 p-6 shadow-[var(--shadow-panel)] sm:p-7",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
          <div>
            <h2 className="text-xl tracking-tight">Interest received</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Thanks — an Amplus advisor will reach you on the phone number you shared to confirm{" "}
              <span className="font-medium text-foreground">{productName}</span>, pricing, and
              delivery. No account needed.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-full" asChild>
                <a href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}>
                  <Phone className="size-3.5" /> Call Amplus
                </a>
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" asChild>
                <a href={links.whatsappHref} target="_blank" rel="noreferrer">
                  WhatsApp us
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={() => setSent(false)}
              >
                Send another
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      id="express-interest"
      onSubmit={onSubmit}
      className={cn(
        "relative scroll-mt-28 rounded-2xl border border-border bg-card/95 p-6 shadow-[var(--shadow-panel)] sm:p-7",
        className,
      )}
      noValidate
    >
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent">
        No account needed
      </p>
      <h2 className="mt-2 text-xl tracking-tight">Express interest</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Leave your details — we will call you about {productName} to confirm stock and delivery.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Or reach the yard directly on{" "}
        <a
          href={`tel:${COMPANY.phone.replace(/\s/g, "")}`}
          className="font-medium text-foreground hover:text-accent"
        >
          {COMPANY.phone}
        </a>{" "}
        or{" "}
        <a
          href={`mailto:${COMPANY.email}`}
          className="font-medium text-foreground hover:text-accent"
        >
          {COMPANY.email}
        </a>
        .
      </p>

      {/* Honeypot — visually hidden from humans */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden>
        <label htmlFor={`${formId}-website`}>Website</label>
        <input
          id={`${formId}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`${formId}-name`}>Full name</Label>
          <Input
            id={`${formId}-name`}
            name="fullName"
            autoComplete="name"
            placeholder="Jane Wanjiku"
            className="mt-1.5"
            required
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors["fullName"])}
          />
          {fieldErrors["fullName"] ? (
            <p className="mt-1 text-xs text-destructive">{fieldErrors["fullName"]}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor={`${formId}-phone`}>Phone</Label>
          <Input
            id={`${formId}-phone`}
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="07xx xxx xxx"
            className="mt-1.5"
            required
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors["phone"])}
          />
          {fieldErrors["phone"] ? (
            <p className="mt-1 text-xs text-destructive">{fieldErrors["phone"]}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor={`${formId}-location`}>Location / site</Label>
          <Input
            id={`${formId}-location`}
            name="location"
            autoComplete="address-level2"
            placeholder="e.g. Kitengela, Athi River"
            className="mt-1.5"
            required
            disabled={submitting}
            aria-invalid={Boolean(fieldErrors["location"])}
          />
          {fieldErrors["location"] ? (
            <p className="mt-1 text-xs text-destructive">{fieldErrors["location"]}</p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className="mt-4 flex w-full items-center justify-between gap-2 rounded-lg px-1 py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((open) => !open)}
      >
        <span>
          Add more details <span className="text-muted-foreground/80">(optional)</span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform duration-200",
            moreOpen && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          moreOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="grid gap-4 border-t border-border/70 pt-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor={`${formId}-email`}>
                Email <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`${formId}-email`}
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.co.ke"
                className="mt-1.5"
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors["email"])}
              />
              {fieldErrors["email"] ? (
                <p className="mt-1 text-xs text-destructive">{fieldErrors["email"]}</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  If you leave an email, we will send a short confirmation copy.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor={`${formId}-qty`}>
                Quantity <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`${formId}-qty`}
                name="quantity"
                type="number"
                min={1}
                step="any"
                inputMode="decimal"
                placeholder={`e.g. 20 ${productUnit}`}
                className="mt-1.5"
                disabled={submitting}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`${formId}-notes`}>
                Notes <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id={`${formId}-notes`}
                name="notes"
                rows={3}
                placeholder="Delivery timing, site access, brand preference…"
                className="mt-1.5 resize-y"
                disabled={submitting}
              />
            </div>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        variant="accent"
        size="lg"
        className="mt-5 w-full rounded-full sm:w-auto sm:px-8"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="animate-spin" /> Sending…
          </>
        ) : (
          "Send interest"
        )}
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        By sending, you agree we may contact you about this product on the phone number you provide.
      </p>
    </form>
  );
}
