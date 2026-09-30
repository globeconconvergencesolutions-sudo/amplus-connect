/** PostgREST when a table is not in the schema cache (migration not applied). */
export function isMissingRelation(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "PGRST205") return true;
  return /Could not find the table|schema cache/i.test(error.message ?? "");
}
