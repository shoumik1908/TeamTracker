import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { presalesApi, type PresalesAnalysisResult } from '@/lib/presalesApi';
import type { PreSalesOpportunity } from '@/types';
import {
  X,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  FileText,
  TrendingUp,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupedOpportunity {
  name: string;
  clientName: string;
  pnbOpp?: PreSalesOpportunity;
  tnmOpp?: PreSalesOpportunity;
}

interface ConfirmationCard {
  track: 'PNB' | 'TNM';
  oppId: string;
  incrementPercent: number;       // how much Groq suggests adding
  currentPercent: number;         // current stored value
  newTotalPercent: number;        // currentPercent + increment, capped at 100
  currentStageName: string;       // derived stage name after applying increment
  currentStageStillApplies: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  blobUrl: string | null;
  originalFilename: string | null;
  dismissed: boolean;
  confirmed: boolean;
}

type ModalPhase = 'upload' | 'analyzing' | 'results' | 'error';

interface Props {
  grouped: GroupedOpportunity;
  onClose: () => void;
  onProgressUpdated?: (track: 'PNB' | 'TNM', newPercent: number) => void;
  onToast: (text: string, type: 'success' | 'info') => void;
}

const ACCEPTED_TYPES = '.pdf,.docx,.txt,.eml';

/** Given a percent and stage list, return the stage name it falls into */
function percentToStageName(percent: number, stages: string[]): string {
  const idx = Math.min(stages.length - 1, Math.floor((percent / 100) * stages.length));
  return stages[idx];
}

export default function PresalesDocAnalyzerModal({ grouped, onClose, onToast }: Props) {
  const [phase, setPhase] = useState<ModalPhase>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUnclear, setIsUnclear] = useState(false);
  const [cards, setCards] = useState<ConfirmationCard[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('opportunityName', grouped.name);
      fd.append('clientName', grouped.clientName);
      if (grouped.pnbOpp) fd.append('pnbOppId', grouped.pnbOpp.id);
      if (grouped.tnmOpp) fd.append('tnmOppId', grouped.tnmOpp.id);
      return presalesApi.analyzeDoc(fd);
    },
    onSuccess: (res) => {
      const { analysis, blobUrl, originalFilename, currentPercent, newTotalPercent } = res.data;
      buildCards(analysis, blobUrl, originalFilename || null, currentPercent, newTotalPercent);
      setPhase('results');
    },
    onError: (err: any) => {
      setErrorMsg(err?.response?.data?.error || err.message || 'Analysis failed. Please try again.');
      setPhase('error');
    },
  });

  const progressMutation = useMutation({
    mutationFn: (vars: { oppId: string; increment: number; reasoning: string; blobUrl: string | null; originalFilename: string | null }) =>
      presalesApi.updateProgress(vars.oppId, vars.increment, 'ai_suggested', vars.reasoning, vars.blobUrl ?? undefined, vars.originalFilename ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['presales-docs'] });
    },
    onError: (err: any) => {
      onToast(err?.response?.data?.error || 'Failed to update progress.', 'info');
    },
  });

  function buildCards(
    analysis: PresalesAnalysisResult,
    blobUrl: string | null,
    originalFilename: string | null,
    currentPercent: number,
    newTotalPercent: number
  ) {
    // Unclear / low confidence — show the "couldn't determine" state
    if (
      analysis.detected_track === 'unclear' ||
      analysis.confidence === 'low' ||
      analysis.suggested_increment_percent === 0
    ) {
      setIsUnclear(true);
      setCards([]);
      return;
    }

    setIsUnclear(false);
    const newCards: ConfirmationCard[] = [];

    const buildCard = (track: 'PNB' | 'TNM', opp: PreSalesOpportunity): ConfirmationCard => ({
      track,
      oppId: opp.id,
      incrementPercent: analysis.suggested_increment_percent,
      currentPercent,
      newTotalPercent,
      currentStageName: percentToStageName(newTotalPercent, opp.stages),
      currentStageStillApplies: analysis.current_stage_still_applies,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      blobUrl,
      originalFilename,
      dismissed: false,
      confirmed: false,
    });

    if (analysis.detected_track === 'PNB' && grouped.pnbOpp) {
      newCards.push(buildCard('PNB', grouped.pnbOpp));
    } else if (analysis.detected_track === 'TNM' && grouped.tnmOpp) {
      newCards.push(buildCard('TNM', grouped.tnmOpp));
    }

    setCards(newCards);
  }

  function handleFileSelect(file: File) {
    setSelectedFile(file);
    setErrorMsg(null);
  }

  function handleAnalyze() {
    if (!selectedFile) return;
    setIsUnclear(false);
    setCards([]);
    setPhase('analyzing');
    analyzeMutation.mutate(selectedFile);
  }

  function handleConfirm(card: ConfirmationCard) {
    progressMutation.mutate({
      oppId: card.oppId,
      increment: card.incrementPercent,
      reasoning: card.reasoning,
      blobUrl: card.blobUrl,
      originalFilename: card.originalFilename,
    });
    setCards(prev => prev.map(c => c.oppId === card.oppId ? { ...c, confirmed: true } : c));
    onToast(
      `${card.track} progress updated: +${card.incrementPercent}% → ${card.newTotalPercent}% total.`,
      'success'
    );
  }

  function handleDismiss(card: ConfirmationCard) {
    setCards(prev => prev.map(c => c.oppId === card.oppId ? { ...c, dismissed: true } : c));
  }

  const confidenceBadge = (conf: 'high' | 'medium' | 'low') => {
    const styles = {
      high: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40',
      medium: 'bg-yellow-950/40 text-yellow-400 border-yellow-900/40',
      low: 'bg-gray-950/40 text-gray-400 border-gray-800/40',
    };
    return (
      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', styles[conf])}>
        {conf.toUpperCase()} confidence
      </span>
    );
  };

  const trackPill = (track: 'PNB' | 'TNM') => (
    <span className={cn(
      'px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-wide uppercase border',
      track === 'PNB'
        ? 'bg-blue-950/60 text-blue-400 border-blue-900/30'
        : 'bg-indigo-950/60 text-indigo-400 border-indigo-900/30'
    )}>
      {track === 'PNB' ? 'PNB (Proposal & Bid)' : 'TNM (Time & Material)'}
    </span>
  );

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-azure-500/10 rounded-xl">
              <Sparkles className="w-4 h-4 text-azure-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold">AI Progress Analyzer</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                <span className="text-white/70 font-medium">{grouped.name}</span>
                {' · '}
                {[grouped.pnbOpp && 'PNB', grouped.tnmOpp && 'TNM'].filter(Boolean).join(' + ')} track
                {(grouped.pnbOpp && grouped.tnmOpp) ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-card/5 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">

          {/* ─── UPLOAD phase ─────────────────────────────────── */}
          {phase === 'upload' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">
                Upload any document related to this opportunity. The AI will detect which
                track (PNB or TNM) it relates to and suggest an incremental progress update —
                no stage jumps without your confirmation.
              </p>

              {/* Drop zone */}
              <div
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
                  isDragging
                    ? 'border-azure-500 bg-azure-500/5'
                    : selectedFile
                    ? 'border-emerald-700/60 bg-emerald-950/10'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                )}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFileSelect(f);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-400">{selectedFile.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB — click to change
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-gray-500" />
                    <p className="text-sm text-gray-400">
                      Drop a file here, or <span className="text-azure-400 font-medium">browse</span>
                    </p>
                    <p className="text-[11px] text-gray-600">PDF, DOCX, TXT, EML · Max 15 MB</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleAnalyze}
                disabled={!selectedFile}
                className="w-full py-2.5 bg-azure-500 hover:bg-azure-600 disabled:bg-azure-500/30 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Analyze with AI
              </button>
            </div>
          )}

          {/* ─── ANALYZING phase ──────────────────────────────── */}
          {phase === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-16 h-16 rounded-full border-2 border-azure-500/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-azure-400 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">Analyzing document…</p>
                <p className="text-xs text-gray-400 mt-1">
                  Groq is detecting track and estimating progress increment. ~3–5 seconds.
                </p>
              </div>
            </div>
          )}

          {/* ─── ERROR phase ──────────────────────────────────── */}
          {phase === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-950/20 border border-red-900/30">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-300">Analysis failed</p>
                  <p className="text-xs text-red-400 mt-1">{errorMsg}</p>
                </div>
              </div>
              <button
                onClick={() => { setPhase('upload'); setSelectedFile(null); setErrorMsg(null); }}
                className="w-full py-2 border border-white/10 hover:bg-white/5 rounded-xl text-sm font-medium transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* ─── RESULTS phase ────────────────────────────────── */}
          {phase === 'results' && (
            <div className="space-y-3">

              {/* Unclear / low confidence */}
              {isUnclear && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-zinc-900 border border-white/5">
                  <HelpCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Couldn't determine progress from this document</p>
                    <p className="text-xs text-gray-400 mt-1">
                      The document didn't contain enough clear signals to confidently identify
                      which track it relates to. You can still manually click a timeline dot to
                      advance the stage.
                    </p>
                  </div>
                </div>
              )}

              {/* Confirmation cards */}
              {cards.map(card => (
                <div
                  key={card.oppId}
                  className={cn(
                    'rounded-xl border p-4 space-y-3 transition-all',
                    card.confirmed
                      ? 'bg-emerald-950/10 border-emerald-900/20 opacity-60'
                      : card.dismissed
                      ? 'opacity-40 border-white/5 bg-zinc-900/30'
                      : 'bg-zinc-900 border-white/8'
                  )}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {trackPill(card.track)}
                      {confidenceBadge(card.confidence)}
                    </div>
                    {card.confirmed && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" /> Applied
                      </span>
                    )}
                    {card.dismissed && !card.confirmed && (
                      <span className="text-[11px] text-gray-500">Dismissed</span>
                    )}
                  </div>

                  {/* Progress suggestion — only when not yet confirmed/dismissed */}
                  {!card.confirmed && !card.dismissed && (
                    <>
                      {/* Progress delta visualization */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">Progress update</span>
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span className="text-muted-foreground">{card.currentPercent}%</span>
                            <ArrowRight className="w-3 h-3 text-azure-400" />
                            <span className="text-azure-400">{card.newTotalPercent}%</span>
                            <span className="text-emerald-400 text-[10px]">(+{card.incrementPercent}%)</span>
                          </div>
                        </div>

                        {/* Visual bar */}
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full relative rounded-full bg-border/40">
                            {/* Current fill */}
                            <div
                              className="absolute left-0 top-0 h-full bg-azure-500/40 rounded-full transition-all duration-500"
                              style={{ width: `${card.currentPercent}%` }}
                            />
                            {/* Increment fill */}
                            <div
                              className="absolute top-0 h-full bg-azure-400 rounded-full transition-all duration-700 delay-200"
                              style={{ left: `${card.currentPercent}%`, width: `${Math.min(card.incrementPercent, 100 - card.currentPercent)}%` }}
                            />
                          </div>
                        </div>

                        {/* Stage label */}
                        <div className="flex items-center gap-1 text-[11px] text-gray-400">
                          <TrendingUp className="w-3.5 h-3.5 text-azure-400 flex-shrink-0" />
                          <span>
                            Currently in stage:{' '}
                            <strong className="text-foreground">{card.currentStageName}</strong>
                            {!card.currentStageStillApplies && (
                              <span className="text-emerald-400 ml-1">→ stage will advance</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Reasoning */}
                      <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                        <p className="text-[11px] text-gray-400 leading-relaxed italic">
                          "{card.reasoning}"
                        </p>
                      </div>

                      {/* Confirmation wording */}
                      <p className="text-[11px] text-gray-300">
                        This document suggests <strong className="text-white">{card.track}</strong> progress has increased by{' '}
                        <strong className="text-azure-400">{card.incrementPercent}%</strong>, bringing it to{' '}
                        <strong className="text-azure-400">{card.newTotalPercent}%</strong>{' '}
                        (currently in stage: <strong className="text-white">{card.currentStageName}</strong>).
                      </p>

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleConfirm(card)}
                          disabled={progressMutation.isPending}
                          className="flex-1 py-2 text-xs font-semibold rounded-xl bg-azure-500 hover:bg-azure-600 text-white transition-colors flex items-center justify-center gap-1.5"
                        >
                          {progressMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Confirm & Update
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDismiss(card)}
                          className="flex-1 py-2 text-xs font-semibold rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Upload another */}
              <button
                onClick={() => { setPhase('upload'); setSelectedFile(null); setCards([]); setIsUnclear(false); }}
                className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Upload a different document
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
