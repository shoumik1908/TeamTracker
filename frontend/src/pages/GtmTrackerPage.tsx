import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { gtmApi } from '@/lib/gtmApi';
import StageTimeline from '@/components/StageTimeline';
import ConfirmationModal from '@/components/ConfirmationModal';
import AddGtmPlanModal from '@/components/AddGtmPlanModal';
import EditGtmPlanModal from '@/components/EditGtmPlanModal';
import {
  Rocket,
  Trophy,
  Activity,
  Search,
  Info,
  CheckCircle2,
  XCircle,
  Plus,
  X,
  Loader2,
  MoreVertical,
  Pencil,
  Target,
  Users,
  FolderOpen,
  Trash2,
  FileDown,
  ShieldCheck,
  Calendar,
  FileText,
  Image,
  Video,
  File,
  Clock,
  LayoutDashboard,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GtmPlan, GtmCategory, GtmPartner, GtmCampaign } from '@/types';

// Hashing avatar background colors
function getAvatarBg(name: string): string {
  const colors = [
    'bg-red-500/10 text-red-400 border-red-500/20',
    'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'bg-teal-500/10 text-teal-400 border-teal-500/20',
    'bg-azure-500/10 text-azure-400 border-azure-500/20',
    'bg-violet-500/10 text-violet-400 border-violet-500/20',
    'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
    'bg-pink-500/10 text-pink-400 border-pink-500/20',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function getFileIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes('pdf')) return FileText;
  if (t.includes('word') || t.includes('doc')) return FileText;
  if (t.includes('excel') || t.includes('sheet') || t.includes('xls')) return FileText;
  if (t.includes('image') || t.includes('png') || t.includes('jpg')) return Image;
  if (t.includes('video') || t.includes('mp4')) return Video;
  return File;
}

interface PendingChange {
  plan: GtmPlan;
  targetStageName: string;
  targetStageIndex: number;
}

interface GroupedPlan {
  name: string;
  clientName: string;
  newMarketPlan?: GtmPlan;
  expansionPlan?: GtmPlan;
}

interface DeletionTarget {
  name: string;
  clientName: string;
  category?: GtmCategory;
}

