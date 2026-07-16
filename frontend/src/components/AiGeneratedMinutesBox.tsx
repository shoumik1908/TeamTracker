import { generateMeetingDocx } from '../lib/exportDocx';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  BrainCircuit, RefreshCw, AlertTriangle, Users, List, Lightbulb, 
  CheckSquare, Square, HelpCircle, ChevronRight, Info, FileText
, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper to format date nicely in frontend
function formatDate(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Helper to render formatted text with paragraphs/lists
function renderFormattedText(text: string) {
  if (!text) return null;
  const parts = text.split('\n\n');
  return parts.map((part, index) => {
    // If paragraph represents bullet points
    if (part.trim().startsWith('-') || part.trim().startsWith('*')) {
      const items = part
        .split('\n')
        .map(line => line.replace(/^[\s-*]+/, '').trim())
        .filter(Boolean);
      return (
        <ul key={index} className="list-disc pl-5 space-y-1.5 my-2.5">
          {items.map((item, idx) => (
            <li key={idx} className="text-xs text-foreground/80 leading-relaxed font-sans">{item}</li>
          ))}
        </ul>
      );
    }

    const lines = part.split('\n');
    return (
      <p key={index} className="text-xs text-foreground/80 leading-relaxed font-sans mb-2.5 last:mb-0">
        {lines.map((line, idx) => (
          <span key={idx}>
            {line}
            {idx < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  });
}

// Helper to render Action Item priority badges
function renderPriorityBadge(priority: string | null) {
  if (!priority) return null;
  const colors = {
    high: 'bg-red-500/10 text-red-400 border-red-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    low: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  };
  const label = priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
  const cls = colors[priority.toLowerCase() as 'high'|'medium'|'low'] || 'bg-muted text-muted-foreground border-border';
  return (
    <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0", cls)}>
      {label}
    </span>
  );
}

export interface AiGeneratedMinutesBoxProps {
  aiMinutes: any;
  actionItems: any[];
  theme: 'violet' | 'azure';
  isReanalyzing: boolean;
  onReanalyze: () => void;
  onToggleActionItem: (itemId: string, completed: boolean) => void;
  record?: any;
}

export default function AiGeneratedMinutesBox({
  aiMinutes,
  actionItems,
  theme,
  isReanalyzing,
  onReanalyze,
  onToggleActionItem,
  record
}: AiGeneratedMinutesBoxProps) {
  // Check format mode
  const isMoM = Boolean(aiMinutes.purpose || aiMinutes.meeting_title || aiMinutes.discussion_points);

  // --- Legacy Collapsible States ---
  const [showSummary, setShowSummary] = useState(false);
  const [showAttendees, setShowAttendees] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showDecisions, setShowDecisions] = useState(false);
  const [showActionItems, setShowActionItems] = useState(true);
  const [showBlockers, setShowBlockers] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);

  // --- MoM Collapsible States ---
  const [showSummaryMoM, setShowSummaryMoM] = useState(false); // Meeting Summary (Full Details) collapsed by default
  const [showDecisionsMoM, setShowDecisionsMoM] = useState(false);
  const [showActionItemsMoM, setShowActionItemsMoM] = useState(true); // Action Items expanded by default
  const [showRisksMoM, setShowRisksMoM] = useState(false);

  // Individual item detail toggles
  const [expandedDecisions, setExpandedDecisions] = useState<Record<number, boolean>>({});
  const [expandedBlockers, setExpandedBlockers] = useState<Record<number, boolean>>({});

  // Theme styles resolver
  const isViolet = theme === 'violet';
  const themeClasses = {
    checkSquare: isViolet ? 'text-violet-500' : 'text-azure-500',
    square: isViolet ? 'text-violet-500/40 hover:text-violet-400' : 'text-azure-500/40 hover:text-azure-400',
    cardBg: isViolet ? 'bg-violet-950/10 border-violet-500/10' : 'bg-azure-950/10 border-azure-500/10',
    assignedText: isViolet ? 'text-violet-400 font-semibold' : 'text-azure-400 font-semibold',
  };

  // Helper to slice first two sentences for the Quick Summary fallback
  const getQuickSummary = () => {
    if (aiMinutes.quick_summary) return aiMinutes.quick_summary;
    if (isMoM) {
      return aiMinutes.purpose || '';
    }
    if (!aiMinutes.meeting_summary) return '';
    const sentences = aiMinutes.meeting_summary.match(/[^.!?]+[.!?]+/g) || [aiMinutes.meeting_summary];
    return sentences.slice(0, 2).join(' ').trim();
  };

  // Helper to extract first sentence for blockers/risks headline
  const getBlockerHeadlineAndDetail = (description: string) => {
    if (!description) return { headline: '', detail: '' };
    const sentences = description.match(/[^.!?]+[.!?]+/g) || [description];
    const headline = sentences[0].trim();
    const detail = sentences.slice(1).join(' ').trim();
    return { headline, detail };
  };

  // Check if everything is currently expanded
  const allExpandedLegacy = showSummary && showAttendees && showAgenda && showDecisions && showActionItems && showBlockers && showQuestions;
  const allExpandedMoM = showSummaryMoM && showDecisionsMoM && showActionItemsMoM && showRisksMoM;
  const allExpanded = isMoM ? allExpandedMoM : allExpandedLegacy;

  const handleExpandCollapseAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMoM) {
      const target = !allExpandedMoM;
      setShowSummaryMoM(target);
      setShowDecisionsMoM(target);
      setShowActionItemsMoM(target);
      setShowRisksMoM(target);
    } else {
      const target = !allExpandedLegacy;
      setShowSummary(target);
      setShowAttendees(target);
      setShowAgenda(target);
      setShowDecisions(target);
      setShowActionItems(target);
      setShowBlockers(target);
      setShowQuestions(target);
    }
  };

  const toggleDecision = (idx: number) => {
    setExpandedDecisions(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const toggleBlocker = (idx: number) => {
    setExpandedBlockers(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const quickSummaryText = getQuickSummary();
  const attendeesList = aiMinutes.attendees || aiMinutes.attendees_mentioned || [];
  const agendaCount = (aiMinutes.agenda_topics || []).length;
  const decisionsCount = (aiMinutes.decisions || []).length;
  const actionItemsCount = (actionItems || []).length;
  const blockersCount = (aiMinutes.blockers_or_risks || []).length;
  const questionsCount = (aiMinutes.open_questions || []).length;

  return (
    <div className="bg-zinc-950 border border-indigo-500/20 rounded-xl overflow-hidden mt-2 relative">
      <div className="bg-indigo-950/20 px-4 py-3 border-b border-indigo-500/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-indigo-400" />
          <h5 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">AI Generated Minutes</h5>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={handleExpandCollapseAll}
            className="text-[10px] md:text-xs font-bold text-indigo-400/80 hover:text-indigo-300 px-2 py-1 rounded-md hover:bg-indigo-500/10 transition-colors"
          >
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReanalyze(); }}
            disabled={isReanalyzing}
            className="text-[10px] md:text-xs font-bold text-indigo-400/80 hover:text-indigo-300 flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-indigo-500/10 transition-colors"
            title="Re-analyze transcript"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isReanalyzing ? "animate-spin" : "")} />
            Re-analyze
          </button>
        </div>
      </div>
      <div className="p-4 space-y-5">
        
        {/* Quick Summary View (Always visible at the top, separate from full summary) */}
        {quickSummaryText && (
          <div className="p-3 bg-indigo-950/10 border border-indigo-500/10 rounded-lg flex gap-2.5 items-start">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider font-sans">Quick Summary</span>
              <p className="text-xs text-foreground/90 leading-relaxed font-sans">{quickSummaryText}</p>
            </div>
          </div>
        )}

        {/* ────────── NEW structured Minutes of Meeting (MoM) Layout ────────── */}
        {isMoM ? (
          <>
            {/* 1. Meeting Summary (Full Details) */}
            <details 
              open={showSummaryMoM} 
              onToggle={(e) => setShowSummaryMoM(e.currentTarget.open)} 
              className="group/mom-summary border-b border-border/30 pb-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between hover:text-foreground/90 transition-colors">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Meeting Summary (Full Details)
                </span>
                <div className="flex items-center gap-3">
                  {record && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); generateMeetingDocx(record, aiMinutes, actionItems); }}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded-md"
                    >
                      <Download className="w-3 h-3" />
                      DOCX
                    </button>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open/mom-summary:rotate-90" />
                </div>
              </summary>
              <div className="mt-3.5 space-y-4">
                {/* A. Header Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-zinc-900/40 border border-zinc-800/80 rounded-xl text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider mb-0.5">Meeting Title</span>
                    <span className="text-foreground font-semibold leading-relaxed">{aiMinutes.meeting_title || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider mb-0.5">Meeting Date</span>
                    <span className="text-foreground font-semibold leading-relaxed">{aiMinutes.meeting_date || 'N/A'}</span>
                  </div>
                  {aiMinutes.duration_estimate && (
                    <div>
                      <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider mb-0.5">Duration Estimate</span>
                      <span className="text-foreground font-semibold leading-relaxed">{aiMinutes.duration_estimate}</span>
                    </div>
                  )}
                  {aiMinutes.led_by && (
                    <div>
                      <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider mb-0.5">Led By</span>
                      <span className="text-foreground font-semibold leading-relaxed">{aiMinutes.led_by}</span>
                    </div>
                  )}
                  {aiMinutes.facilitated_by && (
                    <div className="col-span-1 sm:col-span-2">
                      <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider mb-0.5">Facilitated By</span>
                      <span className="text-foreground font-semibold leading-relaxed">{aiMinutes.facilitated_by}</span>
                    </div>
                  )}
                </div>

                {/* B. Attendees (Present / Referenced) */}
                <div className="space-y-2.5">
                  <div>
                    <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider mb-1">Present Attendees</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(aiMinutes.attendees_present || []).length > 0 ? (
                        (aiMinutes.attendees_present || []).map((name: string, i: number) => (
                          <span key={i} className="px-2.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-foreground flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">None recorded</span>
                      )}
                    </div>
                  </div>
                  {(aiMinutes.attendees_referenced_not_present || []).length > 0 && (
                    <div>
                      <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider mb-1">Referenced (Not Present)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(aiMinutes.attendees_referenced_not_present || []).map((name: string, i: number) => (
                          <span key={i} className="px-2.5 py-0.5 bg-zinc-900 border border-zinc-800/80 rounded text-xs text-muted-foreground flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500/50" />
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* C. Purpose */}
                {aiMinutes.purpose && (
                  <div>
                    <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider mb-1">Purpose</span>
                    <div className="p-3 bg-zinc-900/20 border border-zinc-800/50 rounded-xl text-xs text-foreground/80 leading-relaxed font-sans">
                      {aiMinutes.purpose}
                    </div>
                  </div>
                )}

                {/* D. Discussion Points */}
                {(aiMinutes.discussion_points || []).length > 0 && (
                  <div>
                    <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider mb-1">Discussion Points</span>
                    <ul className="list-disc pl-5 space-y-1.5">
                      {(aiMinutes.discussion_points || []).map((point: string, i: number) => (
                        <li key={i} className="text-xs text-foreground/80 leading-relaxed font-sans">
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* E. Next Steps */}
                {aiMinutes.next_steps && (
                  <div>
                    <span className="text-muted-foreground block text-[9px] uppercase font-bold tracking-wider mb-1">Next Steps</span>
                    <div className="p-3 bg-zinc-900/20 border border-zinc-800/50 rounded-xl text-xs text-foreground/80 leading-relaxed font-sans">
                      {aiMinutes.next_steps}
                    </div>
                  </div>
                )}
              </div>
            </details>

            {/* 2. Decisions Made */}
            <details 
              open={showDecisionsMoM} 
              onToggle={(e) => setShowDecisionsMoM(e.currentTarget.open)} 
              className="group/mom-decisions border-b border-border/30 pb-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between hover:text-foreground/90 transition-colors">
                <span className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-wider flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-emerald-500" /> Key Decisions Made
                  <span className="ml-1.5 px-1.5 py-0.25 text-[9px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/10 rounded-full">
                    {(aiMinutes.decisions || []).length}
                  </span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open/mom-decisions:rotate-90" />
              </summary>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-border/50">
                      <th className="p-2.5 font-bold text-muted-foreground text-[9px] uppercase tracking-wider w-1/2">Decision</th>
                      <th className="p-2.5 font-bold text-muted-foreground text-[9px] uppercase tracking-wider w-1/5">Owner</th>
                      <th className="p-2.5 font-bold text-muted-foreground text-[9px] uppercase tracking-wider w-3/10">Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {(aiMinutes.decisions || []).length > 0 ? (
                      (aiMinutes.decisions || []).map((d: any, i: number) => (
                        <tr key={i} className="hover:bg-zinc-900/30 transition-colors">
                          <td className="p-2.5 text-foreground font-medium align-top leading-relaxed">
                            {d.decision}
                            <div className="mt-1 flex gap-2">
                              {d.confidence && d.confidence.toLowerCase() !== 'high' && (
                                <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${d.confidence.toLowerCase() === 'low' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                  {d.confidence} Conf
                                </span>
                              )}
                              {(d.source_excerpt || d.sourceExcerpt) && (
                                <span className="inline-block text-[10px] text-muted-foreground cursor-help" title={d.source_excerpt || d.sourceExcerpt}>
                                  Source ℹ️
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 text-emerald-400 font-semibold align-top">{d.owner || 'Unassigned'}</td>
                          <td className="p-2.5 text-muted-foreground align-top leading-normal">{d.rationale || 'N/A'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-muted-foreground italic">No decisions recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>

            {/* 3. Action Items */}
            <details 
              open={showActionItemsMoM} 
              onToggle={(e) => setShowActionItemsMoM(e.currentTarget.open)} 
              className="group/mom-actions border-b border-border/30 pb-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between hover:text-foreground/90 transition-colors">
                <span className="text-[10px] font-bold text-azure-500/70 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-azure-500" /> Action Items
                  <span className="ml-1.5 px-1.5 py-0.25 text-[9px] font-bold bg-azure-950/60 text-azure-400 border border-azure-500/10 rounded-full">
                    {actionItemsCount}
                  </span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open/mom-actions:rotate-90" />
              </summary>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border/50">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-900 border-b border-border/50">
                      <th className="p-2.5 font-bold text-muted-foreground text-[9px] uppercase tracking-wider w-1/2">Task</th>
                      <th className="p-2.5 font-bold text-muted-foreground text-[9px] uppercase tracking-wider w-1/5">Owner</th>
                      <th className="p-2.5 font-bold text-muted-foreground text-[9px] uppercase tracking-wider w-1/6">Status</th>
                      <th className="p-2.5 font-bold text-muted-foreground text-[9px] uppercase tracking-wider w-1/6">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {actionItemsCount > 0 ? (
                      (actionItems || []).map((ai: any) => {
                        const isOverdue = ai.dueDate && new Date(ai.dueDate) < new Date() && !ai.completed;
                        return (
                          <tr key={ai.id} className={cn(
                            "hover:bg-zinc-900/30 transition-colors align-top",
                            ai.completed && "opacity-60 bg-muted/5"
                          )}>
                            <td className="p-2.5 text-foreground leading-relaxed">
                              <div className="flex items-start gap-2 min-w-0">
                                <button 
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); onToggleActionItem(ai.id, !ai.completed); }}
                                  className="mt-0.5 flex-shrink-0 focus:outline-none"
                                >
                                  {ai.completed ? (
                                    <CheckSquare className="w-4 h-4 text-emerald-500" />
                                  ) : (
                                    <Square className={cn("w-4 h-4", themeClasses.square)} />
                                  )}
                                </button>
                                <span className={cn("truncate flex-1 font-medium", ai.completed ? "text-muted-foreground line-through" : "text-foreground/90")}>
                                  {ai.task}
                                </span>
                                {renderPriorityBadge(ai.priority)}
                              </div>
                            </td>
                            <td className="p-2.5 font-medium text-zinc-300">
                              {ai.assignedTo ? (
                                <Link to={`/members/${ai.assignedTo.id}`} className="hover:underline underline-offset-2 text-azure-400 font-semibold">{ai.assignedTo.name}</Link>
                              ) : (
                                <span className="text-zinc-400">{ai.originalOwnerText || 'Unassigned'}</span>
                              )}
                            </td>
                            <td className="p-2.5">
                              {ai.completed ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                  Completed
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">
                                  Open
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              {ai.dueDate ? (
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0",
                                  isOverdue 
                                    ? "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse" 
                                    : "bg-zinc-900 text-zinc-400 border-zinc-800"
                                )}>
                                  {formatDate(ai.dueDate)}
                                  {isOverdue && " (Overdue)"}
                                </span>
                              ) : (
                                <span className="text-zinc-500 font-sans italic">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-muted-foreground italic">No action items recorded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>

            {/* 4. Open Risks / Blockers */}
            <details 
              open={showRisksMoM} 
              onToggle={(e) => setShowRisksMoM(e.currentTarget.open)} 
              className="group/mom-risks border-b border-border/30 pb-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between hover:text-foreground/90 transition-colors">
                <span className="text-[10px] font-bold text-red-500/70 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Open Risks & Blockers
                  <span className="ml-1.5 px-1.5 py-0.25 text-[9px] font-bold bg-red-950/60 text-red-400 border border-red-500/10 rounded-full">
                    {(aiMinutes.open_risks_blockers || []).length}
                  </span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open/mom-risks:rotate-90" />
              </summary>
              <div className="mt-2.5">
                {(aiMinutes.open_risks_blockers || []).length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1.5">
                    {(aiMinutes.open_risks_blockers || []).map((risk: any, i: number) => (
                      <li key={i} className="text-xs text-red-200/80 leading-relaxed font-sans group/risk">
                        {risk.description || risk}
                        {risk.confidence && (
                          <span className="ml-2 inline-flex items-center text-[9px] opacity-0 group-hover/risk:opacity-100 transition-opacity">
                            <span className={`px-1 py-0.5 rounded border ${risk.confidence === 'High' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                              {risk.confidence} Confidence
                            </span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No blockers or risks identified.</p>
                )}
              </div>
            </details>

            {/* ────────── PROGRESS UPDATES ────────── */}
            {aiMinutes.progress_updates && aiMinutes.progress_updates.length > 0 && (
              <details 
                open={showRisksMoM} // sharing toggle for now
                onToggle={(e) => setShowRisksMoM(e.currentTarget.open)} 
                className="group/mom-prog border-b border-border/30 pb-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between hover:text-foreground/90 transition-colors">
                  <span className="text-[10px] font-bold text-azure-500/70 uppercase tracking-wider flex items-center gap-1.5">
                    <List className="w-3.5 h-3.5 text-azure-500" /> Progress Updates
                    <span className="ml-1.5 px-1.5 py-0.25 text-[9px] font-bold bg-azure-950/60 text-azure-400 border border-azure-500/10 rounded-full">
                      {aiMinutes.progress_updates.length}
                    </span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open/mom-prog:rotate-90" />
                </summary>
                <div className="mt-2.5">
                  <ul className="list-disc pl-5 space-y-1.5">
                    {aiMinutes.progress_updates.map((prog: any, i: number) => (
                      <li key={i} className="text-xs text-foreground/80 leading-relaxed font-sans group/prog">
                        <span className="font-semibold">{prog.topic}:</span> {prog.exact_value}
                        {prog.confidence && (
                          <span className="ml-2 inline-flex items-center text-[9px] opacity-0 group-hover/prog:opacity-100 transition-opacity">
                            <span className={`px-1 py-0.5 rounded border ${prog.confidence === 'High' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                              {prog.confidence}
                            </span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            )}


          </>
        ) : (
          /* ────────── LEGACY Fallback Rendering Layout ────────── */
          <>
            {/* 1. Full Meeting Summary */}
            {aiMinutes.meeting_summary && (
              <details 
                open={showSummary} 
                onToggle={(e) => setShowSummary(e.currentTarget.open)} 
                className="group/summary border-b border-border/30 pb-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between hover:text-foreground/90 transition-colors">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Meeting Summary (Full Details)
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open/summary:rotate-90" />
                </summary>
                <div className="mt-2.5 space-y-2">
                  {renderFormattedText(aiMinutes.meeting_summary)}
                </div>
              </details>
            )}

            {/* 2. Attendees */}
            {attendeesList.length > 0 && (
              <details 
                open={showAttendees} 
                onToggle={(e) => setShowAttendees(e.currentTarget.open)} 
                className="group/attendees border-b border-border/30 pb-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between hover:text-foreground/90 transition-colors">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Attendees 
                    <span className="ml-1.5 px-1.5 py-0.25 text-[9px] font-bold bg-zinc-800 text-zinc-400 rounded-full">
                      {attendeesList.length}
                    </span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open/attendees:rotate-90" />
                </summary>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {attendeesList.map((a: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-muted rounded-md text-xs text-foreground">{a}</span>
                  ))}
                </div>
              </details>
            )}

            {/* 3. Agenda Topics */}
            {agendaCount > 0 && (
              <details 
                open={showAgenda} 
                onToggle={(e) => setShowAgenda(e.currentTarget.open)} 
                className="group/agenda border-b border-border/30 pb-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between hover:text-foreground/90 transition-colors">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <List className="w-3.5 h-3.5" /> Agenda Topics 
                    <span className="ml-1.5 px-1.5 py-0.25 text-[9px] font-bold bg-zinc-800 text-zinc-400 rounded-full">
                      {agendaCount}
                    </span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open/agenda:rotate-90" />
                </summary>
                <ul className="list-disc pl-5 space-y-1.5 mt-2.5">
                  {aiMinutes.agenda_topics.map((t: string, i: number) => (
                    <li key={i} className="text-xs text-foreground/80 leading-relaxed">{t}</li>
                  ))}
                </ul>
              </details>
            )}

            {/* 4. Key Decisions */}
            {decisionsCount > 0 && (
              <details 
                open={showDecisions} 
                onToggle={(e) => setShowDecisions(e.currentTarget.open)} 
                className="group/decisions border-b border-border/30 pb-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between hover:text-foreground/90 transition-colors">
                  <span className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-wider flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-emerald-500" /> Key Decisions 
                    <span className="ml-1.5 px-1.5 py-0.25 text-[9px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/10 rounded-full">
                      {decisionsCount}
                    </span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open/decisions:rotate-90" />
                </summary>
                <ul className="list-disc pl-5 space-y-3.5 mt-2.5">
                  {aiMinutes.decisions.map((d: any, i: number) => {
                    const text = typeof d === 'object' && d !== null ? d.decision_text : d;
                    const decBy = typeof d === 'object' && d !== null ? d.decided_by : null;
                    const context = typeof d === 'object' && d !== null ? d.context : null;
                    const hasDetails = !!(decBy || context);
                    const isExpanded = !!expandedDecisions[i];

                    return (
                      <li key={i} className="text-xs text-emerald-100/80 leading-relaxed list-none flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <span className="font-medium">{text}</span>
                          {hasDetails && (
                            <div className="mt-1">
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); toggleDecision(i); }}
                                className="text-[10px] text-emerald-400/80 hover:text-emerald-300 font-bold flex items-center gap-0.5 focus:outline-none"
                              >
                                {isExpanded ? "Hide reasoning" : "Show reasoning"}
                              </button>
                              {isExpanded && (
                                <span className="block text-[10px] text-emerald-400/75 mt-1.5 p-2 bg-emerald-950/20 border border-emerald-500/15 rounded-lg font-sans leading-normal">
                                  {decBy && <span><strong>Decided by:</strong> {decBy}</span>}
                                  {decBy && context && <span className="mx-1.5">•</span>}
                                  {context && <span><strong>Context:</strong> {context}</span>}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}

            {/* 5. Action Items */}
            {actionItemsCount > 0 && (
              <details 
                open={showActionItems} 
                onToggle={(e) => setShowActionItems(e.currentTarget.open)} 
                className="group/actions border-b border-border/30 pb-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between hover:text-foreground/90 transition-colors">
                  <span className="text-[10px] font-bold text-azure-500/70 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-azure-500" /> Action Items 
                    <span className="ml-1.5 px-1.5 py-0.25 text-[9px] font-bold bg-azure-950/60 text-azure-400 border border-azure-500/10 rounded-full">
                      {actionItemsCount}
                    </span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open/actions:rotate-90" />
                </summary>
                <div className="space-y-2 mt-2.5">
                  {actionItems.map((ai: any) => {
                    const isOverdue = ai.dueDate && new Date(ai.dueDate) < new Date() && !ai.completed;
                    return (
                      <div key={ai.id} className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 px-3 rounded-lg border transition-all text-xs duration-200 hover:translate-x-0.5",
                        ai.completed 
                          ? "bg-muted/10 border-transparent opacity-50" 
                          : cn("hover:border-indigo-500/30", themeClasses.cardBg)
                      )}>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); onToggleActionItem(ai.id, !ai.completed); }}
                            className="flex-shrink-0 focus:outline-none"
                          >
                            {ai.completed ? (
                              <CheckSquare className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Square className={cn("w-4 h-4", themeClasses.square)} />
                            )}
                          </button>
                          {renderPriorityBadge(ai.priority)}
                          <span className={cn("truncate flex-1 font-medium", ai.completed ? "text-muted-foreground line-through" : "text-foreground/90")}>
                            {ai.task}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[9px] font-semibold text-zinc-400 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-zinc-500" />
                            {ai.assignedTo ? (
                              <Link to={`/members/${ai.assignedTo.id}`} className="hover:underline underline-offset-2 text-zinc-300">{ai.assignedTo.name}</Link>
                            ) : (
                              <span>{ai.originalOwnerText}</span>
                            )}
                          </span>
                          {ai.dueDate && (
                            <span className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0",
                              isOverdue 
                                ? "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse" 
                                : "bg-zinc-900 text-zinc-400 border-zinc-800"
                            )}>
                              Due: {formatDate(ai.dueDate)}
                              {isOverdue && " (Overdue)"}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

            {/* 6. Blockers & Risks */}
            {blockersCount > 0 && (
              <details 
                open={showBlockers} 
                onToggle={(e) => setShowBlockers(e.currentTarget.open)} 
                className="group/risks border-b border-border/30 pb-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between hover:text-foreground/90 transition-colors">
                  <span className="text-[10px] font-bold text-red-500/70 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Blockers & Risks 
                    <span className="ml-1.5 px-1.5 py-0.25 text-[9px] font-bold bg-red-950/60 text-red-400 border border-red-500/10 rounded-full">
                      {blockersCount}
                    </span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open/risks:rotate-90" />
                </summary>
                <ul className="list-disc pl-5 space-y-3.5 mt-2.5">
                  {aiMinutes.blockers_or_risks.map((q: any, i: number) => {
                    const desc = typeof q === 'object' && q !== null ? q.description : q;
                    const status = typeof q === 'object' && q !== null ? q.status : null;
                    const { headline, detail } = getBlockerHeadlineAndDetail(desc);
                    const isExpanded = !!expandedBlockers[i];

                    return (
                      <li key={i} className="text-xs text-red-200/80 leading-relaxed list-none flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="font-medium">{headline}</span>
                            {status && (
                              <span className={cn(
                                "text-[9px] font-bold px-1.5 py-0.25 rounded-md",
                                status === 'resolved' ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                              )}>
                                {status.toUpperCase()}
                              </span>
                            )}
                          </div>
                          {detail && (
                            <div className="mt-1">
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); toggleBlocker(i); }}
                                className="text-[10px] text-red-400/80 hover:text-red-300 font-bold flex items-center gap-0.5 focus:outline-none"
                              >
                                {isExpanded ? "Hide details" : "Show details"}
                              </button>
                              {isExpanded && (
                                <span className="block text-[10px] text-red-400/75 mt-1.5 p-2 bg-red-950/20 border border-red-500/15 rounded-lg font-sans leading-normal">
                                  {detail}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}

            {/* 7. Open Questions */}
            {questionsCount > 0 && (
              <details 
                open={showQuestions} 
                onToggle={(e) => setShowQuestions(e.currentTarget.open)} 
                className="group/questions [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between hover:text-foreground/90 transition-colors">
                  <span className="text-[10px] font-bold text-amber-500/70 uppercase tracking-wider flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-500" /> Open Questions 
                    <span className="ml-1.5 px-1.5 py-0.25 text-[9px] font-bold bg-amber-950/60 text-amber-400 border border-amber-500/10 rounded-full">
                      {questionsCount}
                    </span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open/questions:rotate-90" />
                </summary>
                <ul className="list-disc pl-5 space-y-1.5 mt-2.5">
                  {aiMinutes.open_questions.map((q: string, i: number) => (
                    <li key={i} className="text-xs text-amber-100/80 leading-relaxed">{q}</li>
                  ))}
                </ul>
              </details>
            )}
            {/* STT Name Corrections Audit Log */}
            {aiMinutes.name_corrections && aiMinutes.name_corrections.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/30">
                <details className="group/corrections [&_summary::-webkit-details-marker]:hidden bg-zinc-950/40 border border-border/30 rounded-xl p-3">
                  <summary className="cursor-pointer list-none flex items-center justify-between hover:text-foreground/90 transition-colors">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5",
                      isViolet ? "text-violet-400" : "text-azure-400"
                    )}>
                      <BrainCircuit className="w-3.5 h-3.5" /> Speech-to-Text Auto-Corrections
                      <span className={cn(
                        "ml-1.5 px-1.5 py-0.25 text-[9px] font-bold border rounded-full",
                        isViolet ? "bg-violet-950/60 text-violet-400 border-violet-500/10" : "bg-azure-950/60 text-azure-400 border-azure-500/10"
                      )}>
                        {aiMinutes.name_corrections.length}
                      </span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition-transform group-open/corrections:rotate-90" />
                  </summary>
                  <div className="mt-2.5 space-y-2.5 max-h-40 overflow-y-auto pr-1">
                    <p className="text-[10px] text-muted-foreground leading-normal font-sans">
                      The following misheard names in the raw transcript were automatically matched against the project roster and corrected before analysis:
                    </p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {aiMinutes.name_corrections.map((corr: any, idx: number) => (
                        <div key={idx} className="flex items-center p-2 bg-zinc-950 border border-border/30 rounded-lg text-xs font-sans">
                          <span className="font-mono text-red-400 text-[10px] line-through">{corr.original}</span>
                          <span className="text-muted-foreground text-[10px] mx-2">→</span>
                          <span className="font-semibold text-emerald-400 text-[10px]">{corr.corrected}</span>
                          <span className="text-[9px] text-muted-foreground/60 ml-auto bg-zinc-900 px-1.5 py-0.5 rounded border border-border/20">
                            {corr.score}% confidence
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
