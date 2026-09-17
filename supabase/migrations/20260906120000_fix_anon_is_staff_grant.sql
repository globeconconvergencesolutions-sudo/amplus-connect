-- Fix: the public-read RLS policies on products, services, projects and posts
-- call public.is_staff(auth.uid()) as part of their USING clause, e.g.
--   using (is_active or public.is_staff(auth.uid()))
-- Postgres checks EXECUTE privilege on every function referenced in a policy's
-- USING expression for the querying role, even when the boolean would short
-- circuit at runtime. The previous migration revoked EXECUTE on is_staff from
-- anon and only re-granted it to authenticated, which made every anonymous
-- (storefront/browsing) request to these tables fail with
-- "permission denied for function is_staff" instead of returning public rows.
--
-- is_staff(uuid) is security definer and simply checks for rows in
-- user_roles; calling it as is_staff(auth.uid()) for an anonymous request
-- evaluates auth.uid() = null and safely returns false, so granting EXECUTE
-- to anon does not expose any additional data.
grant execute on function public.is_staff(uuid) to anon;
grant execute on function public.has_role(uuid, public.app_role) to anon;
