import { useEffect, useId, useRef } from 'react';

/**
 * Dialog semantics shared by the CoE dialogs: focus moves into the panel when it opens,
 * Escape closes it, and focus returns to whatever opened it.
 *
 * The effect deliberately runs once per mount, and `onClose` is read through a ref rather
 * than listed as a dependency. Depending on `onClose` reads as the correct thing to do,
 * but every call site passes an inline arrow, so the dependency changed identity on every
 * parent render and the effect re-ran: focus was pulled out of whatever the user was
 * typing in and dumped back on the panel, and `previouslyFocused` was re-captured as the
 * panel itself — so closing the dialog later dropped focus on <body> instead of handing it
 * back to the opener. Changing a ticket's status from inside a dialog was enough to
 * trigger both. The ref keeps the latest handler without re-running the effect.
 */
export function useDialogA11y(onClose: () => void) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Move focus into the dialog so the next Tab lands inside it, not behind it.
    panelRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Hand focus back to whatever opened it, rather than dropping it on <body>.
      // If the opener is gone — a ticket card whose status change moved it to another
      // column, say — there is nothing to return to and focus falls to <body>; calling
      // focus() on a detached node is a silent no-op, so check rather than pretend.
      if (previouslyFocused?.isConnected) previouslyFocused.focus?.();
    };
  }, []);

  return { titleId, panelRef };
}
