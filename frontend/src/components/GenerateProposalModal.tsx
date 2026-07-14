import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { presalesApi } from '@/lib/presalesApi';
import {
  X, FileText, Trash2, Loader2, Sparkles, CheckCircle2, AlertCircle, FilePlus2, PlusCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProposalModalMode = 'generate' | 'add';

interface GenerateProposalModalProps {
  opportunityId: string;
  opportunityName: string;
  sourceDocuments?: any;
  mode?: ProposalModalMode;
  onClose: () => void;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const ACCEPT = '.pdf,.docx,.txt';
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const STEPS_GENERATE = [
  'Extracting text from documents...',
  'Combining document content...',
  'Sending to Groq AI...',
  'Generating all 9 sections...',
  'Saving to database...',
];

const STEPS_ADD = [
  'Extracting text from new documents...',
  'Comparing with existing summary...',
  'Sending to Groq AI...',
  'Filling in blank sections...',
  'Saving updates...',
];

export default function GenerateProposalModal({
  opportunityId,
  opportunityName,
  sourceDocuments,
  mode = 'generate',
  onClose,
}: GenerateProposalModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<{ fileName: string; blobUrl: string; uploadedAt: string }[]>(
    Array.isArray(sourceDocuments) ? sourceDocuments : []
  );
  const [isDragging, setIsDragging] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [succeeded, setSucceeded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const STEPS = mode === 'add' ? STEPS_ADD : STEPS_GENERATE;

  const generateMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      setStepIdx(0);
      stepTimerRef.current = setInterval(() => {
        setStepIdx(prev => Math.min(prev + 1, STEPS.length - 1));
      }, 3500);
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      formData.append('existingBlobUrls', JSON.stringify(existingFiles.map(f => f.blobUrl)));
      if (mode === 'add') {
        return presalesApi.addToProposal(opportunityId, formData);
      }
      return presalesApi.generateProposal(opportunityId, formData);
    },
    onSuccess: () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      setSucceeded(true);
      queryClient.invalidateQueries({ queryKey: ['presales-opportunity', opportunityId] });
      setTimeout(() => onClose(), 1800);
    },
    onError: (err: any) => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      setErrorMsg(err.response?.data?.error || err.message || 'Operation failed. Please try again.');
    },
  });

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const valid = Array.from(incoming).filter(f =>
      ALLOWED_TYPES.includes(f.type) ||
      f.name.toLowerCase().endsWith('.pdf') ||
      f.name.toLowerCase().endsWith('.docx') ||
      f.name.toLowerCase().endsWith('.txt')
    );
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      const deduped = valid.filter(f => !existing.has(f.name + f.size));
      return [...prev, ...deduped].slice(0, 10);
    });
  }, []);

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const isGenerating = generateMutation.isPending;

  const isAddMode = mode === 'add';

  const headingText = isAddMode ? 'Add More Files' : 'Generate Proposal Summary';
  const buttonText = isAddMode ? 'Add to Summary' : 'Generate';
  const successText = isAddMode
    ? 'Blank sections have been filled in from your new documents.'
    : 'The nine sections are now populated in the description area.';
  const successTitle = isAddMode ? 'Sections Updated!' : 'Proposal Summary Generated!';
  const instructionText = isAddMode
    ? 'Upload additional documents to fill in any sections that are currently empty. Already-filled sections will not be changed.'
    : 'Upload one or more documents (requirements docs, meeting notes, technical specs) to analyze and generate a structured 9-section proposal summary.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className={cn(
          'flex items-center justify-between px-6 py-4 border-b border-zinc-800',
          isAddMode ? 'bg-gradient-to-r from-blue-950/30 to-zinc-950' : 'bg-gradient-to-r from-violet-950/30 to-zinc-950'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', isAddMode ? 'bg-blue-500/10' : 'bg-violet-500/10')}>
              {isAddMode ? <PlusCircle className="w-4 h-4 text-blue-400" /> : <Sparkles className="w-4 h-4 text-violet-400" />}
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground">{headingText}</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[280px]">{opportunityName}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isGenerating} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {succeeded ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-foreground">{successTitle}</p>
              <p className="text-xs text-muted-foreground">{successText}</p>
            </div>
          ) : isGenerating ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className={cn('w-14 h-14 rounded-full flex items-center justify-center', isAddMode ? 'bg-blue-500/10' : 'bg-violet-500/10')}>
                <Loader2 className={cn('w-7 h-7 animate-spin', isAddMode ? 'text-blue-400' : 'text-violet-400')} />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground mb-1">{isAddMode ? 'Analyzing...' : 'Generating...'}</p>
                <p className={cn('text-xs transition-all duration-500', isAddMode ? 'text-blue-400' : 'text-violet-400')}>{STEPS[stepIdx]}</p>
              </div>
              <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                <div className={cn('h-full transition-all duration-[3500ms]', isAddMode ? 'bg-blue-500' : 'bg-violet-500')} style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground">This may take 15-30 seconds depending on document size.</p>
            </div>
          ) : (
            <>
              {isAddMode && (
                <div className={cn('flex items-start gap-2 p-3 bg-blue-950/20 border border-blue-800/30 rounded-xl text-xs text-blue-300')}>
                  <PlusCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Only <strong>empty sections</strong> will be filled. Sections that already have content will remain unchanged.</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground leading-relaxed">{instructionText}</p>

              {/* Pre-loaded files */}
              {!isAddMode && existingFiles.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Keep in summary ({existingFiles.length} file{existingFiles.length > 1 ? 's' : ''})
                  </span>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {existingFiles.map((f, i) => (
                      <div key={f.blobUrl} className="flex items-center justify-between p-2 bg-zinc-900/60 border border-zinc-800/80 rounded-lg group">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <FileText className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <span className="text-xs font-medium text-foreground truncate max-w-[340px]" title={f.fileName}>
                            {f.fileName}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExistingFiles(prev => prev.filter((_, idx) => idx !== i));
                          }}
                          className="p-1 hover:bg-zinc-800 text-muted-foreground hover:text-red-400 rounded transition-colors"
                          title="Exclude from this regeneration"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Dropzone */}
              <div className="space-y-1.5">
                {!isAddMode && existingFiles.length > 0 && (
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Add new documents
                  </span>
                )}
                <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()} className={cn('relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200', isDragging ? (isAddMode ? 'border-blue-500 bg-blue-500/10' : 'border-violet-500 bg-violet-500/10') : 'border-zinc-700 hover:border-violet-500/50 hover:bg-zinc-900/50')}>
                  <input ref={fileInputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={e => addFiles(e.target.files)} />
                  <div className="flex flex-col items-center gap-2.5">
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center transition-colors', isDragging ? (isAddMode ? 'bg-blue-500/20' : 'bg-violet-500/20') : 'bg-zinc-800')}>
                      <FilePlus2 className={cn('w-4.5 h-4.5', isDragging ? (isAddMode ? 'text-blue-400' : 'text-violet-400') : 'text-muted-foreground')} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{isDragging ? 'Drop files here' : 'Drop files or click to browse'}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">PDF, DOCX, TXT - 15 MB each</p>
                    </div>
                  </div>
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">New files selected ({files.length})</span>
                    <span className="text-[10px] text-muted-foreground">{formatBytes(totalSize)} total</span>
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {files.map((f, i) => (
                      <div key={`${f.name}-${f.size}`} className="flex items-center gap-3 p-2 bg-zinc-900 border border-zinc-800 rounded-lg group">
                        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center shrink-0', isAddMode ? 'bg-blue-500/10' : 'bg-violet-500/10')}>
                          <FileText className={cn('w-3.5 h-3.5', isAddMode ? 'text-blue-400' : 'text-violet-400')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                          <p className="text-[10px] text-muted-foreground">{formatBytes(f.size)}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-950/30 hover:text-red-400 text-muted-foreground rounded transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {errorMsg && (
                <div className="flex items-start gap-2 p-3 bg-red-950/20 border border-red-800/30 rounded-xl text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </>
          )}
        </div>

        {!succeeded && !isGenerating && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-950/50">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-zinc-800 rounded-lg transition-colors">Cancel</button>
            <button
              onClick={() => {
                if (!isAddMode) {
                  if (confirm('This will replace the current proposal summary. Continue?')) {
                    generateMutation.mutate();
                  }
                } else {
                  generateMutation.mutate();
                }
              }}
              disabled={files.length === 0 && existingFiles.length === 0}
              className={cn(
                'flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg transition-all',
                (files.length > 0 || existingFiles.length > 0)
                  ? (isAddMode ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30' : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-900/30')
                  : 'bg-zinc-800 text-muted-foreground cursor-not-allowed'
              )}
            >
              {isAddMode ? <PlusCircle className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
              {buttonText} ({(files.length + existingFiles.length)} { (files.length + existingFiles.length) === 1 ? 'file' : 'files' })
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
