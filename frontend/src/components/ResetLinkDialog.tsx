import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';

export interface ResetLink {
  /** Whose account the link is for — used only in the copy. */
  name: string;
  url: string;
  minutes: number;
}

/**
 * Shown once, immediately after a reset link is issued: the API never returns it
 * again. Used both when an admin resets an existing account and when creating a
 * member mints a new one (TT-046), which is why it lives here rather than inline.
 */
export function buildResetLink(name: string, token: string, minutes?: number): ResetLink {
  return {
    name,
    url: `${window.location.origin}/reset-password?token=${encodeURIComponent(token)}`,
    minutes: minutes ?? 60,
  };
}

export default function ResetLinkDialog({
  link,
  onClose,
}: {
  link: ResetLink;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center gap-3 mb-4 text-azure-400">
          <KeyRound className="w-6 h-6" />
          <h3 className="text-lg font-semibold text-foreground">Reset link for {link.name}</h3>
        </div>
        <p className="text-white/60 text-sm mb-3">
          Send this to {link.name}. It can be used once and expires in {link.minutes} minutes.
          <strong className="text-amber-400"> It will not be shown again.</strong>
        </p>
        <div className="flex gap-2 mb-5">
          <input
            readOnly
            value={link.url}
            aria-label="Password reset link"
            onFocus={e => e.currentTarget.select()}
            className="flex-1 px-3 py-2 text-xs bg-background border border-white/10 rounded-lg text-foreground font-mono"
          />
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link.url);
                setCopied(true);
              } catch {
                // Clipboard access can be refused; the field is selectable as a fallback.
                toast.error('Could not copy. Select the link and copy it manually.');
              }
            }}
            className="px-3 py-2 text-xs font-medium bg-azure-500 text-white rounded-lg hover:bg-azure-600 whitespace-nowrap"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-muted hover:bg-muted/80 rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
