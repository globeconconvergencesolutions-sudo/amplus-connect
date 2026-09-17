import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { PageShell, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});

function ContactPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const subject = String(form.get("subject") ?? "").trim();
    const message = String(form.get("message") ?? "").trim();

    if (!name || !email || !message) {
      toast.error("Please fill in your name, email and message.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("contact_messages").insert({
      name,
      email,
      phone: phone || null,
      subject: subject || null,
      message,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Could not send your message. Please try again.");
      return;
    }
    setSent(true);
    toast.success("Message sent. We'll be in touch shortly.");
    event.currentTarget.reset();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Get in touch"
        title="Contact us"
        description="Tell us about your project or materials order and our team will respond within one working day."
      />

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h2 className="text-xl">Contact details</h2>
            <ul className="mt-5 space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 text-accent" />
                <span>{COMPANY.address}</span>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="mt-0.5 size-5 text-accent" />
                <a href={`tel:${COMPANY.phone.replace(/\s/g, "")}`} className="hover:text-accent">
                  {COMPANY.phone}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 size-5 text-accent" />
                <a href={`mailto:${COMPANY.email}`} className="hover:text-accent">
                  {COMPANY.email}
                </a>
              </li>
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">{COMPANY.hours}</p>
          </div>

          <div className="panel p-6 lg:col-span-3 sm:p-8">
            {sent ? (
              <div className="py-10 text-center">
                <h2 className="text-xl">Thank you</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your message has been received. We'll get back to you shortly.
                </p>
                <Button variant="outline" className="mt-6" onClick={() => setSent(false)}>
                  Send another message
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" name="name" required autoComplete="name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input id="phone" name="phone" type="tel" autoComplete="tel" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" name="subject" placeholder="Project enquiry, order query…" />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" name="message" rows={6} required />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" variant="accent" size="lg" disabled={submitting}>
                    {submitting ? "Sending…" : "Send message"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <div className="panel overflow-hidden">
          <iframe
            title="Amplus location map"
            className="h-80 w-full"
            loading="lazy"
            src={`https://www.google.com/maps?q=${encodeURIComponent(COMPANY.mapQuery)}&output=embed`}
          />
        </div>
      </section>
    </PageShell>
  );
}