export default function GtmTrackerPage() {
  const queryClient = useQueryClient();
  const [activeGtmTab, setActiveGtmTab] = useState<'overview' | 'launches' | 'partners' | 'audit' | 'campaigns' | 'collateral'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'info' | 'success' } | null>(null);

  const showToast = (text: string, type: 'info' | 'success') => {
    setToastMessage({ text, type });
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 1: LAUNCHES STATE & QUERIES
  // ─────────────────────────────────────────────────────────────────────────────
  const [launchesTab, setLaunchesTab] = useState<'ALL' | 'NEW_MARKET_ENTRY' | 'EXISTING_CLIENT_EXPANSION'>('ALL');
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<DeletionTarget | null>(null);
  const [planToEdit, setPlanToEdit] = useState<GroupedPlan | null>(null);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  // Close dropdown menu when clicking anywhere else
  useEffect(() => {
    const handleOutsideClick = () => setOpenMenuKey(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const { data: launchesRes, isLoading: isLoadingLaunches } = useQuery({
    queryKey: ['gtm-plans'],
    queryFn: () => gtmApi.list(),
    refetchInterval: 30000,
    enabled: activeGtmTab === 'launches' || activeGtmTab === 'campaigns' || activeGtmTab === 'collateral' || activeGtmTab === 'overview'
  });
  const plans = launchesRes?.data || [];

  const updateStageMutation = useMutation({
    mutationFn: ({ id, stageIndex }: { id: string; stageIndex: number }) =>
      gtmApi.updateStage(id, stageIndex),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['gtm-plans'] });
      showToast(`Updated stage for "${res.data.name}" successfully.`, 'success');
      setPendingChange(null);
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to update stage.', 'info');
      setPendingChange(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: ({ name, clientName, category }: { name: string; clientName: string; category?: GtmCategory }) =>
      gtmApi.delete(name, clientName, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gtm-plans'] });
      showToast('GTM plan deleted successfully.', 'success');
      setPlanToDelete(null);
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to delete GTM plan.', 'info');
      setPlanToDelete(null);
    }
  });

  const handleStageClick = (plan: GtmPlan, stageName: string, stageIndex: number) => {
    if (plan.currentStageIndex === stageIndex) {
      showToast(`Plan is already in "${stageName}" stage.`, 'info');
      return;
    }
    setPendingChange({
      plan,
      targetStageName: stageName,
      targetStageIndex: stageIndex,
    });
  };

  const handleConfirmChange = () => {
    if (!pendingChange) return;
    updateStageMutation.mutate({
      id: pendingChange.plan.id,
      stageIndex: pendingChange.targetStageIndex,
    });
  };

  const renderStageBadge = (plan: GtmPlan) => {
    const stage = plan.stages[plan.currentStageIndex];
    const isLastStage = plan.currentStageIndex === plan.stages.length - 1;
    const isWon = stage.toLowerCase().includes('live') || stage.toLowerCase().includes('post') || isLastStage;
    const isLost = stage.toLowerCase().includes('cancelled');

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

  const renderFooterDetails = (plan: GtmPlan) => {
    const stage = plan.stages[plan.currentStageIndex];
    const isLastStage = plan.currentStageIndex === plan.stages.length - 1;
    const isWon = stage.toLowerCase().includes('live') || stage.toLowerCase().includes('post') || isLastStage;
    const isLost = stage.toLowerCase().includes('cancelled');
    const hasNextStage = plan.currentStageIndex < plan.stages.length - 1;

    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-muted-foreground bg-muted/5 px-5 py-1.5 rounded-b-xl border-t border-border/30">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span>
            {isWon ? (
              <span className="text-emerald-400 font-semibold">GTM successfully launched!</span>
            ) : isLost ? (
              <span className="text-red-400 font-semibold">GTM plan cancelled.</span>
            ) : hasNextStage ? (
              <>
                Next Stage: <strong className="text-foreground">{plan.stages[plan.currentStageIndex + 1]}</strong>
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

  const groupedMap: Record<string, GroupedPlan> = {};
  plans.forEach((plan) => {
    const key = `${plan.clientName.toLowerCase()}::${plan.name.toLowerCase()}`;
    if (!groupedMap[key]) {
      groupedMap[key] = { name: plan.name, clientName: plan.clientName };
    }
    if (plan.category === 'NEW_MARKET_ENTRY') {
      groupedMap[key].newMarketPlan = plan;
    } else if (plan.category === 'EXISTING_CLIENT_EXPANSION') {
      groupedMap[key].expansionPlan = plan;
    }
  });

  const allGrouped = Object.values(groupedMap);

  const filteredGrouped = allGrouped.filter((grouped) => {
    const matchesSearch =
      grouped.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      grouped.clientName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (launchesTab === 'NEW_MARKET_ENTRY' && !grouped.newMarketPlan) return false;
    if (launchesTab === 'EXISTING_CLIENT_EXPANSION' && !grouped.expansionPlan) return false;
    return true;
  });

  const isPlanLaunched = (plan?: GtmPlan) => {
    if (!plan) return false;
    const stage = plan.stages[plan.currentStageIndex];
    const isLastStage = plan.currentStageIndex === plan.stages.length - 1;
    return stage.toLowerCase().includes('live') || stage.toLowerCase().includes('post') || isLastStage;
  };

  const isPlanLost = (plan?: GtmPlan) => {
    if (!plan) return false;
    const stage = plan.stages[plan.currentStageIndex];
    return stage.toLowerCase().includes('cancelled');
  };

  const totalLaunchesCount = allGrouped.length;
  const newMarketCount = allGrouped.filter((g) => g.newMarketPlan).length;
  const expansionCount = allGrouped.filter((g) => g.expansionPlan).length;
  const launchedCount = allGrouped.filter((grouped) => {
    return isPlanLaunched(grouped.newMarketPlan) || isPlanLaunched(grouped.expansionPlan);
  }).length;
  const lostCount = allGrouped.filter((grouped) => {
    return isPlanLost(grouped.newMarketPlan) && isPlanLost(grouped.expansionPlan);
  }).length;
  const activeLaunchesCount = totalLaunchesCount - launchedCount - lostCount;

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 2: PARTNERS STATE, QUERIES & MUTATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<GtmPartner | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [partnerTier, setPartnerTier] = useState('');
  const [partnerRenewalDate, setPartnerRenewalDate] = useState('');
  const [partnerRequirements, setPartnerRequirements] = useState<Array<{ certificationName: string; minimumCount: number }>>([]);

  const { data: partnersRes, isLoading: isLoadingPartners } = useQuery({
    queryKey: ['gtm-partners'],
    queryFn: () => gtmApi.listPartners(),
    refetchInterval: 30000,
    enabled: activeGtmTab === 'partners' || activeGtmTab === 'campaigns' || activeGtmTab === 'collateral' || activeGtmTab === 'overview'
  });
  const partnersList = partnersRes?.data || [];

  const { data: certCatalogRes } = useQuery({
    queryKey: ['certifications-catalog'],
    queryFn: () => gtmApi.getCertificationsCatalog(),
    enabled: showPartnerModal
  });
  const certCatalog = certCatalogRes?.data || [];

  const createPartnerMutation = useMutation({
    mutationFn: (data: any) => gtmApi.createPartner(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gtm-partners'] });
      queryClient.invalidateQueries({ queryKey: ['gtm-audit'] });
      showToast('Partner added successfully.', 'success');
      closePartnerModal();
    },
    onError: (err: any) => showToast(err.response?.data?.error || 'Failed to save partner.', 'info')
  });

  const updatePartnerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => gtmApi.updatePartner(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gtm-partners'] });
      queryClient.invalidateQueries({ queryKey: ['gtm-audit'] });
      showToast('Partner updated successfully.', 'success');
      closePartnerModal();
    },
    onError: (err: any) => showToast(err.response?.data?.error || 'Failed to update partner.', 'info')
  });

  const deletePartnerMutation = useMutation({
    mutationFn: (id: string) => gtmApi.deletePartner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gtm-partners'] });
      queryClient.invalidateQueries({ queryKey: ['gtm-audit'] });
      showToast('Partner deleted successfully.', 'success');
    },
    onError: (err: any) => showToast(err.response?.data?.error || 'Failed to delete partner.', 'info')
  });

  const openAddPartner = () => {
    setEditingPartner(null);
    setPartnerName('');
    setPartnerTier('');
    setPartnerRenewalDate('');
    setPartnerRequirements([]);
    setShowPartnerModal(true);
  };

  const openEditPartner = (p: GtmPartner) => {
    setEditingPartner(p);
    setPartnerName(p.name);
    setPartnerTier(p.tier);
    setPartnerRenewalDate(p.renewalDate ? p.renewalDate.split('T')[0] : '');
    setPartnerRequirements(p.requirements?.map(r => ({
      certificationName: r.certificationName,
      minimumCount: r.minimumCount
    })) || []);
    setShowPartnerModal(true);
  };

  const closePartnerModal = () => {
    setShowPartnerModal(false);
    setEditingPartner(null);
  };

  const handlePartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerName.trim() || !partnerTier.trim() || !partnerRenewalDate) {
      showToast('Please fill in all required partner fields.', 'info');
      return;
    }
    const payload = {
      name: partnerName,
      tier: partnerTier,
      renewalDate: partnerRenewalDate,
      requirements: partnerRequirements
    };
    if (editingPartner) {
      updatePartnerMutation.mutate({ id: editingPartner.id, data: payload });
    } else {
      createPartnerMutation.mutate(payload);
    }
  };

  const addRequirementRow = () => {
    if (certCatalog.length === 0) return;
    setPartnerRequirements([...partnerRequirements, { certificationName: certCatalog[0].name, minimumCount: 1 }]);
  };

  const removeRequirementRow = (idx: number) => {
    setPartnerRequirements(partnerRequirements.filter((_, i) => i !== idx));
  };

  const updateRequirementRow = (idx: number, field: 'certificationName' | 'minimumCount', val: string | number) => {
    const updated = [...partnerRequirements];
    if (field === 'certificationName') {
      updated[idx].certificationName = val as string;
    } else {
      updated[idx].minimumCount = val as number;
    }
    setPartnerRequirements(updated);
  };

  const getPartnerProximityBadge = (renewalDateStr: string) => {
    const renDate = new Date(renewalDateStr);
    const diff = renDate.getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
          Expired
        </span>
      );
    }
    if (days <= 60) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Expiring soon
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        Active
      </span>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 3: AUDIT STATE & QUERIES
  // ─────────────────────────────────────────────────────────────────────────────
  const { data: auditRes, isLoading: isLoadingAudit } = useQuery({
    queryKey: ['gtm-audit'],
    queryFn: () => gtmApi.getAudit(),
    refetchInterval: 30000,
    enabled: true
  });
  const auditList = auditRes?.data || [];

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 4: CAMPAIGNS STATE, QUERIES & MUTATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<GtmCampaign | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [campaignStatus, setCampaignStatus] = useState<'Planned' | 'Active' | 'Completed'>('Planned');
  const [campaignLaunchId, setCampaignLaunchId] = useState<string>('');
  const [campaignPartnerId, setCampaignPartnerId] = useState<string>('');
  const [campaignStartDate, setCampaignStartDate] = useState('');
  const [campaignEndDate, setCampaignEndDate] = useState('');
  const [campaignDesc, setCampaignDesc] = useState('');

  const { data: campaignsRes, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ['gtm-campaigns'],
    queryFn: () => gtmApi.listCampaigns(),
    refetchInterval: 30000,
    enabled: activeGtmTab === 'campaigns' || activeGtmTab === 'overview'
  });
  const campaignsList = campaignsRes?.data || [];

  const createCampaignMutation = useMutation({
    mutationFn: (data: any) => gtmApi.createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gtm-campaigns'] });
      showToast('Campaign created successfully.', 'success');
      closeCampaignModal();
    },
    onError: (err: any) => showToast(err.response?.data?.error || 'Failed to save campaign.', 'info')
  });

  const updateCampaignMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => gtmApi.updateCampaign(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gtm-campaigns'] });
      showToast('Campaign updated successfully.', 'success');
      closeCampaignModal();
    },
    onError: (err: any) => showToast(err.response?.data?.error || 'Failed to update campaign.', 'info')
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (id: string) => gtmApi.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gtm-campaigns'] });
      showToast('Campaign deleted successfully.', 'success');
    },
    onError: (err: any) => showToast(err.response?.data?.error || 'Failed to delete campaign.', 'info')
  });

  const openAddCampaign = () => {
    setEditingCampaign(null);
    setCampaignName('');
    setCampaignStatus('Planned');
    setCampaignLaunchId('');
    setCampaignPartnerId('');
    setCampaignStartDate('');
    setCampaignEndDate('');
    setCampaignDesc('');
    setShowCampaignModal(true);
  };

  const openEditCampaign = (c: GtmCampaign) => {
    setEditingCampaign(c);
    setCampaignName(c.name);
    setCampaignStatus(c.status);
    setCampaignLaunchId(c.launchId || '');
    setCampaignPartnerId(c.partnerId || '');
    setCampaignStartDate(c.startDate ? c.startDate.split('T')[0] : '');
    setCampaignEndDate(c.endDate ? c.endDate.split('T')[0] : '');
    setCampaignDesc(c.description || '');
    setShowCampaignModal(true);
  };

  const closeCampaignModal = () => {
    setShowCampaignModal(false);
    setEditingCampaign(null);
  };

  const handleCampaignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim() || !campaignStatus) {
      showToast('Name and Status are required.', 'info');
      return;
    }
    const payload = {
      name: campaignName,
      status: campaignStatus,
      launchId: campaignLaunchId || null,
      partnerId: campaignPartnerId || null,
      startDate: campaignStartDate || null,
      endDate: campaignEndDate || null,
      description: campaignDesc || null
    };

    if (editingCampaign) {
      updateCampaignMutation.mutate({ id: editingCampaign.id, data: payload });
    } else {
      createCampaignMutation.mutate(payload);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB 5: COLLATERAL STATE, QUERIES & MUTATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  const [showCollateralModal, setShowCollateralModal] = useState(false);
  const [collateralFile, setCollateralFile] = useState<File | null>(null);
  const [collateralPartnerId, setCollateralPartnerId] = useState('');
  const [collateralLaunchId, setCollateralLaunchId] = useState('');
  const [collateralUploader, setCollateralUploader] = useState('Admin');
  const [uploadProgress, setUploadProgress] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [filterPartnerId, setFilterPartnerId] = useState('ALL');
  const [filterLaunchId, setFilterLaunchId] = useState('ALL');

  const { data: collateralRes, isLoading: isLoadingCollateral } = useQuery({
    queryKey: ['gtm-collaterals'],
    queryFn: () => gtmApi.listCollaterals(),
    refetchInterval: 30000,
    enabled: activeGtmTab === 'collateral'
  });
  const collateralList = collateralRes?.data || [];

  const uploadCollateralMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadProgress(true);
      setUploadError(null);

      // 1. Get SAS
      const { uploadUrl, blobName, contentType } = await gtmApi.getCollateralUploadUrl({
        fileName: file.name,
        fileType: file.type
      });

      // 2. Direct upload to Azure
      await axios.put(uploadUrl, file, {
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "Content-Type": contentType,
        },
      });

      // 3. Register metadata
      const { data: savedFile } = await gtmApi.createCollateral({
        blobName,
        fileName: file.name,
        fileType: file.type,
        size: file.size,
        uploadedBy: collateralUploader || 'Admin',
        launchId: collateralLaunchId || null,
        partnerId: collateralPartnerId || null
      });

      return savedFile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gtm-collaterals'] });
      setShowCollateralModal(false);
      setCollateralFile(null);
      setCollateralPartnerId('');
      setCollateralLaunchId('');
      setUploadProgress(false);
      showToast('Collateral document uploaded successfully.', 'success');
    },
    onError: (err: any) => {
      setUploadProgress(false);
      setUploadError(err.response?.data?.error || err.message || 'Failed to upload collateral.');
    }
  });

  const deleteCollateralMutation = useMutation({
    mutationFn: (id: string) => gtmApi.deleteCollateral(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gtm-collaterals'] });
      showToast('Collateral file deleted successfully.', 'success');
    },
    onError: (err: any) => showToast(err.response?.data?.error || 'Failed to delete collateral.', 'info')
  });

  const handleCollateralDownload = async (id: string) => {
    try {
      const { downloadUrl } = await gtmApi.getCollateralDownloadUrl(id);
      window.open(downloadUrl, "_blank");
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to generate download url.', 'info');
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collateralFile) {
      setUploadError('Please select a file.');
      return;
    }
    uploadCollateralMutation.mutate(collateralFile);
  };

  const filteredCollateral = collateralList.filter(file => {
    if (filterPartnerId !== 'ALL' && file.partnerId !== filterPartnerId) return false;
    if (filterLaunchId !== 'ALL' && file.launchId !== filterLaunchId) return false;
    if (searchTerm.trim()) {
      return file.name.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  // Count active compliance issues (At Risk + Not Met)
  const activeIssuesCount = auditList.filter(item => item.status === 'At Risk' || item.status === 'Not Met').length;

  // Render general loading state for tabs
  const isLoading = 
    (activeGtmTab === 'overview' && (isLoadingLaunches || isLoadingPartners || isLoadingAudit || isLoadingCampaigns)) ||
    (activeGtmTab === 'launches' && isLoadingLaunches) ||
    (activeGtmTab === 'partners' && isLoadingPartners) ||
    (activeGtmTab === 'audit' && isLoadingAudit) ||
    (activeGtmTab === 'campaigns' && isLoadingCampaigns) ||
    (activeGtmTab === 'collateral' && isLoadingCollateral);

  return (
    <div className="space-y-6">
      {/* Page Toast */}
      {toastMessage && (
        <div className={cn(
          "fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-2.5 border text-xs font-semibold animate-slide-in",
          toastMessage.type === 'success' ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/40" : "bg-zinc-900 border-border text-foreground"
        )}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Info className="w-4 h-4 text-azure-400" />}
          {toastMessage.text}
        </div>
      )}

      {/* Page Header */}
      <div className="page-header !mb-4">
        <div>
          <h2 className="page-title text-xl font-extrabold flex items-center gap-2">
            <Rocket className="w-5 h-5 text-[#378add]" />
            GTM Portal
          </h2>
          <p className="page-subtitle text-xs">
            Manage go-to-market strategies, partner audits, campaigns, and files.
          </p>
        </div>

        {activeGtmTab === 'launches' && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-azure-500 hover:bg-azure-600 text-white text-xs font-bold rounded-xl transition-all duration-150 shadow-md shadow-azure-500/25 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Add GTM Plan
          </button>
        )}

        {activeGtmTab === 'partners' && (
          <button
            onClick={openAddPartner}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#378add] hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-all duration-150 shadow-md shadow-blue-500/25 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Add Partner
          </button>
        )}

        {activeGtmTab === 'campaigns' && (
          <button
            onClick={openAddCampaign}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-azure-500 hover:bg-azure-600 text-white text-xs font-bold rounded-xl transition-all duration-150 shadow-md shadow-azure-500/25 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Add Campaign
          </button>
        )}

        {activeGtmTab === 'collateral' && (
          <button
            onClick={() => {
              setUploadError(null);
              setCollateralFile(null);
              setShowCollateralModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#378add] hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-all duration-150 shadow-md shadow-blue-500/25 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" /> Upload File
          </button>
        )}
      </div>

      {/* Horizontal Tabs bar */}
      <div className="border-b border-border/50">
        <div className="flex gap-6">
          {([
            { id: 'overview', label: 'Overview', icon: LayoutDashboard, badge: 0 },
            { id: 'launches', label: 'Launches', icon: Rocket, badge: 0 },
            { id: 'partners', label: 'Partners', icon: Users, badge: 0 },
            { id: 'audit', label: 'Audit', icon: ShieldCheck, badge: activeIssuesCount },
            { id: 'campaigns', label: 'Campaigns', icon: Target, badge: 0 },
            { id: 'collateral', label: 'Collateral', icon: FolderOpen, badge: 0 }
          ] as const).map(tab => {
            const Icon = tab.icon;
            const isActive = activeGtmTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveGtmTab(tab.id);
                  setSearchTerm(''); // reset search
                }}
                className={cn(
                  "flex items-center gap-2 pb-3.5 text-xs font-bold transition-all relative border-b-2 -mb-[2px]",
                  isActive 
                    ? "text-[#378add] border-[#378add]" 
                    : "text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-red-600 text-white leading-none shrink-0">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-card rounded-2xl border border-border" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-card rounded-2xl border border-border" />
            <div className="h-64 bg-card rounded-2xl border border-border" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* TAB 0: OVERVIEW */}
          {activeGtmTab === 'overview' && (
            <div className="space-y-6">
              {/* Four summary metric cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#1a1a18] py-4 px-5 rounded-[8px] flex items-center justify-between hover-card">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Active Launches</p>
                    <p className="text-2xl font-extrabold text-foreground">{activeLaunchesCount}</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-azure-500/10 flex items-center justify-center text-azure-400">
                    <Rocket className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-[#1a1a18] py-4 px-5 rounded-[8px] flex items-center justify-between hover-card">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Partners</p>
                    <p className="text-2xl font-extrabold text-foreground">{partnersList.length}</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-[#1a1a18] py-4 px-5 rounded-[8px] flex items-center justify-between hover-card">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Audit Issues</p>
                    <p className="text-2xl font-extrabold text-amber-400">{activeIssuesCount}</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-[#1a1a18] py-4 px-5 rounded-[8px] flex items-center justify-between hover-card">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Open Campaigns</p>
                    <p className="text-2xl font-extrabold text-foreground">
                      {campaignsList.filter(c => c.status !== 'Completed').length}
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Target className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Two-column layout below */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Launches in progress */}
                <div className="bg-[#1a1a18] p-5 rounded-[8px] space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Launches in progress</h3>
                    <span className="text-[10px] font-semibold text-muted-foreground">Top 3 by recency</span>
                  </div>

                  <div className="space-y-4">
                    {plans
                      .filter(p => {
                        const stage = p.stages[p.currentStageIndex];
                        const isLastStage = p.currentStageIndex === p.stages.length - 1;
                        const isWon = stage.toLowerCase().includes('live') || stage.toLowerCase().includes('post') || isLastStage;
                        const isLost = stage.toLowerCase().includes('cancelled');
                        return !isWon && !isLost;
                      })
                      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                      .slice(0, 3)
                      .map(plan => {
                        const pct = Math.round((plan.currentStageIndex / (plan.stages.length - 1)) * 100) || 0;
                        const isGreen = pct >= 70;
                        return (
                          <div key={plan.id} className="bg-zinc-900/30 p-3 rounded-lg border border-border/30 space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-xs font-bold text-foreground leading-snug">{plan.name}</h4>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{plan.clientName} • {plan.category === 'NEW_MARKET_ENTRY' ? 'New Market' : 'Expansion'}</p>
                              </div>
                              <span className="text-[10px] font-bold text-foreground">{pct}%</span>
                            </div>
                            <div>
                              <p className="text-[9px] font-semibold text-muted-foreground">Current Stage: <span className="text-foreground/95">{plan.stages[plan.currentStageIndex]}</span></p>
                              <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div
                                  className={cn("h-full transition-all duration-300", isGreen ? "bg-emerald-500" : "bg-azure-500")}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    {plans.filter(p => {
                      const stage = p.stages[p.currentStageIndex];
                      const isLastStage = p.currentStageIndex === p.stages.length - 1;
                      const isWon = stage.toLowerCase().includes('live') || stage.toLowerCase().includes('post') || isLastStage;
                      const isLost = stage.toLowerCase().includes('cancelled');
                      return !isWon && !isLost;
                    }).length === 0 && (
                      <p className="text-[11px] text-muted-foreground italic text-center py-6">No active launches in progress.</p>
                    )}
                  </div>
                </div>

                {/* Right: Needs attention */}
                <div className="bg-[#1a1a18] p-5 rounded-[8px] space-y-4">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Needs attention</h3>

                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                    {(() => {
                      interface FeedItem {
                        id: string;
                        type: 'audit' | 'renewal';
                        urgency: number; // 0 for Not Met, 1 for At Risk, 2 for renewal
                        title: string;
                        details: string;
                        statusBadge: React.ReactNode;
                        icon: React.ReactNode;
                        dateSort?: number;
                      }

                      const feed: FeedItem[] = [];

                      // 1. Audit issues
                      auditList.forEach(audit => {
                        if (audit.status === 'Not Met' || audit.status === 'At Risk') {
                          const isNotMet = audit.status === 'Not Met';
                          feed.push({
                            id: `audit-${audit.id}`,
                            type: 'audit',
                            urgency: isNotMet ? 0 : 1,
                            title: `${audit.partnerName}: Certification Issue`,
                            details: `${audit.certificationName} — requires ${audit.minimumCount}, currently have ${audit.currentCount}`,
                            icon: (
                              <AlertTriangle className={cn("w-4 h-4 shrink-0 mt-0.5", isNotMet ? "text-red-400" : "text-amber-400")} />
                            ),
                            statusBadge: (
                              <span className={cn(
                                "px-1.5 py-0.25 rounded text-[8px] font-bold shrink-0",
                                isNotMet ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              )}>
                                {audit.status}
                              </span>
                            )
                          });
                        }
                      });

                      // 2. Partner renewals <= 60 days
                      partnersList.forEach(partner => {
                        const renDate = new Date(partner.renewalDate);
                        const diff = renDate.getTime() - new Date().getTime();
                        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                        if (days <= 60) {
                          feed.push({
                            id: `renewal-${partner.id}`,
                            type: 'renewal',
                            urgency: 2,
                            title: `${partner.name}: Renewal Approaching`,
                            details: `Renewal date: ${formatDate(partner.renewalDate)} (${days < 0 ? 'Expired' : `${days} days left`})`,
                            icon: <Clock className="w-4 h-4 shrink-0 text-muted-foreground mt-0.5" />,
                            dateSort: renDate.getTime(),
                            statusBadge: (
                              <span className={cn(
                                "px-1.5 py-0.25 rounded text-[8px] font-bold shrink-0",
                                days < 0 ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              )}>
                                Renewal
                              </span>
                            )
                          });
                        }
                      });

                      // Sort by urgency: Not Met (0) > At Risk (1) > Renewal (2, sorted by dateSort ASC)
                      feed.sort((a, b) => {
                        if (a.urgency !== b.urgency) {
                          return a.urgency - b.urgency;
                        }
                        if (a.urgency === 2 && a.dateSort && b.dateSort) {
                          return a.dateSort - b.dateSort;
                        }
                        return 0;
                      });

                      if (feed.length === 0) {
                        return (
                          <p className="text-[11px] text-muted-foreground italic text-center py-6">All systems nominal. No issues require attention.</p>
                        );
                      }

                      return feed.map(item => (
                        <div key={item.id} className="flex gap-3 bg-zinc-900/30 p-3 rounded-lg border border-border/30 hover:bg-zinc-900/50 transition-colors">
                          {item.icon}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-xs font-bold text-foreground truncate">{item.title}</h4>
                              {item.statusBadge}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{item.details}</p>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: LAUNCHES */}
          {activeGtmTab === 'launches' && (
            <div className="space-y-5">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#1a1a18] py-4 px-5 rounded-[8px] flex items-center justify-between hover-card">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total GTM Launches</p>
                    <p className="text-2xl font-extrabold text-foreground">{totalLaunchesCount}</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-azure-500/10 flex items-center justify-center text-azure-400">
                    <Rocket className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-[#1a1a18] py-4 px-5 rounded-[8px] flex items-center justify-between hover-card">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">In Progress</p>
                    <p className="text-2xl font-extrabold text-foreground">{activeLaunchesCount}</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>

                <div className="bg-[#1a1a18] py-4 px-5 rounded-[8px] flex items-center justify-between hover-card">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Launched</p>
                    <p className="text-2xl font-extrabold text-foreground">{launchedCount}</p>
                  </div>
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Trophy className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Filters & Actions Panel */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card p-3 rounded-xl border border-border">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by client or plan name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-900 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-azure-500/30 text-foreground"
                  />
                </div>

                <div className="flex gap-1 p-0.5 bg-zinc-900 border border-border rounded-lg">
                  {([
                    ['ALL', `All (${totalLaunchesCount})`],
                    ['NEW_MARKET_ENTRY', `New Market (${newMarketCount})`],
                    ['EXISTING_CLIENT_EXPANSION', `Expansion (${expansionCount})`],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setLaunchesTab(val)}
                      className={cn(
                        'px-3 py-1.5 text-[10px] font-bold rounded-md transition-all duration-200',
                        launchesTab === val
                          ? 'bg-[#378add] text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan Cards List */}
              <div className="space-y-4">
                {plans.length === 0 ? (
                  <div className="bg-card p-12 text-center border border-dashed border-border rounded-xl">
                    <Target className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-foreground">No GTM plans tracked</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Click "Add GTM Plan" in the top-right to track your first launch.
                    </p>
                  </div>
                ) : filteredGrouped.length === 0 ? (
                  <div className="bg-card p-12 text-center border border-border rounded-xl">
                    <Target className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-foreground">No matching plans</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try adjusting your filters or search term to locate the records.
                    </p>
                  </div>
                ) : (
                  filteredGrouped.map((grouped) => (
                    <div
                      key={`${grouped.clientName}-${grouped.name}`}
                      className="bg-card border border-border rounded-2xl overflow-hidden hover-card flex flex-col transition-all duration-300"
                    >
                      <div className="px-5 py-3.5 border-b border-border/50 bg-zinc-900/10 flex items-center justify-between relative">
                        <div className="flex flex-col gap-0.5">
                          <h3 className="font-extrabold text-sm text-foreground leading-snug">
                            {grouped.name}
                          </h3>
                          <p className="text-[10px] text-muted-foreground font-semibold">
                            Client Name: <span className="text-foreground/90">{grouped.clientName}</span>
                          </p>
                        </div>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const key = `${grouped.clientName}::${grouped.name}`;
                              setOpenMenuKey(openMenuKey === key ? null : key);
                            }}
                            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-zinc-800/80 transition-colors"
                            title="Actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuKey === `${grouped.clientName}::${grouped.name}` && (
                            <div
                              className="absolute right-0 mt-1 w-52 bg-zinc-900 border border-border rounded-xl shadow-2xl z-40 py-1.5 overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setPlanToEdit(grouped);
                                  setOpenMenuKey(null);
                                }}
                                className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-zinc-800 text-foreground transition-colors flex items-center gap-1.5"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit details
                              </button>

                              <button
                                onClick={() => {
                                  setPlanToDelete({ name: grouped.name, clientName: grouped.clientName });
                                  setOpenMenuKey(null);
                                }}
                                className="w-full text-left px-3.5 py-2.5 text-xs font-semibold hover:bg-zinc-800 text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5 border-t border-border/30"
                              >
                                <X className="w-3.5 h-3.5" />
                                Remove {grouped.name}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="divide-y divide-border/50">
                        {grouped.newMarketPlan && (launchesTab === 'ALL' || launchesTab === 'NEW_MARKET_ENTRY') && (
                          <div className="py-4 px-5 space-y-3 bg-zinc-900/10">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <span className="px-2 py-0.5 rounded text-[8px] font-extrabold tracking-wide uppercase bg-violet-500/15 text-violet-400 border border-violet-500/20">
                                NEW MARKET ENTRY
                              </span>
                              {renderStageBadge(grouped.newMarketPlan)}
                            </div>

                            <StageTimeline
                              opportunityName={grouped.newMarketPlan.name}
                              stages={grouped.newMarketPlan.stages}
                              currentStageIndex={grouped.newMarketPlan.currentStageIndex}
                              onStageClick={(stageName, idx) => handleStageClick(grouped.newMarketPlan!, stageName, idx)}
                            />

                            {renderFooterDetails(grouped.newMarketPlan)}
                          </div>
                        )}

                        {grouped.expansionPlan && (launchesTab === 'ALL' || launchesTab === 'EXISTING_CLIENT_EXPANSION') && (
                          <div className="py-4 px-5 space-y-3 bg-zinc-900/10">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <span className="px-2 py-0.5 rounded text-[8px] font-extrabold tracking-wide uppercase bg-[#378add]/15 text-[#378add] border border-[#378add]/20">
                                EXISTING CLIENT EXPANSION
                              </span>
                              {renderStageBadge(grouped.expansionPlan)}
                            </div>

                            <StageTimeline
                              opportunityName={grouped.expansionPlan.name}
                              stages={grouped.expansionPlan.stages}
                              currentStageIndex={grouped.expansionPlan.currentStageIndex}
                              onStageClick={(stageName, idx) => handleStageClick(grouped.expansionPlan!, stageName, idx)}
                            />

                            {renderFooterDetails(grouped.expansionPlan)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PARTNERS */}
          {activeGtmTab === 'partners' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search partners by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-900 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-azure-500/30 text-foreground"
                  />
                </div>
              </div>

              {partnersList.length === 0 ? (
                <div className="bg-card p-12 text-center border border-dashed border-border rounded-xl">
                  <Users className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-foreground">No GTM partners added</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click "Add Partner" in the top-right to register a partner.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {partnersList
                    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(partner => (
                      <div key={partner.id} className="bg-[#1a1a18] p-5 rounded-[8px] flex flex-col justify-between relative hover-card">
                        <div className="flex items-start gap-4">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border shrink-0", getAvatarBg(partner.name))}>
                            {getInitials(partner.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-extrabold text-sm text-foreground truncate">{partner.name}</h4>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className="px-2 py-0.5 rounded text-[8px] font-extrabold bg-violet-500/10 text-violet-400 border border-violet-500/20 uppercase tracking-wide">
                                {partner.tier}
                              </span>
                              {getPartnerProximityBadge(partner.renewalDate)}
                            </div>
                            
                            <p className="text-[10px] text-muted-foreground font-semibold mt-3 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-muted-foreground/85" />
                              Renewal Date: <span className="text-foreground/90 font-bold">{formatDate(partner.renewalDate)}</span>
                            </p>

                            {partner.requirements && partner.requirements.length > 0 && (
                              <div className="mt-4 pt-3.5 border-t border-border/40 space-y-1.5">
                                <h5 className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Required Certifications:</h5>
                                <div className="space-y-1">
                                  {partner.requirements.map(req => (
                                    <p key={req.id} className="text-[10px] text-foreground/80 flex justify-between items-center bg-zinc-900/30 px-2 py-1 rounded">
                                      <span className="truncate max-w-[200px]">{req.certificationName}</span>
                                      <span className="font-bold text-muted-foreground/80 shrink-0">Min Count: {req.minimumCount}</span>
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="absolute top-4 right-4 flex items-center gap-1">
                          <button
                            onClick={() => openEditPartner(partner)}
                            className="p-1.5 hover:bg-zinc-800/80 rounded-md text-muted-foreground hover:text-foreground transition-all"
                            title="Edit Partner"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete partner "${partner.name}"?`)) {
                                deletePartnerMutation.mutate(partner.id);
                              }
                            }}
                            className="p-1.5 hover:bg-red-950/20 rounded-md text-muted-foreground hover:text-red-400 transition-all"
                            title="Delete Partner"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AUDIT */}
          {activeGtmTab === 'audit' && (
            <div className="space-y-5">
              {auditList.length === 0 ? (
                <div className="bg-card p-12 text-center border border-dashed border-border rounded-xl">
                  <ShieldCheck className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-foreground">No audit data available</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Requirements defined under Partners will dynamically compute compliance here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditList.map(audit => (
                    <div key={audit.id} className="bg-[#1a1a18] p-4 rounded-[8px] flex items-center justify-between border-l-4 border-l-muted-foreground/20 hover-card">
                      <div className="space-y-1.5">
                        <h4 className="text-[10px] font-extrabold text-[#378add] uppercase tracking-wider">{audit.partnerName} Requirement</h4>
                        <p className="text-xs font-semibold text-foreground/90">{audit.certificationName}</p>
                        
                        <p className="text-[10px] text-muted-foreground">
                          Requires <span className="font-bold text-foreground">{audit.minimumCount}</span> completed certs • Currently have:{' '}
                          <span className={cn(
                            "font-extrabold",
                            audit.status === 'Met' ? "text-emerald-400" :
                            audit.status === 'At Risk' ? "text-amber-400" : "text-red-400"
                          )}>
                            {audit.currentCount}
                          </span>
                        </p>
                      </div>

                      <div>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-extrabold",
                          audit.status === 'Met' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          audit.status === 'At Risk' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                          "bg-red-500/10 text-red-400 border border-red-500/20"
                        )}>
                          {audit.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CAMPAIGNS */}
          {activeGtmTab === 'campaigns' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search campaigns by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-900 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-azure-500/30 text-foreground"
                  />
                </div>
              </div>

              {campaignsList.length === 0 ? (
                <div className="bg-card p-12 text-center border border-dashed border-border rounded-xl">
                  <Target className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-foreground">No marketing campaigns registered</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click "Add Campaign" in the top-right to register your first campaign.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {campaignsList
                    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(campaign => (
                      <div key={campaign.id} className="bg-[#1a1a18] p-5 rounded-[8px] flex flex-col justify-between relative hover-card">
                        <div>
                          <div className="flex items-center justify-between pr-14">
                            <h4 className="font-extrabold text-sm text-foreground truncate">{campaign.name}</h4>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ml-2 border",
                              campaign.status === 'Active' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                              campaign.status === 'Planned' ? "bg-azure-500/10 text-azure-400 border-azure-500/20" :
                              "bg-zinc-800 text-muted-foreground border-border/50"
                            )}>
                              {campaign.status}
                            </span>
                          </div>

                          {(campaign.launch || campaign.partner) && (
                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                              {campaign.launch && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] bg-violet-500/10 text-violet-400 border border-violet-500/20 font-bold uppercase tracking-wider">
                                  Linked: Launch ({campaign.launch.name})
                                </span>
                              )}
                              {campaign.partner && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] bg-[#378add]/10 text-[#378add] border border-[#378add]/20 font-bold uppercase tracking-wider">
                                  Linked: Partner ({campaign.partner.name})
                                </span>
                              )}
                            </div>
                          )}

                          {campaign.description && (
                            <p className="text-xs text-muted-foreground mt-3.5 leading-relaxed bg-zinc-950/30 p-3 rounded-lg border border-border/30">
                              {campaign.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 pt-3.5 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                          <p className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground/80" />
                            {campaign.startDate || campaign.endDate ? (
                              <span>{formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}</span>
                            ) : (
                              <span>No date range set</span>
                            )}
                          </p>
                        </div>

                        <div className="absolute top-4 right-4 flex items-center gap-1">
                          <button
                            onClick={() => openEditCampaign(campaign)}
                            className="p-1.5 hover:bg-zinc-800/80 rounded-md text-muted-foreground hover:text-foreground transition-all"
                            title="Edit Campaign"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete campaign "${campaign.name}"?`)) {
                                deleteCampaignMutation.mutate(campaign.id);
                              }
                            }}
                            className="p-1.5 hover:bg-red-950/20 rounded-md text-muted-foreground hover:text-red-400 transition-all"
                            title="Delete Campaign"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: COLLATERAL */}
          {activeGtmTab === 'collateral' && (
            <div className="space-y-5">
              {/* Filtering Controls */}
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-card p-3 rounded-xl border border-border">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search files by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-900 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-azure-500/30 text-foreground"
                  />
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <select
                    value={filterPartnerId}
                    onChange={e => setFilterPartnerId(e.target.value)}
                    className="bg-zinc-900 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none"
                  >
                    <option value="ALL">All Partners</option>
                    {partnersList.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  <select
                    value={filterLaunchId}
                    onChange={e => setFilterLaunchId(e.target.value)}
                    className="bg-zinc-900 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none"
                  >
                    <option value="ALL">All Launches</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.clientName})</option>
                    ))}
                  </select>
                </div>
              </div>

              {collateralList.length === 0 ? (
                <div className="bg-card p-12 text-center border border-dashed border-border rounded-xl">
                  <FolderOpen className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-foreground">No collateral uploaded yet</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload sales collateral, decks, and case studies to ADLS Gen2 storage.
                  </p>
                </div>
              ) : filteredCollateral.length === 0 ? (
                <div className="bg-card p-12 text-center border border-border rounded-xl">
                  <FolderOpen className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-foreground">No matching documents</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try adjusting your filters or search terms.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredCollateral.map(file => {
                    const FileIcon = getFileIcon(file.type);
                    return (
                      <div key={file.id} className="bg-[#1a1a18] p-4 rounded-[8px] flex flex-col justify-between border border-border/20 hover-card relative">
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-azure-500/10 text-azure-400 flex items-center justify-center shrink-0">
                              <FileIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1 pr-6">
                              <h4 className="text-xs font-bold text-foreground truncate" title={file.name}>
                                {file.name}
                              </h4>
                              <p className="text-[9px] text-muted-foreground mt-0.5">
                                Uploaded: {formatDate(file.uploadedAt)}
                              </p>
                            </div>
                          </div>

                          {(file.launch || file.partner) && (
                            <div className="flex flex-wrap gap-1 mt-3">
                              {file.launch && (
                                <span className="px-1.5 py-0.25 rounded text-[8px] bg-violet-500/10 text-violet-400 font-bold border border-violet-500/20 truncate max-w-[150px]">
                                  Launch: {file.launch.name}
                                </span>
                              )}
                              {file.partner && (
                                <span className="px-1.5 py-0.25 rounded text-[8px] bg-[#378add]/10 text-[#378add] font-bold border border-[#378add]/20 truncate max-w-[150px]">
                                  Partner: {file.partner.name}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between border-t border-border/30 mt-4 pt-3 text-[9px] text-muted-foreground">
                          <span>By: {file.uploadedBy}</span>
                          <span className="font-semibold">{Math.round(file.size / 1024)} KB</span>
                        </div>

                        {/* File Action Controls */}
                        <div className="absolute top-4 right-4 flex items-center gap-1">
                          <button
                            onClick={() => handleCollateralDownload(file.id)}
                            className="p-1 hover:bg-zinc-800/80 rounded text-muted-foreground hover:text-foreground transition-all"
                            title="Download File"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete file "${file.name}"?`)) {
                                deleteCollateralMutation.mutate(file.id);
                              }
                            }}
                            className="p-1 hover:bg-red-950/20 rounded text-muted-foreground hover:text-red-400 transition-all"
                            title="Delete File"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODALS & FORM DIALOGS
          ───────────────────────────────────────────────────────────────────────────── */}

      {/* 1. Add GTM Plan Modal */}
      <AddGtmPlanModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={() => {
          setShowAddModal(false);
          showToast('New GTM plan added successfully.', 'success');
        }}
      />

      {/* 2. Edit GTM Details Modal */}
      {planToEdit && (
        <EditGtmPlanModal
          isOpen={planToEdit !== null}
          onClose={() => setPlanToEdit(null)}
          oldName={planToEdit.name}
          oldClientName={planToEdit.clientName}
          onSaved={() => {
            setPlanToEdit(null);
            showToast('GTM plan details updated successfully.', 'success');
          }}
        />
      )}

      {/* 3. Delete Confirmation Modal */}
      {planToDelete && (
        <ConfirmationModal
          isOpen={planToDelete !== null}
          opportunityName={planToDelete?.name || ''}
          stageName="delete"
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(planToDelete)}
          onClose={() => setPlanToDelete(null)}
          title="Confirm Deletion"
          message={`Are you sure you want to remove the GTM plan for client "${planToDelete?.clientName}"? This will delete all timeline stages associated with this plan.`}
        />
      )}

      {/* 4. Stage Transition Confirmation Modal */}
      <ConfirmationModal
        isOpen={pendingChange !== null}
        opportunityName={pendingChange?.plan.name || ''}
        stageName={pendingChange?.targetStageName || ''}
        isPending={updateStageMutation.isPending}
        onConfirm={handleConfirmChange}
        onClose={() => setPendingChange(null)}
      />

      {/* 5. Add/Edit Partner Modal */}
      {showPartnerModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-border rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-border/50 flex justify-between items-center bg-zinc-900/20">
              <h3 className="text-sm font-bold text-foreground">
                {editingPartner ? `Edit GTM Partner: ${editingPartner.name}` : 'Add New GTM Partner'}
              </h3>
              <button onClick={closePartnerModal} className="p-1 hover:bg-zinc-800 rounded-lg text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePartnerSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Partner Name *</label>
                <input
                  type="text"
                  required
                  value={partnerName}
                  onChange={e => setPartnerName(e.target.value)}
                  placeholder="e.g. Microsoft Integration Services"
                  className="w-full bg-zinc-900 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-azure-500/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Partnership Tier *</label>
                <input
                  type="text"
                  required
                  value={partnerTier}
                  onChange={e => setPartnerTier(e.target.value)}
                  placeholder="e.g. Gold Partner"
                  className="w-full bg-zinc-900 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-azure-500/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Renewal Date *</label>
                <input
                  type="date"
                  required
                  value={partnerRenewalDate}
                  onChange={e => setPartnerRenewalDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-azure-500/30"
                />
              </div>

              {/* Requirements Dynamic List */}
              <div className="pt-3 border-t border-border/40">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Partner Requirements</h4>
                  <button
                    type="button"
                    onClick={addRequirementRow}
                    className="text-[10px] font-bold text-[#378add] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>

                {partnerRequirements.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic bg-zinc-900/30 p-3 rounded-xl border border-border/30">
                    No requirement constraints configured. Click 'Add Row' to configure certifications.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {partnerRequirements.map((req, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-zinc-900/50 p-2.5 rounded-xl border border-border/40">
                        <div className="flex-1">
                          <label className="block text-[8px] font-bold text-muted-foreground uppercase mb-1">Certification</label>
                          <select
                            value={req.certificationName}
                            onChange={e => updateRequirementRow(idx, 'certificationName', e.target.value)}
                            className="w-full bg-zinc-950 border border-border rounded-lg px-2.5 py-1 text-[11px] text-foreground focus:outline-none"
                          >
                            {certCatalog.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <label className="block text-[8px] font-bold text-muted-foreground uppercase mb-1">Min Count</label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={req.minimumCount}
                            onChange={e => updateRequirementRow(idx, 'minimumCount', parseInt(e.target.value) || 1)}
                            className="w-full bg-zinc-950 border border-border rounded-lg px-2.5 py-1 text-[11px] text-foreground focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRequirementRow(idx)}
                          className="mt-4 p-1.5 hover:bg-zinc-800 rounded text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={closePartnerModal}
                  className="px-3.5 py-1.5 border border-border rounded-xl text-xs font-bold hover:bg-zinc-800 text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPartnerMutation.isPending || updatePartnerMutation.isPending}
                  className="px-4.5 py-1.5 bg-[#378add] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  {(createPartnerMutation.isPending || updatePartnerMutation.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Add/Edit Campaign Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-border rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-border/50 flex justify-between items-center bg-zinc-900/20">
              <h3 className="text-sm font-bold text-foreground">
                {editingCampaign ? `Edit Campaign: ${editingCampaign.name}` : 'Add New Campaign'}
              </h3>
              <button onClick={closeCampaignModal} className="p-1 hover:bg-zinc-800 rounded-lg text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCampaignSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Campaign Name *</label>
                <input
                  type="text"
                  required
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="e.g. Q3 Cloud Migration Push"
                  className="w-full bg-zinc-900 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-azure-500/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Status *</label>
                <select
                  value={campaignStatus}
                  onChange={e => setCampaignStatus(e.target.value as any)}
                  className="w-full bg-zinc-900 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                >
                  <option value="Planned">Planned</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Link to Launch (Optional)</label>
                  <select
                    value={campaignLaunchId}
                    onChange={e => setCampaignLaunchId(e.target.value)}
                    className="w-full bg-zinc-900 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                  >
                    <option value="">None</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.clientName})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Link to Partner (Optional)</label>
                  <select
                    value={campaignPartnerId}
                    onChange={e => setCampaignPartnerId(e.target.value)}
                    className="w-full bg-zinc-900 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                  >
                    <option value="">None</option>
                    {partnersList.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={campaignStartDate}
                    onChange={e => setCampaignStartDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={campaignEndDate}
                    onChange={e => setCampaignEndDate(e.target.value)}
                    className="w-full bg-zinc-900 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Description</label>
                <textarea
                  rows={4}
                  value={campaignDesc}
                  onChange={e => setCampaignDesc(e.target.value)}
                  placeholder="Add campaign deliverables, targets or notes..."
                  className="w-full bg-zinc-900 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={closeCampaignModal}
                  className="px-3.5 py-1.5 border border-border rounded-xl text-xs font-bold hover:bg-zinc-800 text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCampaignMutation.isPending || updateCampaignMutation.isPending}
                  className="px-4.5 py-1.5 bg-azure-500 hover:bg-azure-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  {(createCampaignMutation.isPending || updateCampaignMutation.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Upload Collateral Modal */}
      {showCollateralModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-border rounded-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-border/50 flex justify-between items-center bg-zinc-900/20">
              <h3 className="text-sm font-bold text-foreground">Upload GTM Collateral</h3>
              <button onClick={() => setShowCollateralModal(false)} className="p-1 hover:bg-zinc-800 rounded-lg text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">File Selection *</label>
                <input
                  type="file"
                  required
                  onChange={e => setCollateralFile(e.target.files?.[0] || null)}
                  className="w-full bg-zinc-900 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-azure-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Link to Launch (Optional)</label>
                  <select
                    value={collateralLaunchId}
                    onChange={e => setCollateralLaunchId(e.target.value)}
                    className="w-full bg-zinc-900 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                  >
                    <option value="">None</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.clientName})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Link to Partner (Optional)</label>
                  <select
                    value={collateralPartnerId}
                    onChange={e => setCollateralPartnerId(e.target.value)}
                    className="w-full bg-zinc-900 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                  >
                    <option value="">None</option>
                    {partnersList.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Uploaded By</label>
                <input
                  type="text"
                  required
                  value={collateralUploader}
                  onChange={e => setCollateralUploader(e.target.value)}
                  placeholder="e.g. Alice Johnson"
                  className="w-full bg-zinc-900 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                />
              </div>

              {uploadError && (
                <p className="text-[10px] text-red-400 font-semibold">{uploadError}</p>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setShowCollateralModal(false)}
                  className="px-3.5 py-1.5 border border-border rounded-xl text-xs font-bold hover:bg-zinc-800 text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadProgress}
                  className="px-4.5 py-1.5 bg-[#378add] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  {uploadProgress && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Upload Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
