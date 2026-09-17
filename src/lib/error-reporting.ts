// Loaders and server fns commonly throw a raw Response; String(it) is the
// opaque "[object Response]", so pull out the status and URL instead.
function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Response) {
    return { message: `Response ${error.status}${error.url ? ` at ${error.url}` : ""}` };
  }
  if (error instanceof Error) {
    return { message: error.message, ...(error.stack ? { stack: error.stack } : {}) };
  }
  return { message: String(error) };
}

// Central hook for uncaught render errors. Wire this up to a real error
// tracking service (Sentry, etc.) when one is added; for now it just logs.
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const { message, stack } = describeError(error);
  console.error("[error-boundary]", message, {
    stack,
    route: window.location.pathname,
    ...context,
  });
}
