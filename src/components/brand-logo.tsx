import { COMPANY } from "@/lib/company";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/amplus-logo.png";

const SIZE = {
  header: "h-12 w-auto sm:h-14",
  footer: "h-14 w-auto sm:h-16",
  auth: "h-16 w-auto",
  admin: "h-11 w-auto max-w-[11.5rem]",
} as const;

export function BrandLogo({
  variant = "header",
  inverted = false,
  className,
}: {
  variant?: keyof typeof SIZE;
  inverted?: boolean;
  className?: string;
}) {
  return (
    <img
      src={LOGO_SRC}
      alt={COMPANY.name}
      className={cn(
        "shrink-0 object-contain object-left",
        SIZE[variant],
        inverted && "brightness-0 invert",
        className,
      )}
    />
  );
}
