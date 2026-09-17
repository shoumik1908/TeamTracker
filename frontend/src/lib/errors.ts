import { toast } from 'sonner';

/**
 * Pull a human-readable message off whatever a mutation rejected with.
 *
 * The api client in lib/api.ts throws a plain Error carrying the server's
 * `{ error }` text, so `err.message` is the useful field. Several pages instead
 * read `err.response.data.error` — an axios shape this client never produces, so
 * those handlers always fell through to their generic fallback (audit TT-142).
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

/**
 * Surface a failure to the user. sonner is the only toast library with a mounted
 * <Toaster> (App.tsx) — react-hot-toast is a dependency but renders nothing, so
 * anything routed through it was silently invisible.
 */
export function notifyError(err: unknown, fallback?: string): void {
  toast.error(errorMessage(err, fallback));
}
