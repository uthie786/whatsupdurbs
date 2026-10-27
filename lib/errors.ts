/**
 * Human-readable message for anything thrown. Supabase/PostgREST errors are
 * plain objects ({ message, details, hint, code }), not Error instances, so
 * String(err) would print "[object Object]".
 */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object") {
    const e = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    if (typeof e.message === "string" && e.message) {
      const extra = [e.details, e.hint].filter((x): x is string => typeof x === "string" && x.length > 0);
      const code = typeof e.code === "string" && e.code ? ` [${e.code}]` : "";
      return [e.message + code, ...extra].join(" — ");
    }
    try {
      return JSON.stringify(err);
    } catch {
      // fall through
    }
  }
  return fallback;
}
