import { generateMeetingDocx } from '../lib/exportDocx';
import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { presalesDocumentationApi, membersApi, presalesMeetingRecordsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { presalesApi } from '@/lib/presalesApi';
import axios from 'axios';
import GenerateProposalModal from '@/components/GenerateProposalModal';
import GenerateSectionModal from '@/components/GenerateSectionModal';
import AiGeneratedMinutesBox from '@/components/AiGeneratedMinutesBox';
import {
  FileText, Link2, Notebook, Plus, Trash2, ExternalLink,
  Pencil, Calendar, TrendingUp, AlertCircle, Loader2,
  FileDown, ChevronRight, Check, X,
  Users, Search,
  AlertTriangle, Video, PlayCircle, Sparkles, FileText as FileTextIcon, MoreVertical, Edit3,
  BrainCircuit, RefreshCw, FilePlus2
, Download } from 'lucide-react';
import { cn, extractMeetingDate } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Helper to format byte sizes
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper to get initials
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Format date nicely
function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Date Pending';
  const d = new Date(dateStr);
  const isMidnightUTC = dateStr.includes('T00:00:00.000Z');
  
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: isMidnightUTC ? 'UTC' : undefined
  };
  
  if (!isMidnightUTC) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return d.toLocaleDateString('en-US', options);
}





type SectionType = 'files' | 'links' | 'notes' | 'records';

