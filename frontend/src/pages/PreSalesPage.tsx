import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { presalesApi } from '@/lib/presalesApi';
import StageTimeline from '@/components/StageTimeline';
import ConfirmationModal from '@/components/ConfirmationModal';
import AddOpportunityModal from '@/components/AddOpportunityModal';
import EditOpportunityModal from '@/components/EditOpportunityModal';
import PresalesDocAnalyzerModal from '@/components/PresalesDocAnalyzerModal';
import PresalesDocsModal from '@/components/PresalesDocsModal';
import {
  Target,
  Trophy,
  Activity,
  Search,
  Info,
  CheckCircle2,
  XCircle,
  Briefcase,
  Plus,
  X,
  Loader2,
  MoreVertical,
  Pencil,
  FileUp,
  FileText,
  RefreshCcw,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PreSalesOpportunity } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface PendingChange {
  opportunity: PreSalesOpportunity;
  targetStageName: string;
  targetStageIndex: number;
}

interface GroupedOpportunity {
  name: string;
  clientName: string;
  pnbOpp?: PreSalesOpportunity;
  tnmOpp?: PreSalesOpportunity;
}

interface DeletionTarget {
  name: string;
  clientName: string;
  account?: 'PNB' | 'TNM';
}

export default function PreSalesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'PNB' | 'TNM'>('ALL');
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [oppToDelete, setOppToDelete] = useState<DeletionTarget | null>(null);
  const [oppToReset, setOppToReset] = useState<PreSalesOpportunity | null>(null);
  const [oppToEdit, setOppToEdit] = useState<GroupedOpportunity | null>(null);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'info' | 'success' } | null>(null);
  const [analyzerTarget, setAnalyzerTarget] = useState<GroupedOpportunity | null>(null);
  const [docsTarget, setDocsTarget] = useState<GroupedOpportunity | null>(null);

  const { hasPermission } = useAuth();
  const isAdmin = hasPermission('manageTeam');

  // Close dropdown menu when clicking anywhere else
  useEffect(() => {
    const handleOutsideClick = () => setOpenMenuKey(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Fetch opportunities using React Query
  const { data: response, isLoading } = useQuery({
    queryKey: ['presales-opportunities'],
    queryFn: () => presalesApi.list(),
    refetchInterval: 30000,
  });

  const opportunities = response?.data || [];

  // Mutation to update opportunity stage
  const updateStageMutation = useMutation({
    mutationFn: ({ id, stageIndex }: { id: string; stageIndex: number }) =>
      presalesApi.updateStage(id, stageIndex),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['presales-opportunities'] });
      showToast(`Updated stage for "${res.data.name}" successfully.`, 'success');
      setPendingChange(null);
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update stage.', 'info');
      setPendingChange(null);
    }
  });

  // Mutation to delete opportunity card or specific timeline
  const deleteMutation = useMutation({
    mutationFn: ({ name, clientName, account }: { name: string; clientName: string; account?: 'PNB' | 'TNM' }) =>
      presalesApi.delete(name, clientName, account),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-opportunities'] });
      showToast('Opportunity deleted successfully.', 'success');
      setOppToDelete(null);
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to delete opportunity.', 'info');
      setOppToDelete(null);
    }
  });

  // Mutation to reset progress
  const resetMutation = useMutation({
    mutationFn: (id: string) => presalesApi.reset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-opportunities'] });
      showToast('Progress reset successfully.', 'success');
      setOppToReset(null);
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to reset progress.', 'info');
      setOppToReset(null);
    }
  });

  const showToast = (text: string, type: 'info' | 'success') => {
    setToastMessage({ text, type });
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleStageClick = (opportunity: PreSalesOpportunity, stageName: string, stageIndex: number) => {
    if (!isAdmin) {
      showToast('Only admins can change stages.', 'info');
      return;
    }

    if (opportunity.currentStageIndex === stageIndex) {
      showToast(`Opportunity is already in "${stageName}" stage.`, 'info');
      return;
    }

    setPendingChange({
      opportunity,
      targetStageName: stageName,
      targetStageIndex: stageIndex,
    });
  };

  const handleConfirmChange = () => {
    if (!pendingChange) return;

    updateStageMutation.mutate({
      id: pendingChange.opportunity.id,
      stageIndex: pendingChange.targetStageIndex,
    });
  };

  // Helper to render current stage badges
  const renderStageBadge = (opp: PreSalesOpportunity) => {
    const stage = opp.stages[opp.currentStageIndex];
    const isLastStage = opp.currentStageIndex === opp.stages.length - 1;
    const isWon = stage.toLowerCase().includes('won') || isLastStage;
    const isLost = stage.toLowerCase().includes('lost');

    return (
      <span
        className={cn(
          'px-2.5 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 w-fit',
          isWon
            ? 'bg-green-950/40 text-green-400 border-green-900/40'
            : isLost
            ? 'bg-red-950/40 text-red-400 border-red-900/40'
            : 'bg-azure-950/40 text-azure-400 border-azure-950/40'
        )}
      >
        {isWon ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        ) : isLost ? (
          <XCircle className="w-3.5 h-3.5 text-red-400" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-azure-400 animate-pulse" />
        )}
        {stage}
      </span>
    );
  };

  // Helper to render opportunity footer summary details
  const renderFooterDetails = (opp: PreSalesOpportunity) => {
    const stage = opp.stages[opp.currentStageIndex];
    const isLastStage = opp.currentStageIndex === opp.stages.length - 1;
    const isWon = stage.toLowerCase().includes('won') || isLastStage;
    const isLost = stage.toLowerCase().includes('lost');
    const hasNextStage = opp.currentStageIndex < opp.stages.length - 1;

    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-white/50 bg-muted/5 px-5 py-1.5 rounded-b-xl border-t border-white/5/30">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />
          <span>
            {isWon ? (
              <span className="text-emerald-400 font-semibold">Deal successfully closed!</span>
            ) : isLost ? (
              <span className="text-red-400 font-semibold">Opportunity closed lost.</span>
            ) : hasNextStage ? (
              <>
                Next Stage: <strong className="text-foreground">{opp.stages[opp.currentStageIndex + 1]}</strong>
              </>
            ) : (
              'No remaining stages.'
            )}
          </span>
        </div>
        <div>
          <span>Click any timeline dot to transition.</span>
        </div>
      </div>
    );
  };

  // 1. Group opportunities by clientName + name to display them under single parent cards
  const groupedMap: Record<string, GroupedOpportunity> = {};
  opportunities.forEach((opp) => {
    const key = `${opp.clientName.toLowerCase()}::${opp.name.toLowerCase()}`;
    if (!groupedMap[key]) {
      groupedMap[key] = {
        name: opp.name,
        clientName: opp.clientName,
      };
    }
    if (opp.account === 'PNB') {
      groupedMap[key].pnbOpp = opp;
    } else if (opp.account === 'TNM') {
      groupedMap[key].tnmOpp = opp;
    }
  });

  const allGrouped = Object.values(groupedMap);

  // 2. Filter grouped list based on search and tab selections
  const filteredGrouped = allGrouped.filter((grouped) => {
    const matchesSearch =
      grouped.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grouped.clientName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Filter by tab toggle
    if (activeTab === 'PNB' && !grouped.pnbOpp) return false;
    if (activeTab === 'TNM' && !grouped.tnmOpp) return false;

    return true;
  });

  // Helpers to check status of a single timeline
  const isOppWon = (opp?: PreSalesOpportunity) => {
    if (!opp) return false;
    const stage = opp.stages[opp.currentStageIndex];
    const isLastStage = opp.currentStageIndex === opp.stages.length - 1;
    return stage.toLowerCase().includes('won') || isLastStage;
  };

  const isOppLost = (opp?: PreSalesOpportunity) => {
    if (!opp) return false;
    const stage = opp.stages[opp.currentStageIndex];
    return stage.toLowerCase().includes('lost');
  };

  // Calculate Metrics stats based on unique Grouped Opportunity cards
  const totalCount = allGrouped.length;
  const pnbCount = allGrouped.filter((g) => g.pnbOpp).length;
  const tnmCount = allGrouped.filter((g) => g.tnmOpp).length;

  const wonCount = allGrouped.filter((grouped) => {
    return isOppWon(grouped.pnbOpp) || isOppWon(grouped.tnmOpp);
  }).length;

  const lostCount = allGrouped.filter((grouped) => {
    return isOppLost(grouped.pnbOpp) && isOppLost(grouped.tnmOpp);
  }).length;

  const activeCount = totalCount - wonCount - lostCount;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-[#1c1926]/80 backdrop-blur-md rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-[#1c1926]/80 backdrop-blur-md rounded-2xl border border-white/5" />
          ))}
        </div>
        <div className="h-10 w-96 bg-[#1c1926]/80 backdrop-blur-md rounded-lg" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 bg-[#1c1926]/80 backdrop-blur-md rounded-2xl border border-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="page-header !mb-4">
        <div>
          <h2 className="page-title text-xl font-extrabold">PreSales Tracker</h2>
          <p className="page-subtitle text-xs">
            Track and compare pipeline progression side-by-side for major customer accounts.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors text-xs font-semibold rounded-xl transition-all duration-150 shadow-md shadow-azure-500/25 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Add Opportunity
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Opportunities */}
        <div className="bg-[#1c1926]/80 backdrop-blur-md py-3.5 px-4 rounded-xl border border-white/5 flex items-center justify-between hover-card">
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Total Leads</p>
            <p className="text-2xl font-extrabold text-foreground">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-azure-500/10 flex items-center justify-center text-azure-400">
            <Target className="w-5 h-5" />
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-[#1c1926]/80 backdrop-blur-md py-3.5 px-4 rounded-xl border border-white/5 flex items-center justify-between hover-card">
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">In Progress</p>
            <p className="text-2xl font-extrabold text-foreground">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Closed Won */}
        <div className="bg-[#1c1926]/80 backdrop-blur-md py-3.5 px-4 rounded-xl border border-white/5 flex items-center justify-between hover-card">
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Deals Secured</p>
            <p className="text-2xl font-extrabold text-foreground">{wonCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Trophy className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters & Actions Panel */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#1c1926]/80 backdrop-blur-md/50 p-2 rounded-xl border border-white/5">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50" />
          <input
            type="text"
            placeholder="Search by client or opportunity name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-900 border border-white/5 rounded-lg focus:outline-none focus:ring-1 focus:ring-azure-500/30"
          />
        </div>

        {/* Account Tabs */}
        <div className="flex gap-1 p-0.5 bg-zinc-900 border border-white/5 rounded-lg">
          {([
            ['ALL', `All (${totalCount})`],
            ['PNB', `PNB (${pnbCount})`],
            ['TNM', `TNM (${tnmCount})`],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setActiveTab(val)}
              className={cn(
                'px-3 py-1 text-[11px] font-semibold rounded-md transition-all duration-200',
                activeTab === val
                  ? 'bg-azure-500 text-white shadow-sm'
                  : 'text-white/50 hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Opportunity Cards List */}
      <div className="space-y-4">
        {opportunities.length === 0 ? (
          <div className="bg-[#1c1926]/80 backdrop-blur-md p-10 text-center border border-white/5 rounded-xl">
            <Briefcase className="w-8 h-8 text-white/50 mx-auto mb-2 opacity-60" />
            <h3 className="text-sm font-semibold">No opportunities tracked</h3>
            <p className="text-xs text-white/50 mt-0.5">
              Click "Add Opportunity" in the top-right to create your first Proposal & Bid (PNB) or Time & Material (TNM) workflow.
            </p>
          </div>
        ) : filteredGrouped.length === 0 ? (
          <div className="bg-[#1c1926]/80 backdrop-blur-md p-10 text-center border border-white/5 rounded-xl">
            <Briefcase className="w-8 h-8 text-white/50 mx-auto mb-2 opacity-60" />
            <h3 className="text-sm font-semibold">No matching opportunities</h3>
            <p className="text-xs text-white/50 mt-0.5">
              Try adjusting your filters or search term to locate the records.
            </p>
          </div>
        ) : (
          filteredGrouped.map((grouped) => {
            const oppId = grouped.pnbOpp?.id || grouped.tnmOpp?.id;
            return (
              <details
                key={`${grouped.clientName}-${grouped.name}`}
                className="group/opp-card bg-[#1c1926] border border-white/10 rounded-xl overflow-hidden hover-card flex flex-col transition-all duration-300 open:pb-2"
              >
                {/* Card Header: Opportunity Name & Client details */}
                <summary className="px-5 py-3 border-b border-white/5 bg-muted/5 flex items-center justify-between relative list-none cursor-pointer hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <ChevronRight className="w-4 h-4 text-white/50 transition-transform group-open/opp-card:rotate-90" />
                    <div className="flex flex-col gap-0.5">
                      <h3 
                        className="font-extrabold text-sm text-foreground leading-snug hover:text-azure-400 transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (oppId) navigate(`/presales/${oppId}`);
                        }}
                        title="Click to view full details"
                      >
                        {grouped.name}
                      </h3>
                      <p className="text-[10px] text-white/50 font-semibold">
                        Client Name: <span className="text-foreground/90">{grouped.clientName}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* View Docs button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuKey(null);
                        setDocsTarget(grouped);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-zinc-400 hover:text-zinc-300 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 rounded-lg transition-colors"
                      title="View uploaded documents"
                    >
                      <FileText className="w-3 h-3" />
                      Docs
                    </button>
                    {/* Upload & Analyze button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuKey(null);
                        setAnalyzerTarget(grouped);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-azure-400 hover:text-azure-300 bg-azure-500/10 hover:bg-azure-500/20 border border-azure-500/20 rounded-lg transition-colors"
                      title="Upload a document for AI track + stage analysis"
                    >
                      <FileUp className="w-3 h-3" />
                      Analyze
                    </button>
                    {isAdmin && (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const key = `${grouped.clientName}::${grouped.name}`;
                            setOpenMenuKey(openMenuKey === key ? null : key);
                          }}
                          className="text-white/50 hover:text-foreground p-1.5 rounded-lg hover:bg-zinc-800/80 transition-colors"
                          title="Actions"
                          aria-label="Actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {openMenuKey === `${grouped.clientName}::${grouped.name}` && (
                          <div
                            className="absolute right-0 mt-1 w-44 bg-zinc-900 border border-white/5 rounded-xl shadow-2xl z-40 py-1.5 overflow-hidden animate-fade-in"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setOppToEdit(grouped);
                                setOpenMenuKey(null);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs hover:bg-zinc-800 text-foreground transition-colors flex items-center gap-1.5"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit details
                            </button>

                            {grouped.pnbOpp && (
                              <button
                                onClick={() => {
                                  setOppToReset(grouped.pnbOpp!);
                                  setOpenMenuKey(null);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs hover:bg-zinc-800 text-foreground transition-colors border-t border-white/5/30 flex items-center gap-1.5"
                              >
                                <RefreshCcw className="w-3.5 h-3.5" />
                                Reset PNB
                              </button>
                            )}

                            {grouped.tnmOpp && (
                              <button
                                onClick={() => {
                                  setOppToReset(grouped.tnmOpp!);
                                  setOpenMenuKey(null);
                                }}
                                className="w-full text-left px-3.5 py-2 text-xs hover:bg-zinc-800 text-foreground transition-colors flex items-center gap-1.5"
                              >
                                <RefreshCcw className="w-3.5 h-3.5" />
                                Reset TNM
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setOppToDelete({ name: grouped.name, clientName: grouped.clientName });
                                setOpenMenuKey(null);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-zinc-800 text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5 border-t border-white/5/30"
                            >
                              <X className="w-3.5 h-3.5" />
                              Remove {grouped.name}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </summary>

                {/* Combined Sliders List */}
                <div className="divide-y divide-border">
                  {/* PNB Slider Section */}
                  {grouped.pnbOpp && (activeTab === 'ALL' || activeTab === 'PNB') && (
                    <div className="py-3.5 px-5 space-y-2 bg-zinc-900/10">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-wide uppercase bg-blue-950/60 text-blue-400 border border-blue-900/30">
                            PNB (Proposal & Bid)
                          </span>
                          <span className="text-[9px] text-white/50 font-semibold">
                            Stage {grouped.pnbOpp.currentStageIndex + 1} &middot;
                            <span className="text-azure-400 ml-0.5">{grouped.pnbOpp.progressPercent}%</span>
                          </span>
                        </div>
                        {renderStageBadge(grouped.pnbOpp)}
                      </div>

                      <StageTimeline
                        opportunityName={grouped.pnbOpp.name}
                        stages={grouped.pnbOpp.stages}
                        currentStageIndex={grouped.pnbOpp.currentStageIndex}
                        progressPercent={grouped.pnbOpp.progressPercent}
                        onStageClick={(stageName, idx) => handleStageClick(grouped.pnbOpp!, stageName, idx)}
                      />

                      {renderFooterDetails(grouped.pnbOpp)}
                    </div>
                  )}

                  {/* TNM Slider Section */}
                  {grouped.tnmOpp && (activeTab === 'ALL' || activeTab === 'TNM') && (
                    <div className="py-3.5 px-5 space-y-2 bg-zinc-900/10">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-wide uppercase bg-indigo-950/60 text-indigo-400 border border-indigo-900/30">
                            TNM (Time & Material)
                          </span>
                          <span className="text-[9px] text-white/50 font-semibold">
                            Stage {grouped.tnmOpp.currentStageIndex + 1} &middot;
                            <span className="text-azure-400 ml-0.5">{grouped.tnmOpp.progressPercent}%</span>
                          </span>
                        </div>
                        {renderStageBadge(grouped.tnmOpp)}
                      </div>

                      <StageTimeline
                        opportunityName={grouped.tnmOpp.name}
                        stages={grouped.tnmOpp.stages}
                        currentStageIndex={grouped.tnmOpp.currentStageIndex}
                        progressPercent={grouped.tnmOpp.progressPercent}
                        onStageClick={(stageName, idx) => handleStageClick(grouped.tnmOpp!, stageName, idx)}
                      />

                      {renderFooterDetails(grouped.tnmOpp)}
                    </div>
                  )}
                </div>
              </details>
            );
          })
        )}
      </div>

      {/* Add Opportunity Modal */}
      <AddOpportunityModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={() => {
          setShowAddModal(false);
          showToast('New opportunity added successfully.', 'success');
        }}
      />

      {/* Confirmation Modal (Stage Changes) */}
      <ConfirmationModal
        isOpen={pendingChange !== null}
        opportunityName={pendingChange?.opportunity.name || ''}
        stageName={pendingChange?.targetStageName || ''}
        isPending={updateStageMutation.isPending}
        onClose={() => setPendingChange(null)}
        onConfirm={handleConfirmChange}
      />

      {/* Edit Opportunity Modal */}
      <EditOpportunityModal
        isOpen={oppToEdit !== null}
        oldName={oppToEdit?.name || ''}
        oldClientName={oppToEdit?.clientName || ''}
        onClose={() => setOppToEdit(null)}
        onSaved={() => {
          setOppToEdit(null);
          showToast('Opportunity details updated successfully.', 'success');
        }}
      />

      {/* Delete Confirmation Modal */}
      {oppToDelete && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setOppToDelete(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-title"
        >
          <div
            className="bg-[#1c1926]/80 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-sm border border-white/5 overflow-hidden transform transition-all duration-300 scale-100 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 space-y-3">
              <h3 id="modal-delete-title" className="text-sm font-bold text-foreground">
                {oppToDelete.account ? `Delete ${oppToDelete.account} Timeline` : 'Delete Opportunity'}
              </h3>
              <p className="text-xs text-white/50">
                {oppToDelete.account ? (
                  <>
                    Are you sure you want to delete the <strong className="text-foreground">{oppToDelete.account}</strong> timeline for <strong className="text-foreground">"{oppToDelete.name}"</strong>?
                  </>
                ) : (
                  <>
                    Are you sure you want to delete the opportunity <strong className="text-foreground">"{oppToDelete.name}"</strong>? This will permanently remove all associated timelines.
                  </>
                )}
              </p>
            </div>
            <div className="flex gap-3 px-5 py-3 bg-muted/15 border-t border-white/5">
              <button
                onClick={() => setOppToDelete(null)}
                className="flex-1 px-3 py-2 text-xs font-semibold border border-white/5 rounded-xl hover:bg-muted/50 text-foreground transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate({ name: oppToDelete.name, clientName: oppToDelete.clientName, account: oppToDelete.account })}
                disabled={deleteMutation.isPending}
                className="flex-1 px-3 py-2 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-md shadow-red-500/10 hover:shadow-red-500/20 transition-all duration-150 flex items-center justify-center gap-1.5"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Reset Modal */}
      <ConfirmationModal
        isOpen={oppToReset !== null}
        opportunityName={`${oppToReset?.account} track`}
        stageName="Stage 1 (0%)"
        title="Confirm Progress Reset"
        message={
          <>
            Are you sure you want to reset <strong className="text-foreground font-semibold">{oppToReset?.account}</strong> progress for <strong className="text-foreground">"{oppToReset?.name}"</strong> to:
          </>
        }
        subMessage="This will reset the progress back to 0%. This action will be logged in history."
        isPending={resetMutation.isPending}
        onClose={() => setOppToReset(null)}
        onConfirm={() => oppToReset && resetMutation.mutate(oppToReset.id)}
      />

      {/* AI Document Analyzer Modal */}
      {analyzerTarget && (
        <PresalesDocAnalyzerModal
          grouped={analyzerTarget}
          onClose={() => setAnalyzerTarget(null)}
          onToast={(text, type) => showToast(text, type)}
        />
      )}

      {/* View Docs Modal */}
      {docsTarget && (
        <PresalesDocsModal
          grouped={docsTarget}
          onClose={() => setDocsTarget(null)}
          onToast={(text, type) => showToast(text, type)}
        />
      )}

      {/* Custom Toast Alert */}
      {toastMessage && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-2.5 animate-fade-in text-sm font-medium transition-all duration-300',
            toastMessage.type === 'success'
              ? 'bg-zinc-900 text-emerald-400 border-emerald-950/80 shadow-emerald-950/20'
              : 'bg-zinc-900 text-azure-400 border-azure-950/80 shadow-azure-950/20'
          )}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-azure-400 flex-shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
