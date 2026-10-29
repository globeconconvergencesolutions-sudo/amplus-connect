import { COMPANY } from "@/lib/company";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/amplus-logo.png";

const SIZE = {
  header: "h-12 w-auto sm:h-14",
  footer: "h-14 w-auto sm:h-16",
  auth: "h-16 w-auto",
  admin: "h-10 w-auto max-w-[10.5rem]",
} as const;

/**
 * Construction mark is purple + orange on transparent.
 * On dark ink surfaces, sit it on a paper chip — never CSS invert
 * (invert turns the whole mark into a white slab).
 */
export function BrandLogo({
  variant = "header",
  inverted = false,
  className,
}: {
  variant?: keyof typeof SIZE;
  inverted?: boolean;
  className?: string;
}) {
  const mark = (
    <img
      src={LOGO_SRC}
      alt={COMPANY.name}
      className={cn(
        "shrink-0 object-contain object-left",
        SIZE[variant],
        !inverted && className,
      )}
    />
  );

  if (!inverted) return mark;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-[#FAF7F2] px-2.5 py-1.5 shadow-[0_1px_0_oklch(0_0_0/0.06)] ring-1 ring-black/5",
        className,
      )}
    >
      {mark}
    </span>
  );
}
