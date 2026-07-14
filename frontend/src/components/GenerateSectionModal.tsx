import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { presalesApi } from '@/lib/presalesApi';
import {
  X, FileText, Trash2, Loader2, Sparkles, CheckCircle2, AlertCircle, FilePlus2, Check, ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GenerateSectionModalProps {
  opportunityId: string;
  opportunityName: string;
  sectionName: string;
  sectionKey: string;
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

export default function GenerateSectionModal({
  opportunityId,
  opportunityName,
  sectionName,
  sectionKey,
  onClose,
}: GenerateSectionModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // flow states: 'upload' -> 'loading' -> 'not_found' | 'confirm' -> 'saving' -> 'success'
  const [flowState, setFlowState] = useState<'upload' | 'loading' | 'not_found' | 'confirm' | 'saving' | 'success'>('upload');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [proposedText, setProposedText] = useState<string>('');

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected');
      setErrorMsg(null);
      setFlowState('loading');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sectionName', sectionName);
      
      return presalesApi.generateSection(opportunityId, formData);
    },
    onSuccess: (res) => {
      if (res.data.proposedContent) {
        setProposedText(res.data.proposedContent);
        setFlowState('confirm');
      } else {
        setFlowState('not_found');
      }
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || err.message || 'Operation failed. Please try again.');
      setFlowState('upload');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      setFlowState('saving');
      return presalesApi.updateSection(opportunityId, { [sectionKey]: proposedText });
    },
    onSuccess: () => {
      setFlowState('success');
      queryClient.invalidateQueries({ queryKey: ['presales-opportunity', opportunityId] });
      setTimeout(() => onClose(), 1500);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to save section.');
      setFlowState('confirm');
    }
  });

  const handleFileSelect = useCallback((incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const f = incoming[0];
    const isValid = ALLOWED_TYPES.includes(f.type) || 
                   f.name.toLowerCase().endsWith('.pdf') || 
                   f.name.toLowerCase().endsWith('.docx') || 
                   f.name.toLowerCase().endsWith('.txt');
                   
    if (isValid) {
      setFile(f);
      setErrorMsg(null);
    } else {
      setErrorMsg('Only PDF, DOCX, and TXT files are supported.');
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-blue-950/30 to-zinc-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10">
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground">Fill Section: {sectionName}</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[280px]">{opportunityName}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={flowState === 'loading' || flowState === 'saving'} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {flowState === 'upload' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Upload a document (PDF, DOCX, TXT) to automatically extract content for the <strong>{sectionName}</strong> section.
              </p>
              
              <div 
                onDragOver={handleDragOver} 
                onDragLeave={handleDragLeave} 
                onDrop={handleDrop} 
                onClick={() => fileInputRef.current?.click()} 
                className={cn(
                  'relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200', 
                  isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 hover:border-blue-500/50 hover:bg-zinc-900/50'
                )}
              >
                <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden" onChange={e => handleFileSelect(e.target.files)} />
                <div className="flex flex-col items-center gap-2.5">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-colors', isDragging ? 'bg-blue-500/20' : 'bg-zinc-800')}>
                    <FilePlus2 className={cn('w-5 h-5', isDragging ? 'text-blue-400' : 'text-muted-foreground')} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{isDragging ? 'Drop file here' : 'Drop a file or click to browse'}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">PDF, DOCX, TXT - Up to 15 MB</p>
                  </div>
                </div>
              </div>
              
              {file && (
                <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg group">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-blue-500/10">
                    <FileText className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="p-1.5 hover:bg-red-950/30 hover:text-red-400 text-muted-foreground rounded transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              {errorMsg && (
                <div className="flex items-start gap-2 p-3 bg-red-950/20 border border-red-800/30 rounded-xl text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {(flowState === 'loading' || flowState === 'saving') && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-blue-500/10">
                <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground mb-1">
                  {flowState === 'loading' ? 'Analyzing Document...' : 'Saving...'}
                </p>
                {flowState === 'loading' && (
                  <p className="text-xs text-blue-400 transition-all duration-500">
                    Extracting relevant information for {sectionName}
                  </p>
                )}
              </div>
            </div>
          )}

          {flowState === 'not_found' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-amber-500/10">
                <AlertCircle className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground mb-1">No Information Found</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  This document didn't contain <strong>{sectionName}</strong> information. Try a different document or edit manually.
                </p>
              </div>
              <button 
                onClick={() => setFlowState('upload')}
                className="mt-2 flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-foreground rounded-lg transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Go Back
              </button>
            </div>
          )}

          {flowState === 'confirm' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Information Extracted Successfully
              </div>
              <p className="text-xs text-muted-foreground">
                Review the proposed content for <strong>{sectionName}</strong>. You can tweak it below before saving.
              </p>
              
              <textarea
                value={proposedText}
                onChange={(e) => setProposedText(e.target.value)}
                rows={10}
                className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-blue-500/50 transition-colors resize-y min-h-[150px]"
                placeholder={`Proposed content for ${sectionName}...`}
              />

              {errorMsg && (
                <div className="flex items-start gap-2 p-3 bg-red-950/20 border border-red-800/30 rounded-xl text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {flowState === 'success' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-foreground">Section Updated!</p>
              <p className="text-xs text-muted-foreground">The <strong>{sectionName}</strong> section has been successfully updated.</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {flowState === 'upload' && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-950/50 shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-zinc-800 rounded-lg transition-colors">Cancel</button>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={!file}
              className={cn(
                'flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg transition-all',
                file
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30'
                  : 'bg-zinc-800 text-muted-foreground cursor-not-allowed'
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Extract Content
            </button>
          </div>
        )}

        {flowState === 'confirm' && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-950/50 shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors">
              Discard
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!proposedText.trim()}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md shadow-emerald-900/30 transition-all disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              Confirm & Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
