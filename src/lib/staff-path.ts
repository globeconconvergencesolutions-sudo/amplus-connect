/** Only staff destinations. Anything else, including an off-site URL, goes to the admin home. */
export function staffNextPath(value: string | undefined): string {
  const fallback = "/admin";
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  const path = value.split("?")[0]?.split("#")[0] ?? "";
  const allowed =
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/cart" ||
    path === "/checkout" ||
    path.startsWith("/checkout/") ||
    path === "/account" ||
    path.startsWith("/account/");
  return allowed ? value : fallback;
}
