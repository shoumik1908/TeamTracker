import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { presalesApi } from '@/lib/presalesApi';
import { X, Loader2, Pencil } from 'lucide-react';

interface EditOpportunityModalProps {
  isOpen: boolean;
  oldName: string;
  oldClientName: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditOpportunityModal({
  isOpen,
  oldName,
  oldClientName,
  onClose,
  onSaved,
}: EditOpportunityModalProps) {
  const qc = useQueryClient();
  const modalRef = useRef<HTMLDivElement>(null);
  const clientInputRef = useRef<HTMLInputElement>(null);

  const [newName, setNewName] = useState(oldName);
  const [newClientName, setNewClientName] = useState(oldClientName);
  const [error, setError] = useState<string | null>(null);

  // Sync inputs on open
  useEffect(() => {
    if (isOpen) {
      setNewName(oldName);
      setNewClientName(oldClientName);
      setError(null);
      setTimeout(() => {
        clientInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, oldName, oldClientName]);

  // Escape key dismiss
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

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex="0"]'
      );
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleFocusTrap);
    return () => window.removeEventListener('keydown', handleFocusTrap);
  }, [isOpen]);

  const editMutation = useMutation({
    mutationFn: () => presalesApi.updateDetails({ oldName, oldClientName, newName, newClientName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presales-opportunities'] });
      onSaved();
    },
    onError: (err: any) => setError(err.message || 'Failed to update opportunity.')
  });

  if (!isOpen) return null;

  const hasChanges = newName.trim() !== oldName || newClientName.trim() !== oldClientName;
  const canSave = newName.trim().length > 0 && newClientName.trim().length > 0 && hasChanges;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-edit-title"
    >
      <div
        ref={modalRef}
        className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border overflow-hidden transform transition-all duration-300 scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-azure-500/10 flex items-center justify-center text-azure-400">
              <Pencil className="w-4 h-4" />
            </div>
            <h2 id="modal-edit-title" className="font-semibold text-lg text-foreground">
              Edit PreSales Opportunity
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

        {/* Content/Form */}
        <div className="p-6 space-y-5">
          {/* Client Name */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Client Name *
            </label>
            <input
              ref={clientInputRef}
              type="text"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="e.g. Standard Chartered"
              className="w-full px-3.5 py-2 text-sm border border-border rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30 transition-all"
            />
          </div>

          {/* Opportunity Name */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Opportunity Name *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Core Banking Upgrade"
              className="w-full px-3.5 py-2 text-sm border border-border rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30 transition-all"
            />
          </div>

          {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 px-6 py-4 bg-muted/10 border-t border-border">
          <button
            onClick={onClose}
            disabled={editMutation.isPending}
            className="flex-1 px-4 py-2.5 text-sm font-semibold border border-border rounded-xl hover:bg-muted/50 text-foreground transition-all duration-150 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setError(null);
              editMutation.mutate();
            }}
            disabled={!canSave || editMutation.isPending}
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-azure-500 hover:bg-azure-600 text-white rounded-xl shadow-lg shadow-azure-500/15 hover:shadow-azure-500/25 transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {editMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
