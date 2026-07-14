import { useEffect, useRef } from 'react';
import { HelpCircle, X, Loader2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  opportunityName: string;
  stageName: string;
  isPending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: React.ReactNode;
  subMessage?: string;
}

export default function ConfirmationModal({
  isOpen,
  opportunityName,
  stageName,
  isPending = false,
  onClose,
  onConfirm,
  title,
  message,
  subMessage,
}: ConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // 1. Listen for Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 2. Focus Trap and initial focus management
  useEffect(() => {
    if (!isOpen) return;

    // Focus the cancel button (safe default) on mount
    setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 50);

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex="0"]'
      );
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        // Shift + Tab: if focus is on the first element, wrap to the last
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        // Tab: if focus is on the last element, wrap to the first
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleFocusTrap);
    return () => window.removeEventListener('keydown', handleFocusTrap);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-desc"
    >
      <div
        ref={modalRef}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border overflow-hidden transform transition-all duration-300 scale-100"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking modal content
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-azure-500/10 flex items-center justify-center text-azure-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h2 id="modal-title" className="font-semibold text-lg text-foreground">
              {title || 'Confirm Stage Transition'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/30 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3">
          <p id="modal-desc" className="text-sm text-foreground/90 leading-relaxed">
            {message || (
              <>
                Are you sure you want to move <strong className="text-foreground font-semibold">{opportunityName}</strong> to the stage:
              </>
            )}
          </p>
          <div className="p-4 bg-muted/20 border border-border/80 rounded-xl flex items-center justify-center">
            <span className="text-base font-bold text-azure-400 tracking-wide">
              {stageName}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {subMessage || "This will immediately update the opportunity's sales progression timeline."}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-4 bg-muted/10 border-t border-border">
          <button
            ref={cancelButtonRef}
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 text-sm font-semibold border border-border rounded-xl hover:bg-muted/50 text-foreground transition-all duration-150 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-azure-500 hover:bg-azure-600 text-white rounded-xl shadow-lg shadow-azure-500/15 hover:shadow-azure-500/25 transition-all duration-150 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Updating...
              </>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
