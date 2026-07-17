import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { gtmApi } from '@/lib/gtmApi';
import { X, Loader2, Rocket } from 'lucide-react';
import { GtmCategory } from '@/types';

interface AddGtmPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddGtmPlanModal({
  isOpen,
  onClose,
  onSaved,
}: AddGtmPlanModalProps) {
  const qc = useQueryClient();
  const modalRef = useRef<HTMLDivElement>(null);
  const clientInputRef = useRef<HTMLInputElement>(null);

  const [clientName, setClientName] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GtmCategory>('NEW_MARKET_ENTRY');
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
    mutationFn: () => gtmApi.create({ name, clientName, category }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gtm-plans'] });
      setClientName('');
      setName('');
      setCategory('NEW_MARKET_ENTRY');
      onSaved();
    },
    onError: (err: any) => setError(err.message || 'Failed to create GTM plan.')
  });

  if (!isOpen) return null;

  const canSave = clientName.trim().length > 0 && name.trim().length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="bg-black border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-azure-500/10 rounded-xl">
              <Rocket className="w-5 h-5 text-azure-400" />
            </div>
            <div>
              <h2 id="modal-title" className="text-xl font-semibold">Add GTM Plan</h2>
              <p className="text-sm text-gray-400 mt-1">Track a new client engagement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-card/5 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="clientName" className="block text-sm font-medium text-gray-400 mb-1.5">
                Client Name <span className="text-red-400">*</span>
              </label>
              <input
                ref={clientInputRef}
                id="clientName"
                type="text"
                placeholder="e.g. Acme Corp"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-azure-500/50"
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-1.5">
                Plan Name <span className="text-red-400">*</span>
              </label>
              <input
                id="name"
                type="text"
                placeholder="e.g. Q4 Market Expansion"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-azure-500/50"
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-400 mb-1.5">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as GtmCategory)}
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-azure-500/50"
              >
                <option value="NEW_MARKET_ENTRY">New Market Entry</option>
                <option value="EXISTING_CLIENT_EXPANSION">Existing Client Expansion</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5 bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl font-medium hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
            className="px-4 py-2 bg-azure-500 hover:bg-azure-600 disabled:bg-azure-500/50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Add Plan'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
