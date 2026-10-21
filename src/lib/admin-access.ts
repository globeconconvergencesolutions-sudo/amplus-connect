/** UI-only admin route access. Server/RLS tightening is deferred. */

export const APP_ROLES = [
  "super_admin",
  "content_manager",
  "ecommerce_manager",
  "rewards_manager",
  "viewer",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

const ALL_STAFF: readonly AppRole[] = APP_ROLES;

type RouteAccess = {
  path: string;
  roles: readonly AppRole[];
  /** When true, only the dashboard path matches (not nested /admin/…). */
  exact?: boolean;
};

/**
 * Longest-path match wins. Keep more specific paths above shorter prefixes
 * when adding entries that share a stem.
 */
const ADMIN_ROUTE_ACCESS: RouteAccess[] = [
  { path: "/admin/roles", roles: ["super_admin"] },
  { path: "/admin/rewards", roles: ["super_admin", "rewards_manager"] },
  { path: "/admin/reports", roles: ["super_admin", "ecommerce_manager"] },
  { path: "/admin/leads", roles: ["super_admin", "ecommerce_manager"] },
  { path: "/admin/orders", roles: ["super_admin", "ecommerce_manager"] },
  { path: "/admin/invoices", roles: ["super_admin", "ecommerce_manager"] },
  { path: "/admin/delivery", roles: ["super_admin", "ecommerce_manager"] },
  { path: "/admin/products", roles: ["super_admin", "ecommerce_manager"] },
  { path: "/admin/categories", roles: ["super_admin", "ecommerce_manager"] },
  { path: "/admin/customers", roles: ["super_admin", "ecommerce_manager", "rewards_manager"] },
  { path: "/admin/tickets", roles: ALL_STAFF },
  { path: "/admin/messages", roles: ALL_STAFF },
  // Brochure CMS (nav may be commented out; still guard if opened directly)
  { path: "/admin/services", roles: ["super_admin", "content_manager"] },
  { path: "/admin/projects", roles: ["super_admin", "content_manager"] },
  { path: "/admin/posts", roles: ["super_admin", "content_manager"] },
  { path: "/admin", roles: ALL_STAFF, exact: true },
];

export function normalizeAdminPath(pathname: string) {
  if (!pathname) return "/admin";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

function rolesOverlap(userRoles: readonly string[], allowed: readonly AppRole[]) {
  if (userRoles.includes("super_admin")) return true;
  return allowed.some((role) => userRoles.includes(role));
}

export function matchAdminRoute(pathname: string): RouteAccess | null {
  const path = normalizeAdminPath(pathname);
  for (const route of ADMIN_ROUTE_ACCESS) {
    if (route.exact) {
      if (path === route.path) return route;
      continue;
    }
    if (path === route.path || path.startsWith(`${route.path}/`)) return route;
  }
  return null;
}

/** Whether the user's roles may open this admin path. Unknown paths → deny. */
export function canAccessAdminPath(userRoles: readonly string[], pathname: string) {
  if (!userRoles.length) return false;
  const route = matchAdminRoute(pathname);
  if (!route) return false;
  return rolesOverlap(userRoles, route.roles);
}

/** Filter nav items whose `to` the user can open. */
export function filterAdminNavByRoles<T extends { to: string }>(
  items: readonly T[],
  userRoles: readonly string[],
) {
  return items.filter((item) => canAccessAdminPath(userRoles, item.to));
}
