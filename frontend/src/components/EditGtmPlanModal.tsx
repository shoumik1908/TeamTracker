import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { gtmApi } from '@/lib/gtmApi';
import { X, Loader2, Pencil } from 'lucide-react';

interface EditGtmPlanModalProps {
  isOpen: boolean;
  oldName: string;
  oldClientName: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditGtmPlanModal({
  isOpen,
  oldName,
  oldClientName,
  onClose,
  onSaved,
}: EditGtmPlanModalProps) {
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
    mutationFn: () => gtmApi.updateDetails({ oldName, oldClientName, newName, newClientName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gtm-plans'] });
      onSaved();
    },
    onError: (err: any) => setError(err.message || 'Failed to update GTM plan.')
  });

  if (!isOpen) return null;

  const hasChanges = newName.trim() !== oldName || newClientName.trim() !== oldClientName;
  const canSave = newName.trim().length > 0 && newClientName.trim().length > 0 && hasChanges;

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
              <Pencil className="w-5 h-5 text-azure-400" />
            </div>
            <div>
              <h2 id="modal-title" className="text-xl font-semibold">Edit Plan Details</h2>
              <p className="text-sm text-gray-400 mt-1">Update plan and client names</p>
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
              <label htmlFor="editClientName" className="block text-sm font-medium text-gray-400 mb-1.5">
                Client Name <span className="text-red-400">*</span>
              </label>
              <input
                ref={clientInputRef}
                id="editClientName"
                type="text"
                placeholder="e.g. Acme Corp"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-azure-500/50"
              />
            </div>

            <div>
              <label htmlFor="editName" className="block text-sm font-medium text-gray-400 mb-1.5">
                Plan Name <span className="text-red-400">*</span>
              </label>
              <input
                id="editName"
                type="text"
                placeholder="e.g. Q4 Market Expansion"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-azure-500/50"
              />
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
            onClick={() => editMutation.mutate()}
            disabled={!canSave || editMutation.isPending}
            className="px-4 py-2 bg-azure-500 hover:bg-azure-600 disabled:bg-azure-500/50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            {editMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
