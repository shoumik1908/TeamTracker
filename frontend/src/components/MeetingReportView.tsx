import { useState, useCallback } from 'react';
import {
  BarChart2, CalendarDays, RefreshCw, Download, ChevronLeft, ChevronRight,
  AlertTriangle, Circle, Shield, TrendingUp, Gavel, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateReportDocx } from '@/lib/exportDocx';
import api from '@/lib/api';

type WindowType = 'daily' | 'weekly' | 'monthly' | 'custom';

function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Mon start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch(e) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}

function fmtDisplay(dateStr: string | null | undefined) {
  if (!dateStr) return 'Unknown Date';
  return formatDate(dateStr);
}

// Confidence badge
const ConfBadge = ({ confidence }: { confidence: string }) => {
  if (confidence === 'Low') return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
      <AlertTriangle className="w-2.5 h-2.5" /> Needs Verification
    </span>
  );
  if (confidence === 'Medium') return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded-full">
      Medium Confidence
    </span>
  );
  return null;
};

export default function MeetingReportView({ projectId, projectName }: { projectId: string; projectName: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [windowType, setWindowType] = useState<WindowType>('weekly');
  const [refDate, setRefDate] = useState(today);
  const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [reportGenTime, setReportGenTime] = useState<string>('');

  const getRange = useCallback((): { start: Date; end: Date; label: string } => {
    if (windowType === 'daily') {
      const end = new Date(refDate);
      end.setHours(23, 59, 59, 999);
      return { start: refDate, end, label: fmtDisplay(refDate.toISOString()) };
    }
    if (windowType === 'weekly') {
      const start = getWeekStart(refDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return {
        start,
        end,
        label: fmtDisplay(start.toISOString()) + ' – ' + fmtDisplay(end.toISOString())
      };
    }
    if (windowType === 'monthly') {
      const start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      const end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        start,
        end,
        label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      };
    }
    // custom
    const s = new Date(customStart);
    const e = new Date(customEnd);
    e.setHours(23, 59, 59, 999);
    return {
      start: s,
      end: e,
      label: fmtDisplay(customStart) + ' – ' + fmtDisplay(customEnd)
    };
  }, [windowType, refDate, customStart, customEnd]);

  const navigate = (dir: -1 | 1) => {
    const d = new Date(refDate);
    if (windowType === 'daily') d.setDate(d.getDate() + dir);
    if (windowType === 'weekly') d.setDate(d.getDate() + dir * 7);
    if (windowType === 'monthly') d.setMonth(d.getMonth() + dir);
    setRefDate(d);
  };

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    const range = getRange();
    const start = range.start.toISOString().split('T')[0];
    const end = range.end.toISOString().split('T')[0];
    try {
      const res = await api.get('/projects/' + projectId + '/meeting-report?start=' + start + '&end=' + end);
      const data = res.data;
      setReportData(data);
      setPeriod({ start, end });
      setReportGenTime(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' IST');
    } catch (e: any) {
      setError(e.response?.data?.error || e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const { label } = getRange();

  // Consolidation Logic
  let allDecisions: any[] = [];
  let openActionsByOwner: Record<string, any[]> = {};
  let allRisks: any[] = [];
  
  if (reportData && reportData.meetings) {
    reportData.meetings.forEach((m: any) => {
      if (!m.aiMinutes) return;
      const am = m.aiMinutes;
      const displayDate = am.meeting_date || fmtDisplay(m.meetingDate);

      // Decisions
      if (am.decisions?.length) {
        am.decisions.forEach((d: any) => {
          allDecisions.push({ ...d, meetingDisplayDate: displayDate });
        });
      }

      // Open Actions
      if (am.action_items?.length) {
        am.action_items.forEach((a: any) => {
          if (a.status === 'Open') {
            const owner = a.owner || 'Unassigned';
            if (!openActionsByOwner[owner]) openActionsByOwner[owner] = [];
            openActionsByOwner[owner].push({ ...a, meetingDisplayDate: displayDate });
          }
        });
      }

      // Risks
      if (am.open_risks_blockers?.length) {
        am.open_risks_blockers.forEach((r: any) => {
          allRisks.push({ ...r, meetingDisplayDate: displayDate });
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Configuration Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-md font-bold text-foreground flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-azure-400" />
            Meeting Report
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Consolidated report strictly from stored AI summaries.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
        <div className="flex gap-1.5 p-1 bg-zinc-900/60 rounded-xl w-fit">
          {(['daily', 'weekly', 'monthly', 'custom'] as WindowType[]).map(w => (
            <button
              key={w}
              onClick={() => { setWindowType(w); setReportData(null); }}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all capitalize',
                windowType === w
                  ? 'bg-azure-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-zinc-800'
              )}
            >
              {w}
            </button>
          ))}
        </div>

        {windowType !== 'custom' ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground min-w-[220px] justify-center">
              <CalendarDays className="w-4 h-4 text-azure-400" />
              {label}
            </div>
            <button
              onClick={() => navigate(1)}
              className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Start</label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">End</label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-foreground"
              />
            </div>
          </div>
        )}

        <button
          onClick={generateReport}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-azure-500 hover:bg-azure-600 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-all"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
          {loading ? 'Generating...' : 'Generate Report'}
        </button>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Report Output */}
      {reportData && period && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden text-sm">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-border bg-zinc-900/40">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {projectName} — Meeting Report
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                {windowType === 'daily' ? 'Daily' : windowType === 'weekly' ? 'Weekly' : windowType === 'monthly' ? 'Monthly' : 'Custom'}: {fmtDisplay(period.start)} – {fmtDisplay(period.end)} &middot; {reportData.meetings.length} meetings included
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => generateReportDocx(reportData, projectName, label, period, windowType)}
                className="flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-2 rounded-lg transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Download DOCX
              </button>
            </div>
          </div>

          {reportData.meetings.length === 0 ? (
            <div className="p-10 text-center">
              <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No meetings found between {fmtDisplay(period.start)} and {fmtDisplay(period.end)}</p>
            </div>
          ) : (
            <div className="p-6 space-y-10">

              {/* 1. EXECUTIVE SUMMARY */}
              {reportData.executiveSummary && (
                <section>
                  <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">
                    Progress Update ({fmtDisplay(period.start)} - {fmtDisplay(period.end)})
                  </h3>
                  <div className="bg-azure-500/10 border border-azure-500/20 rounded-xl p-4">
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {reportData.executiveSummary}
                    </p>
                  </div>
                </section>
              )}

              {/* 2. MEETINGS COVERED */}
              <section>
                <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">Meetings Covered</h3>
                <ol className="list-decimal list-inside space-y-2 text-foreground/80 pl-2">
                  {reportData.meetings.map((m: any) => {
                    const displayDate = m.aiMinutes?.meeting_date || fmtDisplay(m.meetingDate);
                    return (
                      <li key={m.id} className="marker:text-muted-foreground marker:font-semibold">
                        <a href={`#meeting-${m.id}`} className="hover:text-azure-400 hover:underline transition-colors font-medium">
                          {m.meetingTitle} — {displayDate}
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </section>

              {/* 3. PER-MEETING BREAKDOWN */}
              <section className="space-y-8">
                <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">Per-Meeting Breakdown</h3>
                
                {reportData.meetings.map((m: any) => {
                  const am = m.aiMinutes;
                  if (!am) return null;
                  const displayDate = am.meeting_date || fmtDisplay(m.meetingDate);
                  
                  const hasDecisions = am.decisions && am.decisions.length > 0;
                  const hasProgress = am.progress_updates && am.progress_updates.length > 0;
                  const hasActions = am.action_items && am.action_items.length > 0;
                  const hasRisks = am.open_risks_blockers && am.open_risks_blockers.length > 0;

                  // Omit entirely if all sections empty? Usually there's at least progress or actions.
                  if (!hasDecisions && !hasProgress && !hasActions && !hasRisks && !am.quick_summary && !am.purpose) return null;

                  return (
                    <div key={m.id} className="pt-8 first:pt-4 border-t border-border/50 mt-8 first:mt-4">
                      <h4 id={`meeting-${m.id}`} className="text-lg font-bold text-foreground mb-4">
                        {displayDate} <span className="text-muted-foreground font-normal mx-2">—</span> {m.meetingTitle}
                      </h4>
                      
                      <div className="space-y-6">
                        {/* Summary & Agenda */}
                        {(am.quick_summary || am.purpose) && (
                          <div className="space-y-4 mb-6">
                            {am.quick_summary && (
                              <div>
                                <h5 className="text-sm font-bold text-foreground mb-1">Meeting Summary</h5>
                                <p className="text-sm text-foreground/80 leading-relaxed">{am.quick_summary}</p>
                              </div>
                            )}
                            {am.purpose && (
                              <div>
                                <h5 className="text-sm font-bold text-foreground mb-1">Agenda / Purpose</h5>
                                <p className="text-sm text-foreground/80 leading-relaxed">{am.purpose}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Decisions */}
                        {hasDecisions && (
                          <div>
                            <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Gavel className="w-3.5 h-3.5"/> Key Decisions</h5>
                            <ul className="list-disc list-outside space-y-1.5 pl-5 text-foreground/80">
                              {am.decisions.map((d: any, i: number) => (
                                <li key={i}>{d.decision} {d.confidence !== 'High' && <ConfBadge confidence={d.confidence} />}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {hasProgress && (
                          <div>
                            <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5"/> Progress Updates</h5>
                            <ul className="list-disc list-outside space-y-1.5 pl-5 text-foreground/80">
                              {am.progress_updates.map((p: any, i: number) => (
                                <li key={i}>{p.exact_value} {p.confidence !== 'High' && <ConfBadge confidence={p.confidence} />}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {hasActions && (
                          <div>
                            <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Circle className="w-3.5 h-3.5"/> Action Items</h5>
                            <ul className="list-disc list-outside space-y-1.5 pl-5 text-foreground/80">
                              {am.action_items.map((a: any, i: number) => (
                                <li key={i}>{a.task} — <span className="font-semibold">{a.owner || 'Unassigned'}</span> {a.confidence !== 'High' && <ConfBadge confidence={a.confidence} />}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {hasRisks && (
                          <div>
                            <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-red-400"/> Risks / Blockers</h5>
                            <ul className="list-disc list-outside space-y-1.5 pl-5 text-foreground/80">
                              {am.open_risks_blockers.map((r: any, i: number) => (
                                <li key={i} className="text-red-200">{r.description} {r.confidence !== 'High' && <ConfBadge confidence={r.confidence} />}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
              </section>

              {/* 4. CONSOLIDATED ROLLUP */}
              {(allDecisions.length > 0 || Object.keys(openActionsByOwner).length > 0 || allRisks.length > 0) && (
                <section className="space-y-6 pt-4 border-t border-border">
                  <h3 className="text-sm font-extrabold text-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">Consolidated Rollup</h3>
                  
                  {allDecisions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5 text-azure-200"><Gavel className="w-4 h-4"/> All Decisions This Period</h4>
                      <ul className="list-disc list-outside space-y-1.5 pl-5 text-foreground/80">
                        {allDecisions.map((d, i) => (
                          <li key={i}>{d.decision} {d.confidence !== 'High' && <ConfBadge confidence={d.confidence} />}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Object.keys(openActionsByOwner).length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5 text-azure-200"><Circle className="w-4 h-4"/> Outstanding Action Items</h4>
                      <div className="space-y-4 pl-2">
                        {Object.entries(openActionsByOwner).map(([owner, items]) => (
                          <div key={owner}>
                            <h5 className="font-bold text-foreground flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-muted-foreground"/> {owner}</h5>
                            <ul className="list-disc list-outside space-y-1.5 pl-5 text-foreground/80">
                              {items.map((a, i) => (
                                <li key={i}>{a.task} {a.confidence !== 'High' && <ConfBadge confidence={a.confidence} />}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {allRisks.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5 text-red-400"><Shield className="w-4 h-4"/> Risks / Blockers Raised This Period</h4>
                      <ul className="list-disc list-outside space-y-1.5 pl-5 text-foreground/80">
                        {allRisks.map((r, i) => (
                          <li key={i} className="text-red-200">{r.description} {r.confidence !== 'High' && <ConfBadge confidence={r.confidence} />}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {/* 5. FOOTER */}
              <div className="pt-6 border-t border-border text-xs text-muted-foreground text-center space-y-1">
                <p>Generated on {reportGenTime}</p>
                <p>Generated from {reportData.meetings.length} meeting transcript{reportData.meetings.length !== 1 ? 's' : ''} between {fmtDisplay(period.start)} and {fmtDisplay(period.end)}</p>
                <p className="mt-2 text-[10px] italic max-w-2xl mx-auto">This report reflects AI-generated meeting minutes only and has not been independently verified. Items marked with a confidence tag should be manually confirmed against the source meeting.</p>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
