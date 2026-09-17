import { toast } from 'sonner';
import { OpaqueHttpError } from './api';

/**
 * Pull a human-readable message off whatever a mutation rejected with.
 *
 * The api client in lib/api.ts throws a plain Error carrying the server's
 * `{ error }` text, so `err.message` is the useful field. Several pages instead
 * read `err.response.data.error` — an axios shape this client never produces, so
 * those handlers always fell through to their generic fallback (audit TT-142).
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  // A blob request carries no readable body, so its message is only ever
  // `HTTP error! status: NNN` — a status code is not something to put in front
  // of a user, so the caller's own wording wins.
  if (err instanceof OpaqueHttpError) return fallback;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

/**
 * Surface a failure to the user. sonner is the app's toast library and the only
 * one with a mounted <Toaster> (App.tsx). ProjectsPage used to import
 * react-hot-toast, which had no <Toaster> anywhere, so everything routed through
 * it was invisible; that dependency has since been dropped.
 */
export function notifyError(err: unknown, fallback?: string): void {
  toast.error(errorMessage(err, fallback));
}
