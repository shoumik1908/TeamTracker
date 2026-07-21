import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { presalesApi } from '@/lib/presalesApi';
import type { PreSalesOpportunity } from '@/types';
import { X, FileText, Download, Trash2, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import ConfirmationModal from './ConfirmationModal';

interface GroupedOpportunity {
  name: string;
  clientName: string;
  pnbOpp?: PreSalesOpportunity;
  tnmOpp?: PreSalesOpportunity;
}

interface Props {
  grouped: GroupedOpportunity;
  onClose: () => void;
  onToast: (text: string, type: 'success' | 'info') => void;
}

export default function PresalesDocsModal({ grouped, onClose, onToast }: Props) {
  const queryClient = useQueryClient();
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  // Extract opportunity IDs
  const oppIds = [grouped.pnbOpp?.id, grouped.tnmOpp?.id].filter(Boolean) as string[];

  // Fetch stageChangeLog docs (uploaded via Analyze)
  const { data: response, isLoading } = useQuery({
    queryKey: ['presales-docs', oppIds],
    queryFn: () => presalesApi.getDocs(oppIds),
    enabled: oppIds.length > 0,
  });

  const stageDocs = response?.data || [];

  // Also collect sourceDocuments from the opportunity (uploaded via Generate Proposal)
  const proposalDocs: { fileName: string; blobUrl: string; uploadedAt: string; track: string }[] = [];
  if (grouped.pnbOpp?.sourceDocuments && Array.isArray(grouped.pnbOpp.sourceDocuments)) {
    (grouped.pnbOpp.sourceDocuments as any[]).forEach((d) => proposalDocs.push({ ...d, track: 'PNB' }));
  }
  if (grouped.tnmOpp?.sourceDocuments && Array.isArray(grouped.tnmOpp.sourceDocuments)) {
    (grouped.tnmOpp.sourceDocuments as any[]).forEach((d) => proposalDocs.push({ ...d, track: 'TNM' }));
  }

  const deleteMutation = useMutation({
    mutationFn: (logId: string) => presalesApi.deleteDoc(logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-docs', oppIds] });
      onToast('Document deleted successfully.', 'success');
      setDocToDelete(null);
    },
    onError: (err: any) => {
      onToast(err.message || 'Failed to delete document.', 'info');
      setDocToDelete(null);
    }
  });

  const getFileName = (url: string) => {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      return decodeURIComponent(parts[parts.length - 1] || 'Document');
    } catch {
      const parts = url.split('/');
      return decodeURIComponent(parts[parts.length - 1] || 'Document');
    }
  };

  const totalDocs = stageDocs.length + proposalDocs.length;

  return (
    <>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <div
          className="bg-card w-full max-w-3xl rounded-3xl border border-border overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
            <div>
              <h2 className="text-lg font-extrabold text-foreground tracking-tight">View Documents</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {grouped.clientName} — {grouped.name}
                {totalDocs > 0 && <span className="ml-2 text-violet-400 font-semibold">{totalDocs} file{totalDocs !== 1 ? 's' : ''}</span>}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-zinc-800 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                <p className="text-sm">Loading documents...</p>
              </div>
            ) : totalDocs === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl bg-zinc-900/30">
                <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm font-semibold">No documents found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload and analyze documents from the opportunity card to see them here.
                </p>
              </div>
            ) : (
              <>
                {/* Proposal Source Documents */}
                {proposalDocs.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-xs font-extrabold uppercase tracking-wider text-violet-400">Proposal Source Documents</span>
                    </div>
                    <div className="space-y-2">
                      {proposalDocs.map((doc, i) => {
                        const fileName = doc.fileName || getFileName(doc.blobUrl);
                        return (
                          <div key={i} className="group bg-violet-950/20 hover:bg-violet-950/30 border border-violet-900/30 rounded-xl p-4 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="mt-1">
                                <FileText className="w-5 h-5 text-violet-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate" title={fileName}>
                                  {fileName}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px]">
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded font-extrabold uppercase",
                                    doc.track === 'PNB' ? "bg-blue-950/60 text-blue-400" : "bg-indigo-950/60 text-indigo-400"
                                  )}>
                                    {doc.track}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}
                                  </span>
                                  <span className="text-violet-400/70 px-1.5 py-0.5 bg-violet-950/40 rounded">Proposal Generation</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center">
                              <a
                                href={doc.blobUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-foreground transition-colors flex items-center gap-1.5"
                              >
                                View
                              </a>
                              <a
                                href={doc.blobUrl}
                                download
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-zinc-800 hover:text-foreground transition-colors"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI Analyze Documents */}
                {stageDocs.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-3.5 h-3.5 text-azure-400" />
                      <span className="text-xs font-extrabold uppercase tracking-wider text-azure-400">AI Analyze Documents</span>
                    </div>
                    <div className="space-y-2">
                      {stageDocs.map((doc: any) => {
                        const fileName = doc.originalFilename || getFileName(doc.blobUrl);
                        const isPnb = doc.track === 'PNB';
                        return (
                          <div key={doc.id} className="group bg-zinc-900/50 hover:bg-zinc-800/80 border border-border/60 hover:border-border rounded-xl p-4 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="mt-1">
                                <FileText className="w-5 h-5 text-azure-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate" title={fileName}>
                                  {fileName}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px]">
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded font-extrabold uppercase",
                                    isPnb ? "bg-blue-950/60 text-blue-400" : "bg-indigo-950/60 text-indigo-400"
                                  )}>
                                    {doc.track}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {new Date(doc.createdAt).toLocaleDateString()}
                                  </span>
                                  <span className="text-muted-foreground px-1.5 py-0.5 bg-zinc-800 rounded">
                                    {doc.previousStage} &rarr; {doc.newStage}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center">
                              <a
                                href={doc.blobUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-foreground transition-colors flex items-center gap-1.5"
                              >
                                View
                              </a>
                              <a
                                href={doc.blobUrl}
                                download
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-zinc-800 hover:text-foreground transition-colors"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => setDocToDelete(doc.id)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                title="Delete Document"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={docToDelete !== null}
        opportunityName="this document"
        stageName="permanently delete it"
        isPending={deleteMutation.isPending}
        onClose={() => setDocToDelete(null)}
        onConfirm={() => {
          if (docToDelete) deleteMutation.mutate(docToDelete);
        }}
      />
    </>
  );
}
