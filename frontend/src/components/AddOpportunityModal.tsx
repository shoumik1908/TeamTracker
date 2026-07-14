import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { presalesApi } from '@/lib/presalesApi';
import { X, Loader2, PlusCircle } from 'lucide-react';

interface AddOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddOpportunityModal({
  isOpen,
  onClose,
  onSaved,
}: AddOpportunityModalProps) {
  const qc = useQueryClient();
  const modalRef = useRef<HTMLDivElement>(null);
  const clientInputRef = useRef<HTMLInputElement>(null);

  const [clientName, setClientName] = useState('');
  const [name, setName] = useState('');
  const [createPnb, setCreatePnb] = useState(true);
  const [createTnm, setCreateTnm] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Focus client name input on mount
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        clientInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

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

  const saveMutation = useMutation({
    mutationFn: () => presalesApi.create({ name, clientName, createPnb, createTnm }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presales-opportunities'] });
      setClientName('');
      setName('');
      setCreatePnb(true);
      setCreateTnm(true);
      onSaved();
    },
    onError: (err: any) => setError(err.message || 'Failed to create opportunity.')
  });

  if (!isOpen) return null;

  const canSave = clientName.trim().length > 0 && name.trim().length > 0 && (createPnb || createTnm);

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-add-title"
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
              <PlusCircle className="w-5 h-5" />
            </div>
            <h2 id="modal-add-title" className="font-semibold text-lg text-foreground">
              Add PreSales Opportunity
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
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Standard Chartered, Vodafone"
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Core Banking Upgrade Phase 2"
              className="w-full px-3.5 py-2 text-sm border border-border rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30 transition-all"
            />
          </div>

          {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 px-6 py-4 bg-muted/10 border-t border-border">
          <button
            onClick={onClose}
            disabled={saveMutation.isPending}
            className="flex-1 px-4 py-2.5 text-sm font-semibold border border-border rounded-xl hover:bg-muted/50 text-foreground transition-all duration-150 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setError(null);
              saveMutation.mutate();
            }}
            disabled={!canSave || saveMutation.isPending}
            className="flex-1 px-4 py-2.5 text-sm font-semibold bg-azure-500 hover:bg-azure-600 text-white rounded-xl shadow-lg shadow-azure-500/15 hover:shadow-azure-500/25 transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Adding...
              </>
            ) : (
              'Add Opportunity'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