export default function PreSalesDetailPage() {
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState<SectionType>('files');
  const [showProposalModal, setShowProposalModal] = useState(false);

  const { user, hasPermission } = useAuth();
  const isAdmin = hasPermission('manageTeam');
  const actingMemberId = user?.teamMemberId || '';
  
  const [editingSectionKey, setEditingSectionKey] = useState<string | null>(null);
  const [editingSectionValue, setEditingSectionValue] = useState('');
  const [uploadSectionKey, setUploadSectionKey] = useState<string | null>(null);
  const [uploadSectionName, setUploadSectionName] = useState<string | null>(null);

  const [isAssignDropdownOpen, setIsAssignDropdownOpen] = useState(false);
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [selectedMembersToAssign, setSelectedMembersToAssign] = useState<Set<string>>(new Set());

  // Meeting Record Form State
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recordTitle, setRecordTitle] = useState('');
  const [recordDate, setRecordDate] = useState('');
  const [dateAutoFilled, setDateAutoFilled] = useState(false);
  const [userEditedDate, setUserEditedDate] = useState(false);
  const [recordingType, setRecordingType] = useState<'none'|'link'|'file'>('none');
  const [recordingLink, setRecordingLink] = useState('');
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [transcriptSource, setTranscriptSource] = useState<'none'|'pasted'|'uploaded_file'>('none');
  const [transcriptPasted, setTranscriptPasted] = useState('');
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);

  useEffect(() => {
    if (userEditedDate) return;
    if (transcriptPasted) {
      const extracted = extractMeetingDate(transcriptPasted);
      if (extracted) {
        setRecordDate(extracted);
        setDateAutoFilled(true);
      }
    } else if (transcriptFile) {
      const extracted = extractMeetingDate('', transcriptFile);
      if (extracted) {
        setRecordDate(extracted);
        setDateAutoFilled(true);
      }
    }
  }, [transcriptPasted, transcriptFile, userEditedDate]);

  const [editingTranscriptId, setEditingTranscriptId] = useState<string | null>(null);
  const [editingTranscriptText, setEditingTranscriptText] = useState('');


  
  // Modals / Form states
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editingLink, setEditingLink] = useState<{ id: string; title: string; url: string; description: string } | null>(null);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDesc, setLinkDesc] = useState('');
  
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editingNote, setEditingNote] = useState<{ id: string; title: string; content: string } | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Fetch opportunity details
  const { data: oppData, isLoading, isError } = useQuery({
    queryKey: ['presales-opportunity', opportunityId],
    queryFn: () => presalesApi.get(opportunityId || '').then(r => r.data),
    enabled: !!opportunityId,
  });

  const opportunity = oppData;
  const files = oppData?.files || [];
  const links = oppData?.links || [];
  const notes = oppData?.notes || [];


  const projectMembersList = opportunity?.assignments || [];
  const assignedMembers: { member: { id: string; name: string; profilePictureUrl?: string | null; designation?: string | null }; role: string }[] = [];

  projectMembersList.forEach((m: any) => {
    if (!assignedMembers.some(am => am.member.id === m.member.id)) {
      assignedMembers.push(m);
    }
  });

  // Fetch members
  const { data: membersRes } = useQuery({
    queryKey: ['members'],
    queryFn: () => membersApi.list({ limit: 1000 }).then(r => r.data),
  });



  // Fetch meeting records
  const { data: recordsRes, isLoading: isLoadingRecords } = useQuery({
    queryKey: ['presales-meeting-records', opportunityId],
    queryFn: () => presalesMeetingRecordsApi.list(opportunityId || '').then(r => r.data),
    enabled: !!opportunityId,
  });

  const allMembers = membersRes?.data || [];
  const meetingRecords = recordsRes?.data || [];

  // Mutations
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      // 1. Get SAS URL
      const { data: { uploadUrl, blobName, contentType } } = await presalesDocumentationApi.getUploadUrl(opportunityId || '', {
        fileName: file.name,
        fileType: file.type,
        uploadedBy: actingMemberId
      });

      // 2. Direct upload to Azure
      await axios.put(uploadUrl, file, {
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "Content-Type": contentType,
        },
      });

      // 3. Save metadata
      const { data: savedFile } = await presalesDocumentationApi.createFileMetadata(opportunityId || '', {
        blobName,
        fileName: file.name,
        fileType: file.type,
        size: file.size,
        uploadedBy: actingMemberId
      });

      return savedFile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-opportunity', opportunityId] });
      setUploadError(null);
    },
    onError: (err: any) => {
      setUploadError(err.response?.data?.error || err.message || 'Failed to upload file.');
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => presalesDocumentationApi.deleteFile(opportunityId || '', fileId, actingMemberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-opportunity', opportunityId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to delete file.');
    }
  });

  const saveLinkMutation = useMutation({
    mutationFn: (payload: { title: string; url: string; description?: string }) => {
      if (editingLink) {
        return presalesDocumentationApi.updateLink(opportunityId || '', editingLink.id, { ...payload, addedBy: actingMemberId });
      }
      return presalesDocumentationApi.createLink(opportunityId || '', { ...payload, addedBy: actingMemberId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-opportunity', opportunityId] });
      closeLinkForm();
    },
    onError: (err: any) => {
      setLinkError(err.response?.data?.error || 'Failed to save link.');
    }
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (linkId: string) => presalesDocumentationApi.deleteLink(opportunityId || '', linkId, actingMemberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-opportunity', opportunityId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to delete link.');
    }
  });

  const saveNoteMutation = useMutation({
    mutationFn: (payload: { title: string; content: string }) => {
      if (editingNote) {
        return presalesDocumentationApi.updateNote(opportunityId || '', editingNote.id, { ...payload, updatedBy: actingMemberId });
      }
      return presalesDocumentationApi.createNote(opportunityId || '', { ...payload, updatedBy: actingMemberId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-opportunity', opportunityId] });
      closeNoteForm();
    },
    onError: (err: any) => {
      setNoteError(err.response?.data?.error || 'Failed to save note.');
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => presalesDocumentationApi.deleteNote(opportunityId || '', noteId, actingMemberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-opportunity', opportunityId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to delete note.');
    }
  });

  // Link Form operations
  const openAddLink = () => {
    setEditingLink(null);
    setLinkTitle('');
    setLinkUrl('');
    setLinkDesc('');
    setLinkError(null);
    setShowLinkForm(true);
  };

  const openEditLink = (lnk: any) => {
    setEditingLink(lnk);
    setLinkTitle(lnk.title);
    setLinkUrl(lnk.url);
    setLinkDesc(lnk.description || '');
    setLinkError(null);
    setShowLinkForm(true);
  };

  const closeLinkForm = () => {
    setShowLinkForm(false);
    setEditingLink(null);
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim()) {
      setLinkError('Title and URL are required.');
      return;
    }
    saveLinkMutation.mutate({
      title: linkTitle,
      url: linkUrl,
      description: linkDesc
    });
  };

  // Note Form operations
  const openAddNote = () => {
    setEditingNote(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteError(null);
    setShowNoteForm(true);
  };

  const openEditNote = (nt: any) => {
    setEditingNote(nt);
    setNoteTitle(nt.title);
    setNoteContent(nt.content);
    setNoteError(null);
    setShowNoteForm(true);
  };

  const closeNoteForm = () => {
    setShowNoteForm(false);
    setEditingNote(null);
  };

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) {
      setNoteError('Title and Content are required.');
      return;
    }
    saveNoteMutation.mutate({
      title: noteTitle,
      content: noteContent
    });
  };

  
  const convertMutation = useMutation({
    mutationFn: async () => {
      const res = await presalesApi.convertToProject(opportunityId!);
      return res.data;
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['presales'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate(`/projects/${newProject.id}`);
    },
    onError: (error: any) => {
      console.error(error);
      alert('Failed to convert opportunity to project.');
    }
  });



  const updateSectionMutation = useMutation({
    mutationFn: (payload: { key: string, value: string }) => presalesApi.updateSection(opportunityId || '', { [payload.key]: payload.value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-opportunity', opportunityId] });
      setEditingSectionKey(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to update section.');
    }
  });



  const bulkAssignMutation = useMutation({
    mutationFn: async (memberIds: string[]) => {
      // Execute sequentially or Promise.all. We will do Promise.all
      return Promise.all(memberIds.map(id => presalesApi.addMember(opportunityId || '', { memberId: id })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-opportunity', opportunityId] });
      setSelectedMembersToAssign(new Set());
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to assign members.');
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => presalesApi.removeMember(opportunityId || '', memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-opportunity', opportunityId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to remove member.');
    }
  });

  const createRecordMutation = useMutation({
    mutationFn: (fd: FormData) => presalesMeetingRecordsApi.create(opportunityId || '', fd),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['presales-meeting-records', opportunityId] });
      setShowRecordForm(false);
      // Reset form
      setRecordTitle('');
      setRecordDate('');
      setDateAutoFilled(false);
      setUserEditedDate(false);
      setRecordingType('none');
      setRecordingLink('');
      setRecordingFile(null);
      setTranscriptSource('none');
      setTranscriptPasted('');
      setTranscriptFile(null);

      const record = res?.data;
      if (record?.aiMinutes?.status === 'TOKENS_EXCEEDED') {
        alert("Meeting record saved successfully, but AI minutes generation failed: TOKENS exceeded. It will be generated automatically in the background.");
      }
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to create record');
    }
  });

  const deleteRecordMutation = useMutation({
    mutationFn: (recordId: string) => presalesMeetingRecordsApi.delete(opportunityId || '', recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-meeting-records', opportunityId] });
    }
  });

  const toggleActionItemMutation = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      presalesMeetingRecordsApi.toggleActionItem(opportunityId || '', itemId, completed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-meeting-records', opportunityId] });
    }
  });

  const reanalyzeMutation = useMutation({
    mutationFn: (recordId: string) => presalesMeetingRecordsApi.reanalyze(opportunityId || '', recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-meeting-records', opportunityId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to re-analyze transcript');
    }
  });

  const updateTranscriptMutation = useMutation({
    mutationFn: ({ recordId, text }: { recordId: string; text: string }) => presalesMeetingRecordsApi.updateTranscript(opportunityId || '', recordId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presales-meeting-records', opportunityId] });
      setEditingTranscriptId(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to update transcript');
    }
  });



  const sortedMembers = useMemo(() => {
    let filtered = allMembers;
    if (assignSearchQuery) {
      const q = assignSearchQuery.toLowerCase();
      filtered = filtered.filter((m: any) => m.name.toLowerCase().includes(q));
    }
    return filtered.sort((a: any, b: any) => {
      const aAssigned = assignedMembers.some((am: any) => am.member.id === a.id);
      const bAssigned = assignedMembers.some((am: any) => am.member.id === b.id);
      if (aAssigned && !bAssigned) return 1;
      if (!aAssigned && bAssigned) return -1;

      const aSel = selectedMembersToAssign.has(a.id);
      const bSel = selectedMembersToAssign.has(b.id);
      if (aSel && !bSel) return -1;
      if (!aSel && bSel) return 1;

      const aBenched = a.allocationStatus === 'BENCHED';
      const bBenched = b.allocationStatus === 'BENCHED';
      if (aBenched && !bBenched) return -1;
      if (!aBenched && bBenched) return 1;

      const aAllocated = a.allocationStatus === 'ALLOCATED';
      const bAllocated = b.allocationStatus === 'ALLOCATED';
      if (aAllocated && !bAllocated) return -1;
      if (!aAllocated && bAllocated) return 1;

      return a.name.localeCompare(b.name);
    });
  }, [allMembers, assignSearchQuery, selectedMembersToAssign, assignedMembers]);

  // Handle File Upload Change
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    uploadFileMutation.mutate(file);
    
    // Clear selection
    e.target.value = '';
  };

  const handleDownload = async (fileId: string) => {
    try {
      const { data: { downloadUrl } } = await presalesDocumentationApi.getDownloadUrl(opportunityId || '', fileId, actingMemberId);
      window.open(downloadUrl, "_blank");
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to generate download link.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (isError || !opportunity) {
    return (
      <div className="p-8 text-center bg-card rounded-2xl border border-border">
        <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-3" />
        <h2 className="text-lg font-bold text-foreground">Failed to load Opportunity Details</h2>
        <p className="text-xs text-muted-foreground mt-1">Make sure the opportunity exists or try reloading.</p>
        <Link to="/projects" className="mt-4 inline-block text-xs font-semibold bg-violet-500 text-white px-4 py-2 rounded-xl">
          Back to Projects
        </Link>
      </div>
    );
  }



  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground transition-colors">Projects</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-semibold">{opportunity.name}</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground/60">Documentation</span>
      </div>

      {/* Opportunity Banner Header */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border tracking-wider",
              opportunity.account === 'PNB' ? "bg-blue-950/40 text-blue-400 border-blue-800/40" :
              "bg-indigo-950/40 text-indigo-400 border-indigo-800/40"
            )}>
              {opportunity.account === 'PNB' ? 'PNB (Proposal & Bid)' : 'TNM (Time & Material)'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider border bg-zinc-900 text-zinc-400 border-zinc-700">
              Stage {opportunity.currentStageIndex + 1}: {opportunity.stages[opportunity.currentStageIndex]}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">{opportunity.name}</h1>
        </div>

        {/* Mini stats */}
        <div className="flex flex-wrap items-center gap-6 border-t md:border-t-0 md:border-l border-border/50 pt-4 md:pt-0 md:pl-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-muted-foreground">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Start Date</p>
              <p className="text-xs font-bold text-foreground">
                {new Date(opportunity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Progress</p>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-violet-500 h-full transition-all" style={{ width: `${opportunity.progressPercent}%` }}></div>
                </div>
                <span className="text-xs font-bold text-foreground">{opportunity.progressPercent}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {isAdmin && (
              <button 
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {convertMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Convert to Project
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Proposal Summary Section - Full Width */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            Proposal Summary
          </h3>
          {opportunity.descriptionGeneratedAt && (
            <p className="text-[10px] text-muted-foreground/60 italic">
              Last generated: {new Date(opportunity.descriptionGeneratedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {(opportunity.descriptionGeneratedAt || 
          opportunity.executiveSummary || 
          opportunity.scopeOfWork || 
          opportunity.architecture || 
          opportunity.implementationApproach || 
          opportunity.deliveryApproach || 
          opportunity.assumptions || 
          opportunity.outOfScope || 
          opportunity.timelines || 
          opportunity.commercials) ? (
          <div className="space-y-3">
            {([
              ['Executive Summary',       opportunity.executiveSummary, 'executiveSummary'],
              ['Scope of Work',           opportunity.scopeOfWork, 'scopeOfWork'],
              ['Architecture',            opportunity.architecture, 'architecture'],
              ['Implementation Approach', opportunity.implementationApproach, 'implementationApproach'],
              ['Delivery Approach',       opportunity.deliveryApproach, 'deliveryApproach'],
              ['Assumptions',             opportunity.assumptions, 'assumptions'],
              ['Out of Scope',            opportunity.outOfScope, 'outOfScope'],
              ['Timelines',               opportunity.timelines, 'timelines'],
              ['Commercials',             opportunity.commercials, 'commercials'],
            ] as [string, string | null, string][]).map(([label, content, key], idx) => {
              const isBlank = !content || content === 'Not specified in provided documents.';
              const isEditing = editingSectionKey === key;

              return (
                <details
                  key={label}
                  className="group bg-zinc-900/50 rounded-xl border border-zinc-800/50 overflow-hidden [&_summary::-webkit-details-marker]:hidden"
                  open={idx === 0}
                >
                  <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none list-none hover:bg-zinc-800/30 transition-colors">
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground border-t border-zinc-800/50">
                    {isEditing ? (
                      <div className="space-y-2 mt-2">
                        <textarea
                          className="w-full bg-black/50 border border-zinc-800 rounded-lg p-3 text-sm text-foreground focus:border-violet-500/50 outline-none resize-y min-h-[100px]"
                          value={editingSectionValue}
                          onChange={e => setEditingSectionValue(e.target.value)}
                          autoFocus
                          placeholder={`Enter ${label}...`}
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingSectionKey(null)} className="px-3 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-foreground rounded-lg transition-colors">Cancel</button>
                          <button
                            onClick={() => updateSectionMutation.mutate({ key, value: editingSectionValue })}
                            disabled={updateSectionMutation.isPending}
                            className="px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {updateSectionMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="whitespace-pre-wrap leading-relaxed mt-2 text-foreground">
                          {content || 'Not specified in provided documents.'}
                        </div>
                        {isBlank && (
                          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-zinc-800/50">
                            <button
                              onClick={() => {
                                setEditingSectionKey(key);
                                setEditingSectionValue(content && content !== 'Not specified in provided documents.' ? content : '');
                              }}
                              className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-foreground px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Edit Manually
                            </button>
                            <button
                              onClick={() => {
                                setUploadSectionKey(key);
                                setUploadSectionName(label);
                              }}
                              className="flex items-center gap-1.5 text-xs font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition-colors border border-blue-500/20"
                            >
                              <FilePlus2 className="w-3.5 h-3.5" />
                              Upload PDF to Fill This In
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </details>
              );
            })}
            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => {
                  if (confirm('This will replace the current proposal summary with a newly generated one. Continue?')) {
                    setShowProposalModal(true);
                  }
                }}
                className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-violet-400 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Re-generate Proposal Summary
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2 py-4">
            <p className="text-sm text-muted-foreground italic opacity-60">Proposal summary has not been generated.</p>
            <button
              onClick={() => setShowProposalModal(true)}
              className="flex items-center gap-2 px-4 py-2 mt-1 text-xs font-semibold bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 rounded-xl transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate Proposal Summary
            </button>
          </div>
        )}
      </div>

      {/* Assigned Members Section (At-a-glance) */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 relative">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-400" />
            Currently Assigned ({assignedMembers.length})
          </h3>
          {isAdmin && (
            <button
              onClick={() => setIsAssignDropdownOpen(!isAssignDropdownOpen)}
              className="px-2.5 py-1 text-[10px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-foreground rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Assign Members
            </button>
          )}
          
          {isAssignDropdownOpen && (
            <div className="absolute right-0 top-10 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[400px]">
              <div className="p-3 border-b border-zinc-800/50 bg-zinc-900/90 backdrop-blur-md sticky top-0 z-10">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={assignSearchQuery}
                    onChange={e => setAssignSearchQuery(e.target.value)}
                    placeholder="Search by name, designation, status..."
                    className="w-full bg-black/50 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-violet-500/50 transition-colors"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sortedMembers.map((m: any) => {
                  const isAssigned = assignedMembers.some(am => am.member.id === m.id);
                  const isSelected = selectedMembersToAssign.has(m.id);
                  const isAllocated = m.allocationStatus === 'ALLOCATED';
                  
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (isAssigned) return;
                        if (isSelected) {
                          const next = new Set(selectedMembersToAssign);
                          next.delete(m.id);
                          setSelectedMembersToAssign(next);
                        } else {
                          const next = new Set(selectedMembersToAssign);
                          next.add(m.id);
                          setSelectedMembersToAssign(next);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-lg text-left transition-all",
                        isAssigned ? "opacity-50 cursor-not-allowed bg-transparent" :
                        isSelected ? "bg-violet-500/10 border border-violet-500/30" :
                        "hover:bg-zinc-800/50 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {m.profilePictureUrl ? (
                          <img src={m.profilePictureUrl} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold shrink-0">
                            {getInitials(m.name)}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-foreground leading-tight">{m.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider",
                              isAllocated ? "bg-blue-500/10 text-blue-400" : "bg-emerald-500/10 text-emerald-400"
                            )}>
                              {m.allocationStatus || 'BENCHED'}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <BrainCircuit className="w-3 h-3 text-violet-400" />
                              ATS: {m.atsScore || 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center justify-center">
                        {isAssigned ? (
                          <span className="text-[10px] font-bold text-muted-foreground mr-2">Assigned</span>
                        ) : isSelected ? (
                          <div className="w-5 h-5 rounded bg-violet-500 flex items-center justify-center text-white">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded border border-zinc-700 bg-black/20" />
                        )}
                      </div>
                    </button>
                  );
                })}
                {sortedMembers.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs text-muted-foreground">No members found matching your search.</p>
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-zinc-800/50 bg-zinc-900 flex justify-between items-center gap-3">
                <span className="text-xs text-muted-foreground font-medium">
                  {selectedMembersToAssign.size} selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsAssignDropdownOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (selectedMembersToAssign.size > 0) {
                        bulkAssignMutation.mutate(Array.from(selectedMembersToAssign));
                        setIsAssignDropdownOpen(false);
                      }
                    }}
                    disabled={selectedMembersToAssign.size === 0 || bulkAssignMutation.isPending}
                    className="px-3 py-1.5 text-xs font-semibold bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {bulkAssignMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Confirm Assignment
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {assignedMembers.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {assignedMembers.map((m: any) => (
              <div key={m.member.id} className="flex items-center gap-2.5 bg-muted/20 border border-border/50 rounded-full pr-4 pl-1.5 py-1.5 hover:bg-muted/40 transition-colors">
                {m.member.profilePictureUrl ? (
                  <img src={m.member.profilePictureUrl} alt={m.member.name} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-violet-500/10 text-violet-400 flex items-center justify-center text-[10px] font-bold">
                    {getInitials(m.member.name)}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground leading-none">{m.member.name}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{m.role || 'Member'}</span>
                </div>
                {isAdmin && m.role !== 'Project Manager' && (
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${m.member.name} from the opportunity?`)) {
                        removeMemberMutation.mutate(m.member.id);
                      }
                    }}
                    disabled={removeMemberMutation.isPending}
                    className="ml-1 p-1 hover:bg-red-500/20 hover:text-red-400 text-muted-foreground rounded-full transition-colors disabled:opacity-50"
                    title="Remove member"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No members assigned to this opportunity yet.</p>
        )}
      </div>

      {/* Main content split */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Navigation Sidebar Tabs */}
        <div className="bg-card border border-border rounded-2xl p-3 space-y-1.5">

          <button
            onClick={() => setActiveSection('records')}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeSection === 'records' ? "bg-violet-500/10 text-violet-400 border-l-2 border-violet-500 pl-3" : "text-muted-foreground hover:bg-zinc-800/40 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Video className="w-4 h-4" />
              <span>Transcripts & Recordings</span>
            </div>
          </button>

          <div className="pt-2 pb-1 px-3">
            <span className="text-[10px] font-extrabold text-muted-foreground/60 uppercase tracking-wider">Docs</span>
          </div>

          <button
            onClick={() => setActiveSection('files')}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeSection === 'files' ? "bg-violet-500/10 text-violet-400 border-l-2 border-violet-500 pl-3" : "text-muted-foreground hover:bg-zinc-800/40 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4" />
              <span>Opportunity Files</span>
            </div>
            <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded-full font-extrabold text-foreground">{files.length}</span>
          </button>

          <button
            onClick={() => setActiveSection('links')}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeSection === 'links' ? "bg-violet-500/10 text-violet-400 border-l-2 border-violet-500 pl-3" : "text-muted-foreground hover:bg-zinc-800/40 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Link2 className="w-4 h-4" />
              <span>External Links</span>
            </div>
            <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded-full font-extrabold text-foreground">{links.length}</span>
          </button>

          <button
            onClick={() => setActiveSection('notes')}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeSection === 'notes' ? "bg-violet-500/10 text-violet-400 border-l-2 border-violet-500 pl-3" : "text-muted-foreground hover:bg-zinc-800/40 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Notebook className="w-4 h-4" />
              <span>SOP Notes</span>
            </div>
            <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded-full font-extrabold text-foreground">{notes.length}</span>
          </button>
        </div>

        {/* Section Contents */}
        <div className="lg:col-span-3 space-y-6">

          {/* 2. FILES SECTION */}
          {activeSection === 'files' && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
                <div>
                  <h2 className="text-md font-bold text-foreground">Opportunity Files & Attachments</h2>
                  <p className="text-[10px] text-muted-foreground">Store requirements, diagrams, credentials, or specification files.</p>
                </div>
                
                <div>
                  <label className={cn(
                    "cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-violet-500 hover:bg-violet-600 text-white transition-all shadow-md shadow-violet-500/10",
                    (!actingMemberId || uploadFileMutation.isPending) && "opacity-50 pointer-events-none"
                  )}>
                    {uploadFileMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Upload File
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={!actingMemberId || uploadFileMutation.isPending}
                    />
                  </label>
                </div>
              </div>

              {uploadError && (
                <div className="flex items-center gap-2 p-3 bg-red-950/20 border border-red-800/30 text-red-400 rounded-xl text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Files Table List */}
              <div 
                className={cn("space-y-3", actingMemberId && !uploadFileMutation.isPending && "min-h-[200px]")}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file && actingMemberId && !uploadFileMutation.isPending) {
                    setUploadError(null);
                    uploadFileMutation.mutate(file);
                  }
                }}
              >
                {files.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed border-border rounded-2xl space-y-2">
                    <FileText className="w-10 h-10 mx-auto text-muted-foreground/55" />
                    <h3 className="text-xs font-bold text-foreground">No files attached yet</h3>
                    <p className="text-[10px] text-muted-foreground">Attach functional guides or technical requirements docs for the team.</p>
                  </div>
                ) : (
                  files.map((file: any) => {
                    const uploader = assignedMembers.find((m: any) => m.member.id === file.uploadedBy)?.member;

                    return (
                      <div
                        key={file.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border/80 hover:border-border rounded-xl bg-zinc-950/10 hover:bg-zinc-950/30 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-border flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground leading-snug break-all">{file.name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              <span>{formatBytes(file.size)}</span>
                              <span>•</span>
                              <span>{file.type.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <div className="flex items-center gap-2">
                            {uploader ? (
                              <div className="flex items-center gap-1.5" title={`Uploaded by ${uploader.name}`}>
                                {uploader.profilePictureUrl ? (
                                  <img src={uploader.profilePictureUrl} alt="" className="w-4 h-4 rounded-full" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-zinc-800 text-[8px] font-extrabold flex items-center justify-center text-foreground">
                                    {getInitials(uploader.name)}
                                  </div>
                                )}
                                <span className="text-[10px] text-muted-foreground/80 font-medium max-w-[80px] truncate">{uploader.name}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/75">Unknown</span>
                            )}
                            <span className="text-[10px] text-muted-foreground/60">{formatDate(file.uploadedAt)}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDownload(file.id)}
                              disabled={!actingMemberId}
                              className="p-1.5 hover:bg-zinc-800 text-muted-foreground hover:text-foreground rounded-lg transition-all disabled:opacity-40"
                              title="Download/Open file"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </button>
                            {(isAdmin || file.uploadedBy === actingMemberId) && (
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this file?')) {
                                    deleteFileMutation.mutate(file.id);
                                  }
                                }}
                                disabled={!actingMemberId || deleteFileMutation.isPending}
                                className="p-1.5 hover:bg-red-950/20 text-muted-foreground hover:text-red-400 rounded-lg transition-all disabled:opacity-40"
                                title="Delete file"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 2. LINKS SECTION */}
          {activeSection === 'links' && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-border/50">
                <div>
                  <h2 className="text-md font-bold text-foreground">External Document Links</h2>
                  <p className="text-[10px] text-muted-foreground">Link Figma mockups, Google Drive folders, Notion wikis, or opportunity workspaces.</p>
                </div>
                
                <button
                  onClick={openAddLink}
                  disabled={!actingMemberId}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-violet-500 hover:bg-violet-600 text-white transition-all shadow-md shadow-violet-500/10 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Link
                </button>
              </div>

              {/* Link Creation / Editing Form Inline */}
              {showLinkForm && (
                <form onSubmit={handleLinkSubmit} className="p-4 bg-zinc-950/20 border border-border/80 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-foreground">
                    {editingLink ? 'Edit External Link' : 'Add External Link'}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1.5">Link Title *</label>
                      <input
                        type="text"
                        value={linkTitle}
                        onChange={(e) => setLinkTitle(e.target.value)}
                        placeholder="e.g. Figma UI Mockups"
                        className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1.5">URL *</label>
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://figma.com/..."
                        className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1.5">Short Description</label>
                    <input
                      type="text"
                      value={linkDesc}
                      onChange={(e) => setLinkDesc(e.target.value)}
                      placeholder="e.g. Current design mockups reviewed by client"
                      className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </div>

                  {linkError && (
                    <p className="text-[10px] text-red-400 font-semibold">{linkError}</p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={closeLinkForm}
                      className="px-3 py-1.5 text-[10px] font-bold border border-border rounded-lg text-foreground hover:bg-muted/40"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saveLinkMutation.isPending}
                      className="px-4.5 py-1.5 text-[10px] font-bold bg-violet-500 hover:bg-violet-600 text-white rounded-lg flex items-center gap-1.5"
                    >
                      {saveLinkMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                      Save Link
                    </button>
                  </div>
                </form>
              )}

              {/* Links List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {links.length === 0 ? (
                  <div className="md:col-span-2 p-12 text-center border-2 border-dashed border-border rounded-2xl space-y-2">
                    <Link2 className="w-10 h-10 mx-auto text-muted-foreground/55" />
                    <h3 className="text-xs font-bold text-foreground">No links added yet</h3>
                    <p className="text-[10px] text-muted-foreground">Attach external Figma projects or shared drives.</p>
                  </div>
                ) : (
                  links.map((lnk: any) => {
                    const adder = assignedMembers.find((m: any) => m.member.id === lnk.addedBy)?.member;

                    return (
                      <div
                        key={lnk.id}
                        className="p-4 border border-border/80 hover:border-border rounded-xl bg-zinc-950/10 hover:bg-zinc-950/30 transition-all flex flex-col justify-between gap-3 group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-extrabold text-foreground tracking-wide truncate pr-4">{lnk.title}</h3>
                            <a
                              href={lnk.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-violet-400 hover:text-violet-300 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                          {lnk.description && (
                            <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{lnk.description}</p>
                          )}
                          <p className="text-[9px] text-violet-500/80 font-mono truncate">{lnk.url}</p>
                        </div>

                        <div className="flex items-center justify-between border-t border-border/40 pt-2.5">
                          <div className="flex items-center gap-1.5">
                            {adder && (
                              <div className="flex items-center gap-1">
                                {adder.profilePictureUrl ? (
                                  <img src={adder.profilePictureUrl} alt="" className="w-4 h-4 rounded-full" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-zinc-800 text-[8px] font-extrabold flex items-center justify-center text-foreground">
                                    {getInitials(adder.name)}
                                  </div>
                                )}
                                <span className="text-[9px] text-muted-foreground font-semibold max-w-[80px] truncate">{adder.name}</span>
                              </div>
                            )}
                            <span className="text-[9px] text-muted-foreground/60">{formatDate(lnk.addedAt).split(',')[0]}</span>
                          </div>

                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => openEditLink(lnk)}
                              disabled={!actingMemberId}
                              className="p-1 hover:bg-zinc-800 hover:text-foreground text-muted-foreground rounded-lg transition-all"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            {(isAdmin || lnk.addedBy === actingMemberId) && (
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this link?')) {
                                    deleteLinkMutation.mutate(lnk.id);
                                  }
                                }}
                                disabled={!actingMemberId || deleteLinkMutation.isPending}
                                className="p-1 hover:bg-red-950/20 hover:text-red-400 text-muted-foreground rounded-lg transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 3. NOTES SECTION */}
          {activeSection === 'notes' && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-border/50">
                <div>
                  <h2 className="text-md font-bold text-foreground">Project Notes & SOPs</h2>
                  <p className="text-[10px] text-muted-foreground">Write standard operating procedures, guidelines, or specs inline.</p>
                </div>
                
                <button
                  onClick={openAddNote}
                  disabled={!actingMemberId}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-violet-500 hover:bg-violet-600 text-white transition-all shadow-md shadow-violet-500/10 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Note
                </button>
              </div>

              {/* Note Editor Inline */}
              {showNoteForm && (
                <form onSubmit={handleNoteSubmit} className="p-4 bg-zinc-950/20 border border-border/80 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-foreground">
                    {editingNote ? 'Edit Note details' : 'Create Project Note'}
                  </h3>
                  
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1.5">Note Title *</label>
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="e.g. Deployment instructions"
                      className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1.5">Note Content (Markdown supported) *</label>
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Write documentation steps here..."
                      rows={8}
                      className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 font-mono"
                    />
                  </div>

                  {noteError && (
                    <p className="text-[10px] text-red-400 font-semibold">{noteError}</p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={closeNoteForm}
                      className="px-3 py-1.5 text-[10px] font-bold border border-border rounded-lg text-foreground hover:bg-muted/40"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saveNoteMutation.isPending}
                      className="px-4.5 py-1.5 text-[10px] font-bold bg-violet-500 hover:bg-violet-600 text-white rounded-lg flex items-center gap-1.5"
                    >
                      {saveNoteMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                      Save Note
                    </button>
                  </div>
                </form>
              )}

              {/* Notes list */}
              <div className="space-y-4">
                {notes.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed border-border rounded-2xl space-y-2">
                    <Notebook className="w-10 h-10 mx-auto text-muted-foreground/55" />
                    <h3 className="text-xs font-bold text-foreground">No notes created yet</h3>
                    <p className="text-[10px] text-muted-foreground">Document coding instructions, checklist releases, or environment properties.</p>
                  </div>
                ) : (
                  notes.map((note: any) => {
                    const updater = assignedMembers.find((m: any) => m.member.id === note.updatedBy)?.member;

                    return (
                      <div
                        key={note.id}
                        className="p-5 border border-border/80 rounded-2xl bg-zinc-950/10 hover:bg-zinc-950/20 transition-all space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-border/30 pb-3">
                          <div>
                            <h3 className="text-sm font-extrabold text-foreground tracking-wide leading-snug">{note.title}</h3>
                            <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-0.5">
                              {updater && (
                                <span className="font-semibold text-muted-foreground/80">Updated by {updater.name}</span>
                              )}
                              <span>•</span>
                              <span>{formatDate(note.updatedAt)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditNote(note)}
                              disabled={!actingMemberId}
                              className="p-1.5 hover:bg-zinc-800 hover:text-foreground text-muted-foreground rounded-lg transition-all"
                              title="Edit note"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {(isAdmin || note.addedBy === actingMemberId) && (
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this note?')) {
                                    deleteNoteMutation.mutate(note.id);
                                  }
                                }}
                                disabled={!actingMemberId || deleteNoteMutation.isPending}
                                className="p-1.5 hover:bg-red-950/20 hover:text-red-400 text-muted-foreground rounded-lg transition-all"
                                title="Delete note"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Rendering content raw with simple pre-wrap for ease of viewing */}
                        <div className="text-xs text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed bg-zinc-950/40 p-4 rounded-xl border border-border/30">
                          {note.content}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 5. TRANSCRIPTS & RECORDINGS */}
          {activeSection === 'records' && (
            <ErrorBoundary>
              <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-border/50">
                <div>
                  <h2 className="text-md font-bold text-foreground">Transcripts & Recordings</h2>
                  <p className="text-[10px] text-muted-foreground">Manage meeting recordings and their transcripts.</p>
                </div>
                <button
                  onClick={() => setShowRecordForm(true)}
                  disabled={!actingMemberId}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-violet-500 hover:bg-violet-600 text-white transition-all shadow-md shadow-violet-500/10 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Meeting Record
                </button>
              </div>

              {showRecordForm && (
                <div className="bg-zinc-900/50 p-5 rounded-xl border border-violet-500/20 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-violet-400">Add New Record</h3>
                    <button onClick={() => setShowRecordForm(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Meeting Title</label>
                      <input
                        type="text"
                        value={recordTitle}
                        onChange={e => setRecordTitle(e.target.value)}
                        placeholder="e.g. Sprint Planning - July 10"
                        className="w-full bg-zinc-950 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1.5 flex items-center gap-2">
                        Meeting Date
                        {dateAutoFilled && <span className="text-violet-400 normal-case bg-violet-500/10 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide">✨ Auto-detected</span>}
                      </label>
                      <input
                        type="datetime-local"
                        value={recordDate}
                        onChange={e => {
                          setRecordDate(e.target.value);
                          setUserEditedDate(true);
                          setDateAutoFilled(false);
                        }}
                        className="w-full bg-zinc-950 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-violet-500/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-border/50">
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase">Recording</label>
                    <div className="flex gap-2">
                      <button onClick={() => setRecordingType('none')} className={cn("px-3 py-1.5 text-xs rounded-lg border", recordingType === 'none' ? "bg-violet-500/10 border-violet-500 text-violet-400" : "bg-card border-border text-muted-foreground")}>None</button>
                      <button onClick={() => setRecordingType('link')} className={cn("px-3 py-1.5 text-xs rounded-lg border", recordingType === 'link' ? "bg-violet-500/10 border-violet-500 text-violet-400" : "bg-card border-border text-muted-foreground")}>Paste Link</button>
                      <button onClick={() => setRecordingType('file')} className={cn("px-3 py-1.5 text-xs rounded-lg border", recordingType === 'file' ? "bg-violet-500/10 border-violet-500 text-violet-400" : "bg-card border-border text-muted-foreground")}>Upload File</button>
                    </div>
                    {recordingType === 'link' && (
                      <input type="text" placeholder="https://zoom.us/..." value={recordingLink} onChange={e => setRecordingLink(e.target.value)} className="w-full bg-zinc-950 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-violet-500/50" />
                    )}
                    {recordingType === 'file' && (
                      <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e => setRecordingFile(e.target.files?.[0] || null)} className="w-full bg-zinc-950 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-violet-500/50" />
                    )}
                  </div>

                  <div className="space-y-3 pt-2 border-t border-border/50">
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase">Transcript</label>
                    <div className="flex gap-2">
                      <button onClick={() => setTranscriptSource('none')} className={cn("px-3 py-1.5 text-xs rounded-lg border", transcriptSource === 'none' ? "bg-violet-500/10 border-violet-500 text-violet-400" : "bg-card border-border text-muted-foreground")}>None</button>
                      <button onClick={() => setTranscriptSource('pasted')} className={cn("px-3 py-1.5 text-xs rounded-lg border", transcriptSource === 'pasted' ? "bg-violet-500/10 border-violet-500 text-violet-400" : "bg-card border-border text-muted-foreground")}>Paste Text</button>
                      <button onClick={() => setTranscriptSource('uploaded_file')} className={cn("px-3 py-1.5 text-xs rounded-lg border", transcriptSource === 'uploaded_file' ? "bg-violet-500/10 border-violet-500 text-violet-400" : "bg-card border-border text-muted-foreground")}>Upload File</button>
                    </div>
                    {transcriptSource === 'pasted' && (
                      <textarea placeholder="Paste transcript text here..." value={transcriptPasted} onChange={e => setTranscriptPasted(e.target.value)} rows={4} className="w-full bg-zinc-950 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-violet-500/50 resize-none" />
                    )}
                    {transcriptSource === 'uploaded_file' && (
                      <input type="file" accept=".txt,.docx,.doc,.pdf" onChange={e => setTranscriptFile(e.target.files?.[0] || null)} className="w-full bg-zinc-950 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-violet-500/50" />
                    )}
                    {transcriptSource !== 'none' && (
                      <div className="p-3 bg-zinc-950 border border-border/40 rounded-lg flex items-start gap-2.5 mt-2">
                        <BrainCircuit className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">AI Attribution Tip</p>
                          <p className="text-[10px] text-muted-foreground leading-normal">
                            Diarized transcripts (e.g. containing speaker labels like <code className="text-violet-400 font-mono">"Speaker 1: ..."</code> or <code className="text-violet-400 font-mono">"Naved: ..."</code>) are highly recommended. Unstructured plain text transcripts may lead to lower ownership attribution accuracy.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        const fd = new FormData();
                        fd.append('meetingTitle', recordTitle);
                        if (recordDate) fd.append('meetingDate', recordDate);
                        fd.append('recordingType', recordingType);
                        if (recordingType === 'link') fd.append('recordingLink', recordingLink);
                        if (recordingType === 'file' && recordingFile) fd.append('recordingFile', recordingFile);
                        
                        fd.append('transcriptSource', transcriptSource);
                        if (transcriptSource === 'pasted') fd.append('transcriptPasted', transcriptPasted);
                        if (transcriptSource === 'uploaded_file' && transcriptFile) fd.append('transcriptFile', transcriptFile);

                        createRecordMutation.mutate(fd);
                      }}
                      disabled={createRecordMutation.isPending || !recordTitle || (recordingType === 'none' && transcriptSource === 'none')}
                      className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-2"
                    >
                      {createRecordMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Save Record
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {isLoadingRecords ? (
                  <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : meetingRecords.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-2xl">
                    <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mb-3">
                      <Video className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">No records yet</p>
                    <p className="text-xs text-muted-foreground mt-1 text-center max-w-sm">Keep track of your meeting recordings and transcripts here.</p>
                  </div>
                ) : (
                  [...meetingRecords]
                    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((r: any, idx: number) => (
                    <details key={r.id} className="group/record bg-card border border-border rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden" open={idx === 0}>
                      <summary className="flex items-start justify-between p-4 cursor-pointer hover:bg-zinc-900/30 transition-colors">
                        <div className="flex items-center gap-3 w-full">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="mt-1 w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400 shrink-0">
                              <Video className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-foreground">{r.meetingTitle}</h4>
                              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground font-medium">
                                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{r.aiMinutes?.meeting_date || formatDate(r.meetingDate)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-open/record:rotate-90 transition-transform shrink-0 mr-4" />
                        </div>

                        <button 
                              onClick={(e) => { e.stopPropagation(); generateMeetingDocx(r, r.aiMinutes); }}
                              className="p-1.5 hover:bg-zinc-800 text-muted-foreground hover:text-indigo-400 rounded-lg transition-all"
                              title="Download DOCX Summary"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                        <div className="relative">
                          <div className="group/menu" onClick={(e) => e.stopPropagation()}>
                            <button className="p-1.5 hover:bg-zinc-800 text-muted-foreground hover:text-foreground rounded-lg transition-all cursor-pointer flex items-center justify-center">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-40 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-10 overflow-hidden hidden group-hover/menu:block">
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  setEditingTranscriptText(r.transcriptText || ''); 
                                  setEditingTranscriptId(r.id);
                                  e.currentTarget.closest('details')?.removeAttribute('open');
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Edit Transcript
                              </button>
                              {(isAdmin || r.uploadedBy === actingMemberId) && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (confirm('Are you sure you want to delete this record?')) {
                                      deleteRecordMutation.mutate(r.id);
                                    }
                                  }}
                                  disabled={deleteRecordMutation.isPending}
                                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-950/30 flex items-center gap-2 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete Record
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </summary>
                      
                      <div className="p-4 pt-4 border-t border-border/50 bg-zinc-900/10">

                      <div className="mt-4 flex flex-col gap-3 ml-11">
                        <div className="flex flex-wrap gap-3">
                          {r.recordingUrl && (
                            <a href={r.recordingSasUrl || r.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-xs font-bold transition-colors">
                              <PlayCircle className="w-4 h-4" />
                              View Recording {r.recordingType === 'link' ? '(External)' : '(File)'}
                            </a>
                          )}
                          
                          {r.transcriptUrl && (
                            <a href={r.transcriptSasUrl || r.transcriptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-bold transition-colors">
                              <FileDown className="w-4 h-4" />
                              Download Transcript File
                            </a>
                          )}
                        </div>

                        {reanalyzeMutation.isPending && reanalyzeMutation.variables === r.id && (
                          <div className="bg-zinc-950 border border-indigo-500/20 rounded-xl mt-2 p-6 flex flex-col items-center justify-center">
                            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mb-3" />
                            <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Analyzing transcript...</p>
                            <p className="text-[10px] text-muted-foreground mt-1 text-center max-w-sm">Generating new meeting minutes. This may take a few seconds.</p>
                          </div>
                        )}

                        {!(reanalyzeMutation.isPending && reanalyzeMutation.variables === r.id) && r.aiMinutes && typeof r.aiMinutes === 'object' && (
                          <>
                            {(r.aiMinutes as any).status === 'TOKENS_EXCEEDED' ? (
                              <div className="p-4 space-y-4 bg-zinc-950 border border-indigo-500/20 rounded-xl mt-2">
                                <div className="flex items-center justify-between pb-3 border-b border-indigo-500/10">
                                  <div className="flex items-center gap-2">
                                    <BrainCircuit className="w-4 h-4 text-amber-500" />
                                    <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider">AI Generated Minutes</h5>
                                  </div>
                                  <button 
                                    onClick={(e) => { e.preventDefault(); reanalyzeMutation.mutate(r.id); }}
                                    disabled={reanalyzeMutation.isPending}
                                    className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-indigo-500/10 transition-colors flex/inline items-center"
                                  >
                                    <RefreshCw className={cn("w-3.5 h-3.5", reanalyzeMutation.isPending ? "animate-spin" : "")} />
                                    Retry Generation
                                  </button>
                                </div>
                                <div className="flex items-start gap-3 p-3.5 bg-amber-500/5 border border-amber-500/15 rounded-lg text-amber-200">
                                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                  <div className="space-y-1">
                                    <p className="text-xs font-semibold">AI analysis postponed: TOKENS exceeded</p>
                                    <p className="text-[10px] text-amber-400/85">The daily token quota limit for the AI model has been reached. The transcript was saved successfully, and the system will automatically attempt to generate the meeting minutes in the background when the tokens are restored. You can also click "Retry Generation" above to try again manually.</p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <AiGeneratedMinutesBox
                                aiMinutes={r.aiMinutes}
                                actionItems={r.actionItems || []}
                                theme="violet"
                                isReanalyzing={reanalyzeMutation.isPending && reanalyzeMutation.variables === r.id}
                                onReanalyze={() => reanalyzeMutation.mutate(r.id)}
                                onToggleActionItem={(itemId, completed) => toggleActionItemMutation.mutate({ itemId, completed })}
                              />
                            )}
                          </>
                        )}

                        {r.transcriptText && (
                          <details className="group/details bg-zinc-950 border border-border/50 rounded-xl overflow-hidden cursor-pointer mt-3">
                            <summary className="px-4 py-2.5 text-xs font-bold text-foreground flex items-center justify-between hover:bg-zinc-900/50 list-none">
                              <span className="flex items-center gap-2"><FileTextIcon className="w-4 h-4 text-muted-foreground" /> View Transcript</span>
                              <div className="flex items-center gap-3">
                                {editingTranscriptId !== r.id && (
                                  <button
                                    onClick={(e) => { 
                                      e.preventDefault(); 
                                      setEditingTranscriptText(r.transcriptText); 
                                      setEditingTranscriptId(r.id); 
                                      const details = e.currentTarget.closest('details');
                                      if (details && !details.open) {
                                        details.open = true;
                                      }
                                    }}
                                    className="text-[10px] font-bold text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 px-2 py-1.5 rounded transition-colors"
                                  >
                                    Edit Transcript
                                  </button>
                                )}
                                <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-open/details:rotate-90" />
                              </div>
                            </summary>
                            <div className="p-4 border-t border-border/50 bg-zinc-950 text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto cursor-auto">
                              {editingTranscriptId === r.id ? (
                                <div className="space-y-3">
                                  <textarea
                                    className="w-full bg-zinc-900/50 border border-border/50 rounded-lg p-3 text-xs focus:outline-none focus:border-violet-500/50 min-h-[200px]"
                                    value={editingTranscriptText}
                                    onChange={(e) => setEditingTranscriptText(e.target.value)}
                                  />
                                  <div className="flex items-center justify-end gap-2">
                                    <button 
                                      onClick={(e) => { e.preventDefault(); setEditingTranscriptId(null); }}
                                      className="px-3 py-1.5 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 rounded-md transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button 
                                      onClick={(e) => { e.preventDefault(); updateTranscriptMutation.mutate({ recordId: r.id, text: editingTranscriptText }); }}
                                      disabled={updateTranscriptMutation.isPending}
                                      className="px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-md transition-colors flex items-center gap-2"
                                    >
                                      {updateTranscriptMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                      Save Changes
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  {r.transcriptText}
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                        </div>
                      </div>
                    </details>
                  ))
                )}
              </div>
            </div>
          </ErrorBoundary>
        )}

        </div>
      </div>

      {/* Generate Proposal Summary Modal */}
      {showProposalModal && (
        <GenerateProposalModal
          opportunityId={opportunityId!}
          opportunityName={opportunity.name}
          sourceDocuments={opportunity.sourceDocuments}
          onClose={() => setShowProposalModal(false)}
        />
      )}

      {uploadSectionKey && uploadSectionName && opportunityId && (
        <GenerateSectionModal
          opportunityId={opportunityId}
          opportunityName={opportunity.name}
          sectionName={uploadSectionName}
          sectionKey={uploadSectionKey}
          onClose={() => {
            setUploadSectionKey(null);
            setUploadSectionName(null);
          }}
        />
      )}
    </div>
  );
}
