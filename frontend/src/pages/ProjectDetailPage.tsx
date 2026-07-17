import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentationApi, projectsApi, membersApi, projectUpdatesApi, meetingRecordsApi } from '@/lib/api';
import axios from 'axios';
import AiGeneratedMinutesBox from '@/components/AiGeneratedMinutesBox';
import MeetingReportView from '@/components/MeetingReportView';
import {
  FileText, Link2, Notebook, Plus, Trash2, ExternalLink,
  Pencil, Calendar, TrendingUp, AlertCircle, Loader2,
  FileDown, ChevronRight, Check, X,
  Users, Activity, CheckSquare, Square, Search,
  Trophy, AlertTriangle, MessageCircle, Video, PlayCircle, Sparkles, FileText as FileTextIcon, MoreVertical, Edit3,
  BrainCircuit, RefreshCw, BarChart2
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' IST';
  } catch(e) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

const UPDATE_TYPES = [
  { value: 'Progress',  label: 'Progress',  icon: TrendingUp,    color: 'text-blue-400',   bg: 'bg-blue-950/40 border-blue-800/50',   badge: 'bg-blue-900/60 text-blue-300 border-blue-800/40' },
  { value: 'Blocker',   label: 'Blocker',   icon: AlertTriangle, color: 'text-red-400',    bg: 'bg-red-950/40 border-red-800/50',     badge: 'bg-red-900/60 text-red-300 border-red-800/40' },
  { value: 'Milestone', label: 'Milestone', icon: Trophy,        color: 'text-green-400',  bg: 'bg-green-950/40 border-green-800/50', badge: 'bg-green-900/60 text-green-300 border-green-800/40' },
  { value: 'General',   label: 'General',   icon: MessageCircle, color: 'text-slate-400',  bg: 'bg-slate-900/40 border-slate-700/50', badge: 'bg-slate-800/60 text-slate-300 border-slate-700/40' },
];

function getTypeMeta(type: string) {
  return UPDATE_TYPES.find(t => t.value === type) ?? UPDATE_TYPES[3];
}

type SectionType = 'pulse' | 'assign' | 'updates' | 'files' | 'links' | 'notes' | 'records' | 'report';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState<SectionType>('records');
  const [actingMemberId, setActingMemberId] = useState<string>('');
  
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [selectedMembersToAssign, setSelectedMembersToAssign] = useState<Set<string>>(new Set());

  // Meeting Record Form State
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [recordTitle, setRecordTitle] = useState('');
  const [recordDate, setRecordDate] = useState('');
  const [recordingType, setRecordingType] = useState<'none'|'link'|'file'>('none');
  const [recordingLink, setRecordingLink] = useState('');
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [transcriptSource, setTranscriptSource] = useState<'none'|'pasted'|'uploaded_file'>('none');
  const [transcriptPasted, setTranscriptPasted] = useState('');
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);

  const [editingTranscriptId, setEditingTranscriptId] = useState<string | null>(null);
  const [editingTranscriptText, setEditingTranscriptText] = useState('');

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
  const [isActionItemsExpanded, setIsActionItemsExpanded] = useState(true);
  const [isBlockersExpanded, setIsBlockersExpanded] = useState(true);
  
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

  // Fetch documentation details
  const { data, isLoading, isError } = useQuery({
    queryKey: ['project-documentation', projectId],
    queryFn: () => documentationApi.get(projectId || '').then(r => r.data),
    enabled: !!projectId,
  });

  const project = data?.project;
  const files = data?.files || [];
  const links = data?.links || [];
  const notes = data?.notes || [];

  const projectManager = project?.manager;
  const projectMembersList = project?.members || [];
  const assignedMembers: { member: { id: string; name: string; profilePictureUrl?: string | null; designation?: string | null }; role: string }[] = [];

  if (projectManager) {
    assignedMembers.push({
      member: {
        id: projectManager.id,
        name: projectManager.name,
        profilePictureUrl: projectManager.profilePictureUrl,
        designation: projectManager.designation
      },
      role: 'Project Manager'
    });
  }

  projectMembersList.forEach((m: any) => {
    if (!assignedMembers.some(am => am.member.id === m.member.id)) {
      assignedMembers.push(m);
    }
  });

  // Fetch members
  const { data: membersRes, isLoading: isLoadingMembers } = useQuery({
    queryKey: ['members'],
    queryFn: () => membersApi.list({ limit: 1000 }).then(r => r.data),
  });

  // Fetch project updates
  const { data: updatesRes, isLoading: isLoadingUpdates } = useQuery({
    queryKey: ['project-updates', projectId],
    queryFn: () => projectUpdatesApi.list({ projectId }).then(r => r.data),
    enabled: !!projectId,
  });

  // Fetch pulse data
  const { data: pulseData, isLoading: isLoadingPulse } = useQuery({
    queryKey: ['project-pulse', projectId],
    queryFn: () => axios.get(`/api/projects/${projectId}/pulse`).then(r => r.data),
    enabled: !!projectId,
  });

  // Fetch meeting records
  const { data: recordsRes, isLoading: isLoadingRecords } = useQuery({
    queryKey: ['meeting-records', projectId],
    queryFn: () => meetingRecordsApi.list(projectId || '').then(r => r.data),
    enabled: !!projectId,
  });

  const allMembers = membersRes?.data || [];
  const projectUpdates = updatesRes?.data || [];
  const meetingRecords = recordsRes?.data || [];

  // Default the acting member to the first assigned member once loaded
  useEffect(() => {
    if (project?.members?.length > 0 && !actingMemberId) {
      setActingMemberId(project.members[0].member.id);
    }
  }, [project, actingMemberId]);

  // Mutations
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      // 1. Get SAS URL
      const { data: { uploadUrl, blobName, contentType } } = await documentationApi.getUploadUrl(projectId || '', {
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
      const { data: savedFile } = await documentationApi.createFileMetadata(projectId || '', {
        blobName,
        fileName: file.name,
        fileType: file.type,
        size: file.size,
        uploadedBy: actingMemberId
      });

      return savedFile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documentation', projectId] });
      setUploadError(null);
    },
    onError: (err: any) => {
      setUploadError(err.response?.data?.error || err.message || 'Failed to upload file.');
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => documentationApi.deleteFile(projectId || '', fileId, actingMemberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documentation', projectId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to delete file.');
    }
  });

  const saveLinkMutation = useMutation({
    mutationFn: (payload: { title: string; url: string; description?: string }) => {
      if (editingLink) {
        return documentationApi.updateLink(projectId || '', editingLink.id, { ...payload, addedBy: actingMemberId });
      }
      return documentationApi.createLink(projectId || '', { ...payload, addedBy: actingMemberId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documentation', projectId] });
      closeLinkForm();
    },
    onError: (err: any) => {
      setLinkError(err.response?.data?.error || 'Failed to save link.');
    }
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (linkId: string) => documentationApi.deleteLink(projectId || '', linkId, actingMemberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documentation', projectId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to delete link.');
    }
  });

  const saveNoteMutation = useMutation({
    mutationFn: (payload: { title: string; content: string }) => {
      if (editingNote) {
        return documentationApi.updateNote(projectId || '', editingNote.id, { ...payload, updatedBy: actingMemberId });
      }
      return documentationApi.createNote(projectId || '', { ...payload, updatedBy: actingMemberId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documentation', projectId] });
      closeNoteForm();
    },
    onError: (err: any) => {
      setNoteError(err.response?.data?.error || 'Failed to save note.');
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => documentationApi.deleteNote(projectId || '', noteId, actingMemberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documentation', projectId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to delete note.');
    }
  });


  const resolveBlockerMutation = useMutation({
    mutationFn: async (id: string) => {
      return axios.patch(`/api/projects/${projectId}/blockers/${id}/status`, { status: 'resolved' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-pulse', projectId] });
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

  const updateProjectMutation = useMutation({
    mutationFn: (payload: { description: string }) => projectsApi.update(projectId || '', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documentation', projectId] });
      setIsEditingDescription(false);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to update project.');
    }
  });

  const handleSaveDescription = () => {
    updateProjectMutation.mutate({ description: descriptionInput });
  };

  const bulkAssignMutation = useMutation({
    mutationFn: async (memberIds: string[]) => {
      // Execute sequentially or Promise.all. We will do Promise.all
      return Promise.all(memberIds.map(id => projectsApi.addMember(projectId || '', { memberId: id })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documentation', projectId] });
      setSelectedMembersToAssign(new Set());
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to assign members.');
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => projectsApi.removeMember(projectId || '', memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documentation', projectId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to remove member.');
    }
  });

  const createRecordMutation = useMutation({
    mutationFn: (fd: FormData) => meetingRecordsApi.create(projectId || '', fd),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['meeting-records', projectId] });
      setShowRecordForm(false);
      // Reset form
      setRecordTitle('');
      setRecordDate('');
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
    mutationFn: (recordId: string) => meetingRecordsApi.delete(projectId || '', recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-records', projectId] });
    }
  });

  const toggleActionItemMutation = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      meetingRecordsApi.toggleActionItem(projectId || '', itemId, completed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-records', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-pulse', projectId] });
    }
  });

  const reanalyzeMutation = useMutation({
    mutationFn: (recordId: string) => meetingRecordsApi.reanalyze(projectId || '', recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-records', projectId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to re-analyze transcript');
    }
  });

  const updateTranscriptMutation = useMutation({
    mutationFn: ({ recordId, text }: { recordId: string; text: string }) => meetingRecordsApi.updateTranscript(projectId || '', recordId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-records', projectId] });
      setEditingTranscriptId(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to update transcript');
    }
  });

  const handleBulkAssign = () => {
    bulkAssignMutation.mutate(Array.from(selectedMembersToAssign));
  };

  const toggleMemberSelection = (id: string) => {
    const next = new Set(selectedMembersToAssign);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMembersToAssign(next);
  };

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
      const { data: { downloadUrl } } = await documentationApi.getDownloadUrl(projectId || '', fileId, actingMemberId);
      window.open(downloadUrl, "_blank");
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to generate download link.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-azure-500" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="p-8 text-center bg-[#1c1926]/80 backdrop-blur-md rounded-2xl border border-white/5">
        <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-3" />
        <h2 className="text-lg font-bold text-foreground">Failed to load Project Details</h2>
        <p className="text-xs text-white/50 mt-1">Make sure the project exists or try reloading.</p>
        <Link to="/projects" className="mt-4 inline-block text-xs font-semibold bg-azure-500 text-white px-4 py-2 rounded-xl">
          Back to Projects
        </Link>
      </div>
    );
  }



  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-white/50">
        <Link to="/projects" className="hover:text-foreground transition-colors">Projects</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-semibold">{project.name}</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground/60">Documentation</span>
      </div>

      {/* Project Banner Header */}
      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-2xl border border-white/5 p-6 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border tracking-wider",
              project.status === 'COMPLETED' ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40" :
              project.status === 'IN_PROGRESS' ? "bg-azure-950/40 text-azure-400 border-azure-800/40" :
              "bg-zinc-800/80 text-white/50 border-white/5/50"
            )}>
              {project.status.replace('_', ' ')}
            </span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider border",
              project.priority === 'CRITICAL' ? "bg-red-950/30 text-red-400 border-red-800/30" :
              project.priority === 'HIGH' ? "bg-orange-950/30 text-orange-400 border-orange-800/30" :
              project.priority === 'MEDIUM' ? "bg-yellow-950/30 text-yellow-400 border-yellow-800/30" :
              "bg-zinc-900 text-zinc-400 border-zinc-700"
            )}>
              {project.priority} PRIORITY
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">{project.name}</h1>
          {isEditingDescription ? (
            <div className="mt-3 bg-zinc-900/50 p-3 rounded-xl border border-zinc-700/50 flex flex-col gap-2 max-w-xl">
              <textarea
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                className="w-full bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none resize-none"
                rows={3}
                placeholder="Enter project description..."
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditingDescription(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white/50 hover:bg-muted/50 rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
                <button
                  onClick={handleSaveDescription}
                  disabled={updateProjectMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-azure-500 text-white hover:bg-azure-600 rounded-lg transition-colors disabled:opacity-50"
                >
                  {updateProjectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="group flex items-start gap-3 mt-2 max-w-xl">
              <div className="flex-1">
                <p className="text-sm text-white/50 leading-relaxed">
                  {project.description ? (
                    isDescriptionExpanded || project.description.length <= 200 
                      ? project.description 
                      : `${project.description.slice(0, 200)}...`
                  ) : (
                    <span className="italic opacity-60">No description provided.</span>
                  )}
                </p>
                {project.description && project.description.length > 200 && (
                  <button 
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className="text-xs font-semibold text-azure-400 hover:text-azure-300 mt-1"
                  >
                    {isDescriptionExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setDescriptionInput(project.description || '');
                  setIsEditingDescription(true);
                  setIsDescriptionExpanded(true);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-white/50 hover:text-azure-400 hover:bg-azure-500/10 rounded-md shrink-0 mt-0.5"
                title="Edit description"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Mini stats */}
        <div className="flex flex-wrap items-center gap-6 border-t md:border-t-0 md:border-l border-white/5/50 pt-4 md:pt-0 md:pl-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-white/50">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">Start Date</p>
              <p className="text-xs font-bold text-foreground">
                {new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-white/50">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">Progress</p>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-azure-500 h-full transition-all" style={{ width: `${project.progress}%` }}></div>
                </div>
                <span className="text-xs font-bold text-foreground">{project.progress}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Members Section (At-a-glance) */}
      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-2xl border border-white/5 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-azure-400" />
            Currently Assigned ({assignedMembers.length})
          </h3>
        </div>
        {assignedMembers.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {assignedMembers.map((m: any) => (
              <div key={m.member.id} className="flex items-center gap-2.5 bg-black/30 border border-white/10/50 rounded-full pr-4 pl-1.5 py-1.5 hover:bg-muted/40 transition-colors">
                {m.member.profilePictureUrl ? (
                  <img src={m.member.profilePictureUrl} alt={m.member.name} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-azure-500/10 text-azure-400 flex items-center justify-center text-[10px] font-bold">
                    {getInitials(m.member.name)}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground leading-none">{m.member.name}</span>
                  <span className="text-[10px] text-white/50 mt-0.5">{m.role || 'Member'}</span>
                </div>
                {m.role !== 'Project Manager' && (
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${m.member.name} from the project?`)) {
                        removeMemberMutation.mutate(m.member.id);
                      }
                    }}
                    disabled={removeMemberMutation.isPending}
                    className="ml-1 p-1 hover:bg-red-500/20 hover:text-red-400 text-white/50 rounded-full transition-colors disabled:opacity-50"
                    title="Remove member"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/50">No members assigned to this project yet.</p>
        )}
      </div>

      {/* Main content split */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Navigation Sidebar Tabs */}
        <div className="bg-[#1c1926] border border-white/10 rounded-2xl p-3 space-y-1.5">
          <button
            onClick={() => setActiveSection('pulse')}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeSection === 'pulse' ? "bg-azure-500/10 text-azure-400 border-l-2 border-azure-500 pl-3" : "text-white/50 hover:bg-zinc-800/40 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4" />
              <span>Project Pulse</span>
            </div>
          </button>

          <button
            onClick={() => setActiveSection('assign')}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeSection === 'assign' ? "bg-azure-500/10 text-azure-400 border-l-2 border-azure-500 pl-3" : "text-white/50 hover:bg-zinc-800/40 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4" />
              <span>Assign Members</span>
            </div>
          </button>
          <button
            onClick={() => setActiveSection('updates')}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeSection === 'updates' ? "bg-azure-500/10 text-azure-400 border-l-2 border-azure-500 pl-3" : "text-white/50 hover:bg-zinc-800/40 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <MessageCircle className="w-4 h-4" />
              <span>Project Updates</span>
            </div>
          </button>

          <button
            onClick={() => setActiveSection('records')}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeSection === 'records' ? "bg-azure-500/10 text-azure-400 border-l-2 border-azure-500 pl-3" : "text-white/50 hover:bg-zinc-800/40 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Video className="w-4 h-4" />
              <span>Transcripts & Recordings</span>
            </div>
          </button>

          <button
            onClick={() => setActiveSection('report')}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeSection === 'report' ? "bg-azure-500/10 text-azure-400 border-l-2 border-azure-500 pl-3" : "text-white/50 hover:bg-zinc-800/40 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <BarChart2 className="w-4 h-4" />
              <span>Meeting Report</span>
            </div>
          </button>

          <div className="pt-2 pb-1 px-3">
            <span className="text-[10px] font-extrabold text-white/50/60 uppercase tracking-wider">Docs</span>
          </div>

          <button
            onClick={() => setActiveSection('files')}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeSection === 'files' ? "bg-azure-500/10 text-azure-400 border-l-2 border-azure-500 pl-3" : "text-white/50 hover:bg-zinc-800/40 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4" />
              <span>Project Files</span>
            </div>
            <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded-full font-extrabold text-foreground">{files.length}</span>
          </button>

          <button
            onClick={() => setActiveSection('links')}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeSection === 'links' ? "bg-azure-500/10 text-azure-400 border-l-2 border-azure-500 pl-3" : "text-white/50 hover:bg-zinc-800/40 hover:text-foreground"
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
              activeSection === 'notes' ? "bg-azure-500/10 text-azure-400 border-l-2 border-azure-500 pl-3" : "text-white/50 hover:bg-zinc-800/40 hover:text-foreground"
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

          {/* PROJECT PULSE (Default) */}
          {activeSection === 'pulse' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Action Items Panel */}
                <div className="bg-[#1c1926] border border-white/10 rounded-2xl p-5 shadow-sm transition-all duration-200">
                  <button
                    type="button"
                    onClick={() => setIsActionItemsExpanded(!isActionItemsExpanded)}
                    className="w-full flex items-center justify-between focus:outline-none"
                  >
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                      Open Action Items
                    </h3>
                    <ChevronRight className={cn("w-4 h-4 text-white/50 transition-transform duration-200", isActionItemsExpanded && "rotate-90")} />
                  </button>
                  {isActionItemsExpanded && (
                    <div className="mt-4">
                      {isLoadingPulse ? (
                        <div className="py-4 text-center text-white/50"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
                      ) : pulseData?.openActionItems?.length > 0 ? (
                        <div className="space-y-3">
                          {pulseData.openActionItems.map((item: any) => (
                            <div key={item.id} className="p-3 bg-zinc-900/50 border border-white/5/50 rounded-xl flex items-start gap-3">
                              <button 
                                onClick={() => {
                                  toggleActionItemMutation.mutate({ itemId: item.id, completed: true });
                                }}
                                className="mt-0.5 text-white/50 hover:text-emerald-400 transition-colors"
                                title="Mark as completed"
                              >
                                <Square className="w-4 h-4" />
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-foreground leading-relaxed">{item.task}</p>
                                <div className="flex flex-wrap items-center gap-3 mt-2">
                                  <div className="flex items-center gap-1.5 bg-zinc-800/80 px-2 py-0.5 rounded text-[10px] text-white/50">
                                    {item.assignedTo?.profilePictureUrl ? (
                                      <img src={item.assignedTo.profilePictureUrl} alt="" className="w-3.5 h-3.5 rounded-full" />
                                    ) : <Users className="w-3 h-3" />}
                                    {item.assignedTo ? item.assignedTo.name : (item.originalOwnerText || 'Unassigned')}
                                  </div>
                                  {item.priority && (
                                    <span className={cn(
                                      "text-[10px] font-bold uppercase",
                                      item.priority === 'high' ? "text-red-400" :
                                      item.priority === 'medium' ? "text-amber-400" : "text-emerald-400"
                                    )}>
                                      {item.priority}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-white/50/60 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {item.meetingRecord?.meetingTitle || 'Meeting'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-white/50 italic">No open action items.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Blockers & Risks Panel */}
                <div className="bg-[#1c1926] border border-white/10 rounded-2xl p-5 shadow-sm transition-all duration-200">
                  <button
                    type="button"
                    onClick={() => setIsBlockersExpanded(!isBlockersExpanded)}
                    className="w-full flex items-center justify-between focus:outline-none"
                  >
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      Active Blockers & Risks
                    </h3>
                    <ChevronRight className={cn("w-4 h-4 text-white/50 transition-transform duration-200", isBlockersExpanded && "rotate-90")} />
                  </button>
                  {isBlockersExpanded && (
                    <div className="mt-4">
                      {isLoadingPulse ? (
                        <div className="py-4 text-center text-white/50"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
                      ) : pulseData?.openBlockers?.length > 0 ? (
                        <div className="space-y-3">
                          {pulseData.openBlockers.map((blocker: any) => (
                            <div key={blocker.id} className="p-3 bg-red-950/10 border border-red-900/30 rounded-xl flex items-start gap-3">
                              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-foreground leading-relaxed">{blocker.description}</p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-[10px] text-white/50/60">
                                    First raised: {formatDate(blocker.firstRaisedMeeting?.meetingDate || blocker.createdAt)}
                                  </span>
                                  <button
                                    onClick={() => {
                                      if (confirm('Mark this blocker as resolved?')) {
                                        resolveBlockerMutation.mutate(blocker.id);
                                      }
                                    }}
                                    className="text-[10px] font-bold text-azure-400 hover:text-azure-300"
                                  >
                                    Resolve
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-white/50 italic">No active blockers.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Key Decisions Panel */}
              <div className="bg-[#1c1926] border border-white/10 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Recent Key Decisions
                  </h3>
                </div>
                {isLoadingPulse ? (
                  <div className="py-4 text-center text-white/50"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
                ) : pulseData?.recentDecisions?.length > 0 ? (
                  <div className="space-y-3 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-800 before:to-transparent">
                    {pulseData.recentDecisions.map((decision: any) => (
                      <div key={decision.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full border border-zinc-700 bg-zinc-900 text-purple-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                        <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-4 rounded-xl border border-white/5/50 bg-zinc-900/30">
                          <p className="text-xs text-foreground font-medium mb-1.5 leading-relaxed">{decision.decisionText}</p>
                          {decision.context && (
                            <p className="text-[10px] text-white/50/80 mb-2 border-l-2 border-zinc-700 pl-2 py-0.5">{decision.context}</p>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-white/50/60">
                              {formatDate(decision.createdAt)}
                            </span>
                            {decision.decidedBy && (
                              <span className="text-[9px] font-bold bg-zinc-800 text-white/50 px-1.5 py-0.5 rounded">
                                By {decision.decidedBy.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-white/50 italic">No decisions recorded yet.</p>
                )}
              </div>

            </div>
          )}

          {/* 0. ASSIGN MEMBERS */}
          {activeSection === 'assign' && (
            <div className="bg-[#1c1926] border border-white/10 rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5/50">
                <div>
                  <h2 className="text-md font-bold text-foreground">Assign Members</h2>
                  <p className="text-[10px] text-white/50">Select team members to assign to this project.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={assignSearchQuery}
                      onChange={(e) => setAssignSearchQuery(e.target.value)}
                      className="pl-9 pr-3 py-1.5 text-xs bg-zinc-900 border border-white/5 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30 w-48"
                    />
                  </div>
                  {selectedMembersToAssign.size > 0 && (
                    <button
                      onClick={handleBulkAssign}
                      disabled={bulkAssignMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors transition-all shadow-md shadow-azure-500/10 disabled:opacity-50"
                    >
                      {bulkAssignMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                      Assign Selected ({selectedMembersToAssign.size})
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {isLoadingMembers ? (
                  <div className="py-8 text-center text-white/50"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                ) : sortedMembers.length === 0 ? (
                  <div className="py-8 text-center text-white/50 text-xs">No members found.</div>
                ) : (
                  sortedMembers.map((m: any) => {
                    const isSelected = selectedMembersToAssign.has(m.id);
                    const isCurrentlyAssigned = assignedMembers.some((am: any) => am.member.id === m.id);
                    const isProjectManager = assignedMembers.find((am: any) => am.member.id === m.id)?.role === 'Project Manager';
                    return (
                      <div
                        key={m.id}
                        onClick={() => !isCurrentlyAssigned && toggleMemberSelection(m.id)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border transition-all",
                          isCurrentlyAssigned ? "bg-muted/10 border-white/5/40 opacity-80" :
                          isSelected ? "bg-azure-500/10 border-azure-500/30 cursor-pointer" : "bg-[#1c1926]/80 backdrop-blur-md border-white/5 hover:border-white/5/80 cursor-pointer"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              if (isCurrentlyAssigned) {
                                e.stopPropagation();
                                if (isProjectManager) {
                                  alert("Cannot remove Project Manager from this list. Change the manager in the Edit Project form.");
                                  return;
                                }
                                if (confirm(`Remove ${m.name} from the project?`)) {
                                  removeMemberMutation.mutate(m.id);
                                }
                              }
                            }}
                            disabled={isProjectManager}
                            className={cn(
                              "w-4 h-4 flex items-center justify-center rounded transition-colors",
                              (isSelected || isCurrentlyAssigned) ? "text-azure-400" : "text-white/50",
                              (isCurrentlyAssigned && !isProjectManager) ? "hover:text-red-400 cursor-pointer" : "",
                              isProjectManager ? "opacity-50 cursor-not-allowed" : ""
                            )}
                          >
                            {(isSelected || isCurrentlyAssigned) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                          </button>
                          {m.profilePictureUrl ? (
                            <img src={m.profilePictureUrl} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-azure-500/10 text-azure-400 flex items-center justify-center text-xs font-bold">
                              {getInitials(m.name)}
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                              {m.name}
                              {isCurrentlyAssigned && <span className="text-[10px] bg-zinc-800 text-white/50 px-1.5 py-0.5 rounded uppercase">Assigned</span>}
                            </span>
                            <span className="text-xs text-white/50">{m.designation || 'No designation'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-white/50 font-semibold uppercase tracking-wider mb-0.5">Status</span>
                            <span className={cn(
                              "text-[10px] font-extrabold px-2 py-0.5 rounded-full border",
                              m.allocationStatus === 'ALLOCATED' ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/30" :
                              m.allocationStatus === 'BENCHED' ? "bg-amber-950/30 text-amber-400 border-amber-800/30" :
                              "bg-zinc-800 text-white/50 border-white/5"
                            )}>
                              {m.allocationStatus || 'Unknown'}
                            </span>
                          </div>

                          <div className="flex flex-col items-end w-16">
                            <span className="text-[10px] text-white/50 font-semibold uppercase tracking-wider mb-0.5">ATS</span>
                            <span className="text-xs font-bold text-foreground">
                              {m.atsScore != null ? <span className={cn((m.atsScore || 0) >= 90 ? "text-emerald-400" : (m.atsScore || 0) >= 80 ? "text-teal-400" : (m.atsScore || 0) >= 70 ? "text-azure-400" : (m.atsScore || 0) >= 60 ? "text-amber-400" : "text-red-400")}>{m.atsScore}</span> : <span className="text-white/50">No CV</span>}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 1. PROJECT UPDATES */}
          {activeSection === 'updates' && (
            <div className="bg-[#1c1926] border border-white/10 rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5/50">
                <div>
                  <h2 className="text-md font-bold text-foreground">Project Updates</h2>
                  <p className="text-[10px] text-white/50">Recent progress, blockers, and milestones for this project.</p>
                </div>
                <Link to="/project-updates" className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors transition-all shadow-md shadow-azure-500/10">
                  <Plus className="w-3.5 h-3.5" /> Post Update
                </Link>
              </div>

              <div className="space-y-4">
                {isLoadingUpdates ? (
                  <div className="py-8 text-center text-white/50"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                ) : projectUpdates.length === 0 ? (
                  <div className="py-8 text-center text-white/50 text-xs">No updates posted yet.</div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {projectUpdates.map((u: any) => {
                      const meta = getTypeMeta(u.updateType);
                      const Icon = meta.icon;
                      return (
                        <div key={u.id} className="py-4 flex gap-4 hover:bg-muted/5 transition-colors">
                          <div className="flex-shrink-0">
                            {u.member.profilePictureUrl ? (
                              <img src={u.member.profilePictureUrl} alt={u.member.name} className="w-10 h-10 rounded-full object-cover border border-white/5" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-azure-500/10 border border-azure-500/30 flex items-center justify-center">
                                <span className="text-azure-400 text-xs font-bold">{getInitials(u.member.name)}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-foreground">{u.member.name}</span>
                                {u.member.designation && <span className="text-xs text-white/50">┬╖ {u.member.designation}</span>}
                                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border', meta.badge)}>
                                  <Icon className="w-3 h-3" />
                                  {u.updateType}
                                </span>
                              </div>
                            </div>
                            <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                              {u.updateText}
                            </div>
                            {u.updateType === 'Progress' && typeof u.progressValue === 'number' && (
                              <div className="flex items-center gap-3 mt-2 bg-muted/20 p-2.5 rounded-lg border border-white/5/50 max-w-sm">
                                <div className="flex-1">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="font-semibold">Project Progress</span>
                                    <span className="font-bold text-azure-400">{u.progressValue}%</span>
                                  </div>
                                  <div className="w-full bg-zinc-800 rounded-full h-1.5">
                                    <div className="bg-azure-500 h-1.5 rounded-full" style={{ width: `${u.progressValue}%` }} />
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="text-[10px] text-white/50 mt-2">
                              {new Date(u.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. FILES SECTION */}
          {activeSection === 'files' && (
            <div className="bg-[#1c1926] border border-white/10 rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5/50">
                <div>
                  <h2 className="text-md font-bold text-foreground">Project Files & Attachments</h2>
                  <p className="text-[10px] text-white/50">Store requirements, diagrams, credentials, or specification files.</p>
                </div>
                
                <div>
                  <label className={cn(
                    "cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors transition-all shadow-md shadow-azure-500/10",
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
              <div className="space-y-3">
                {files.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed border-white/5 rounded-2xl space-y-2">
                    <FileText className="w-10 h-10 mx-auto text-white/50/55" />
                    <h3 className="text-xs font-bold text-foreground">No files attached yet</h3>
                    <p className="text-[10px] text-white/50">Attach functional guides or technical requirements docs for the team.</p>
                  </div>
                ) : (
                  files.map((file: any) => {
                    const uploader = assignedMembers.find((m: any) => m.member.id === file.uploadedBy)?.member;

                    return (
                      <div
                        key={file.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-white/5/80 hover:border-white/5 rounded-xl bg-zinc-950/10 hover:bg-zinc-950/30 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-azure-400 group-hover:scale-105 transition-transform">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground leading-snug break-all">{file.name}</p>
                            <div className="flex items-center gap-2 text-[10px] text-white/50 mt-0.5">
                              <span>{formatBytes(file.size)}</span>
                              <span>&bull;</span>
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
                                <span className="text-[10px] text-white/50/80 font-medium max-w-[80px] truncate">{uploader.name}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-white/50/75">Unknown</span>
                            )}
                            <span className="text-[10px] text-white/50/60">{formatDate(file.uploadedAt)}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDownload(file.id)}
                              disabled={!actingMemberId}
                              className="p-1.5 hover:bg-zinc-800 text-white/50 hover:text-foreground rounded-lg transition-all disabled:opacity-40"
                              title="Download/Open file"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this file?')) {
                                  deleteFileMutation.mutate(file.id);
                                }
                              }}
                              disabled={!actingMemberId || deleteFileMutation.isPending}
                              className="p-1.5 hover:bg-red-950/20 text-white/50 hover:text-red-400 rounded-lg transition-all disabled:opacity-40"
                              title="Delete file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
            <div className="bg-[#1c1926] border border-white/10 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-white/5/50">
                <div>
                  <h2 className="text-md font-bold text-foreground">External Document Links</h2>
                  <p className="text-[10px] text-white/50">Link Figma mockups, Google Drive folders, Notion wikis, or project workspaces.</p>
                </div>
                
                <button
                  onClick={openAddLink}
                  disabled={!actingMemberId}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors transition-all shadow-md shadow-azure-500/10 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Link
                </button>
              </div>

              {/* Link Creation / Editing Form Inline */}
              {showLinkForm && (
                <form onSubmit={handleLinkSubmit} className="p-4 bg-zinc-950/20 border border-white/5/80 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-foreground">
                    {editingLink ? 'Edit External Link' : 'Add External Link'}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-white/50 mb-1.5">Link Title *</label>
                      <input
                        type="text"
                        value={linkTitle}
                        onChange={(e) => setLinkTitle(e.target.value)}
                        placeholder="e.g. Figma UI Mockups"
                        className="w-full px-3 py-2 text-xs border border-white/5 rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-white/50 mb-1.5">URL *</label>
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://figma.com/..."
                        className="w-full px-3 py-2 text-xs border border-white/5 rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-white/50 mb-1.5">Short Description</label>
                    <input
                      type="text"
                      value={linkDesc}
                      onChange={(e) => setLinkDesc(e.target.value)}
                      placeholder="e.g. Current design mockups reviewed by client"
                      className="w-full px-3 py-2 text-xs border border-white/5 rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                    />
                  </div>

                  {linkError && (
                    <p className="text-[10px] text-red-400 font-semibold">{linkError}</p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={closeLinkForm}
                      className="px-3 py-1.5 text-[10px] font-bold border border-white/5 rounded-lg text-foreground hover:bg-muted/40"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saveLinkMutation.isPending}
                      className="px-4.5 py-1.5 text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors rounded-lg flex items-center gap-1.5"
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
                  <div className="md:col-span-2 p-12 text-center border-2 border-dashed border-white/5 rounded-2xl space-y-2">
                    <Link2 className="w-10 h-10 mx-auto text-white/50/55" />
                    <h3 className="text-xs font-bold text-foreground">No links added yet</h3>
                    <p className="text-[10px] text-white/50">Attach external Figma projects or shared drives.</p>
                  </div>
                ) : (
                  links.map((lnk: any) => {
                    const adder = assignedMembers.find((m: any) => m.member.id === lnk.addedBy)?.member;

                    return (
                      <div
                        key={lnk.id}
                        className="p-4 border border-white/5/80 hover:border-white/5 rounded-xl bg-zinc-950/10 hover:bg-zinc-950/30 transition-all flex flex-col justify-between gap-3 group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-extrabold text-foreground tracking-wide truncate pr-4">{lnk.title}</h3>
                            <a
                              href={lnk.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-azure-400 hover:text-azure-300 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                          {lnk.description && (
                            <p className="text-[10px] text-white/50 leading-relaxed line-clamp-2">{lnk.description}</p>
                          )}
                          <p className="text-[9px] text-azure-500/80 font-mono truncate">{lnk.url}</p>
                        </div>

                        <div className="flex items-center justify-between border-t border-white/5/40 pt-2.5">
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
                                <span className="text-[9px] text-white/50 font-semibold max-w-[80px] truncate">{adder.name}</span>
                              </div>
                            )}
                            <span className="text-[9px] text-white/50/60">{formatDate(lnk.addedAt).split(',')[0]}</span>
                          </div>

                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => openEditLink(lnk)}
                              disabled={!actingMemberId}
                              className="p-1 hover:bg-zinc-800 hover:text-foreground text-white/50 rounded-lg transition-all"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this link?')) {
                                  deleteLinkMutation.mutate(lnk.id);
                                }
                              }}
                              disabled={!actingMemberId || deleteLinkMutation.isPending}
                              className="p-1 hover:bg-red-950/20 hover:text-red-400 text-white/50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
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
            <div className="bg-[#1c1926] border border-white/10 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-white/5/50">
                <div>
                  <h2 className="text-md font-bold text-foreground">Project Notes & SOPs</h2>
                  <p className="text-[10px] text-white/50">Write standard operating procedures, guidelines, or specs inline.</p>
                </div>
                
                <button
                  onClick={openAddNote}
                  disabled={!actingMemberId}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors transition-all shadow-md shadow-azure-500/10 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Note
                </button>
              </div>

              {/* Note Editor Inline */}
              {showNoteForm && (
                <form onSubmit={handleNoteSubmit} className="p-4 bg-zinc-950/20 border border-white/5/80 rounded-2xl space-y-4">
                  <h3 className="text-xs font-bold text-foreground">
                    {editingNote ? 'Edit Note details' : 'Create Project Note'}
                  </h3>
                  
                  <div>
                    <label className="block text-[10px] font-semibold text-white/50 mb-1.5">Note Title *</label>
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="e.g. Deployment instructions"
                      className="w-full px-3 py-2 text-xs border border-white/5 rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-white/50 mb-1.5">Note Content (Markdown supported) *</label>
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Write documentation steps here..."
                      rows={8}
                      className="w-full px-3 py-2 text-xs border border-white/5 rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30 font-mono"
                    />
                  </div>

                  {noteError && (
                    <p className="text-[10px] text-red-400 font-semibold">{noteError}</p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={closeNoteForm}
                      className="px-3 py-1.5 text-[10px] font-bold border border-white/5 rounded-lg text-foreground hover:bg-muted/40"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saveNoteMutation.isPending}
                      className="px-4.5 py-1.5 text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors rounded-lg flex items-center gap-1.5"
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
                  <div className="p-12 text-center border-2 border-dashed border-white/5 rounded-2xl space-y-2">
                    <Notebook className="w-10 h-10 mx-auto text-white/50/55" />
                    <h3 className="text-xs font-bold text-foreground">No notes created yet</h3>
                    <p className="text-[10px] text-white/50">Document coding instructions, checklist releases, or environment properties.</p>
                  </div>
                ) : (
                  notes.map((note: any) => {
                    const updater = assignedMembers.find((m: any) => m.member.id === note.updatedBy)?.member;

                    return (
                      <div
                        key={note.id}
                        className="p-5 border border-white/5/80 rounded-2xl bg-zinc-950/10 hover:bg-zinc-950/20 transition-all space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-white/5/30 pb-3">
                          <div>
                            <h3 className="text-sm font-extrabold text-foreground tracking-wide leading-snug">{note.title}</h3>
                            <div className="flex items-center gap-2 text-[9px] text-white/50 mt-0.5">
                              {updater && (
                                <span className="font-semibold text-white/50/80">Updated by {updater.name}</span>
                              )}
                              <span>&bull;</span>
                              <span>{formatDate(note.updatedAt)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditNote(note)}
                              disabled={!actingMemberId}
                              className="p-1.5 hover:bg-zinc-800 hover:text-foreground text-white/50 rounded-lg transition-all"
                              title="Edit note"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this note?')) {
                                  deleteNoteMutation.mutate(note.id);
                                }
                              }}
                              disabled={!actingMemberId || deleteNoteMutation.isPending}
                              className="p-1.5 hover:bg-red-950/20 hover:text-red-400 text-white/50 rounded-lg transition-all"
                              title="Delete note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Rendering content raw with simple pre-wrap for ease of viewing */}
                        <div className="text-xs text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed bg-zinc-950/40 p-4 rounded-xl border border-white/5/30">
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
          {activeSection === 'report' && project && (
            <div className="lg:col-span-3">
              <MeetingReportView projectId={project.id} projectName={project.name} />
            </div>
          )}

          {activeSection === 'records' && (
            <ErrorBoundary>
              <div className="bg-[#1c1926] border border-white/10 rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-white/5/50">
                  <div>
                    <h2 className="text-md font-bold text-foreground">Transcripts & Recordings</h2>
                    <p className="text-[10px] text-white/50">Manage meeting recordings and their transcripts.</p>
                  </div>
                  <button
                    onClick={() => setShowRecordForm(true)}
                    disabled={!actingMemberId}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors transition-all shadow-md shadow-azure-500/10 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Meeting Record
                  </button>
                </div>

                {showRecordForm && (
                  <div className="bg-zinc-900/50 p-5 rounded-xl border border-azure-500/20 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-azure-400">Add New Record</h3>
                      <button onClick={() => setShowRecordForm(false)} className="text-white/50 hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-white/50 uppercase mb-1.5">Meeting Title</label>
                        <input
                          type="text"
                          value={recordTitle}
                          onChange={e => setRecordTitle(e.target.value)}
                          placeholder="e.g. Sprint Planning - July 10"
                          className="w-full bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-azure-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-white/50 uppercase mb-1.5">Meeting Date</label>
                        <input
                          type="date"
                          value={recordDate}
                          onChange={e => setRecordDate(e.target.value)}
                          className="w-full bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-azure-500/50"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-white/5/50">
                      <label className="block text-[10px] font-bold text-white/50 uppercase">Recording</label>
                      <div className="flex gap-2">
                        <button onClick={() => setRecordingType('none')} className={cn("px-3 py-1.5 text-xs rounded-lg border", recordingType === 'none' ? "bg-azure-500/10 border-azure-500 text-azure-400" : "bg-[#1c1926]/80 backdrop-blur-md border-white/5 text-white/50")}>None</button>
                        <button onClick={() => setRecordingType('link')} className={cn("px-3 py-1.5 text-xs rounded-lg border", recordingType === 'link' ? "bg-azure-500/10 border-azure-500 text-azure-400" : "bg-[#1c1926]/80 backdrop-blur-md border-white/5 text-white/50")}>Paste Link</button>
                        <button onClick={() => setRecordingType('file')} className={cn("px-3 py-1.5 text-xs rounded-lg border", recordingType === 'file' ? "bg-azure-500/10 border-azure-500 text-azure-400" : "bg-[#1c1926]/80 backdrop-blur-md border-white/5 text-white/50")}>Upload File</button>
                      </div>
                      {recordingType === 'link' && (
                        <input type="text" placeholder="https://zoom.us/..." value={recordingLink} onChange={e => setRecordingLink(e.target.value)} className="w-full bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-azure-500/50" />
                      )}
                      {recordingType === 'file' && (
                        <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e => setRecordingFile(e.target.files?.[0] || null)} className="w-full bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-azure-500/50" />
                      )}
                    </div>

                    <div className="space-y-3 pt-2 border-t border-white/5/50">
                      <label className="block text-[10px] font-bold text-white/50 uppercase">Transcript</label>
                      <div className="flex gap-2">
                        <button onClick={() => setTranscriptSource('none')} className={cn("px-3 py-1.5 text-xs rounded-lg border", transcriptSource === 'none' ? "bg-azure-500/10 border-azure-500 text-azure-400" : "bg-[#1c1926]/80 backdrop-blur-md border-white/5 text-white/50")}>None</button>
                        <button onClick={() => setTranscriptSource('pasted')} className={cn("px-3 py-1.5 text-xs rounded-lg border", transcriptSource === 'pasted' ? "bg-azure-500/10 border-azure-500 text-azure-400" : "bg-[#1c1926]/80 backdrop-blur-md border-white/5 text-white/50")}>Paste Text</button>
                        <button onClick={() => setTranscriptSource('uploaded_file')} className={cn("px-3 py-1.5 text-xs rounded-lg border", transcriptSource === 'uploaded_file' ? "bg-azure-500/10 border-azure-500 text-azure-400" : "bg-[#1c1926]/80 backdrop-blur-md border-white/5 text-white/50")}>Upload File</button>
                      </div>
                      {transcriptSource === 'pasted' && (
                        <textarea placeholder="Paste transcript text here..." value={transcriptPasted} onChange={e => setTranscriptPasted(e.target.value)} rows={4} className="w-full bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-azure-500/50 resize-none" />
                      )}
                      {transcriptSource === 'uploaded_file' && (
                        <input type="file" accept=".txt,.docx,.doc,.pdf" onChange={e => setTranscriptFile(e.target.files?.[0] || null)} className="w-full bg-zinc-950 border border-white/5 rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-azure-500/50" />
                      )}
                      {transcriptSource !== 'none' && (
                        <div className="p-3 bg-zinc-950 border border-white/5/40 rounded-lg flex items-start gap-2.5 mt-2">
                          <BrainCircuit className="w-4 h-4 text-azure-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">AI Attribution Tip</p>
                            <p className="text-[10px] text-white/50 leading-normal">
                              Diarized transcripts (e.g. containing speaker labels like <code className="text-azure-400 font-mono">"Speaker 1: ..."</code> or <code className="text-azure-400 font-mono">"Naved: ..."</code>) are highly recommended. Unstructured plain text transcripts may lead to lower ownership attribution accuracy.
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
                          fd.append('meetingDate', recordDate);
                          fd.append('recordingType', recordingType);
                          if (recordingType === 'link') fd.append('recordingLink', recordingLink);
                          if (recordingType === 'file' && recordingFile) fd.append('recordingFile', recordingFile);
                          
                          fd.append('transcriptSource', transcriptSource);
                          if (transcriptSource === 'pasted') fd.append('transcriptPasted', transcriptPasted);
                          if (transcriptSource === 'uploaded_file' && transcriptFile) fd.append('transcriptFile', transcriptFile);

                          createRecordMutation.mutate(fd);
                        }}
                        disabled={createRecordMutation.isPending || !recordTitle || !recordDate || (recordingType === 'none' && transcriptSource === 'none')}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-2"
                      >
                        {createRecordMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save Record
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {isLoadingRecords ? (
                    <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-white/50" /></div>
                  ) : meetingRecords.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-white/5/50 rounded-2xl">
                      <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mb-3">
                        <Video className="w-5 h-5 text-white/50" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">No records yet</p>
                      <p className="text-xs text-white/50 mt-1 text-center max-w-sm">Keep track of your meeting recordings and transcripts here.</p>
                    </div>
                  ) : (
                    meetingRecords.map((r: any) => (
                      <div key={r.id} className="group bg-[#1c1926] border border-white/10 hover:border-azure-500/30 rounded-2xl p-4 transition-all">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 w-8 h-8 rounded-full bg-azure-500/10 flex items-center justify-center text-azure-400">
                              <Video className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-foreground">{r.meetingTitle}</h4>
                              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/50 font-medium">
                                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{formatDate(r.meetingDate)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="relative">
                            <details className="group/menu">
                              <summary className="p-1.5 hover:bg-zinc-800 text-white/50 hover:text-foreground rounded-lg transition-all cursor-pointer list-none">
                                <MoreVertical className="w-4 h-4" />
                              </summary>
                              <div className="absolute right-0 top-full mt-1 w-40 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-10 overflow-hidden hidden group-open/menu:block">
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
                              </div>
                            </details>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 ml-11">
                          <div className="flex flex-wrap gap-3">
                            {r.recordingUrl && (
                              <a href={r.recordingSasUrl || r.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors text-xs font-bold transition-colors">
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
                              <p className="text-[10px] text-white/50 mt-1 text-center max-w-sm">Generating new meeting minutes. This may take a few seconds.</p>
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
                                  theme="azure"
                                  isReanalyzing={reanalyzeMutation.isPending && reanalyzeMutation.variables === r.id}
                                  onReanalyze={() => reanalyzeMutation.mutate(r.id)}
                                  onToggleActionItem={(itemId, completed) => toggleActionItemMutation.mutate({ itemId, completed })}
                                />
                              )}
                            </>
                          )}

                          {r.transcriptText && (
                            <details className="group/details bg-zinc-950 border border-white/5/50 rounded-xl overflow-hidden cursor-pointer mt-3">
                              <summary className="px-4 py-2.5 text-xs font-bold text-foreground flex items-center justify-between hover:bg-zinc-900/50">
                                <span className="flex items-center gap-2"><FileTextIcon className="w-4 h-4 text-white/50" /> View Transcript</span>
                                <ChevronRight className="w-4 h-4 text-white/50 transition-transform group-open/details:rotate-90" />
                              </summary>
                              <div className="p-4 border-t border-white/5/50 bg-zinc-950 text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto cursor-auto">
                                {editingTranscriptId === r.id ? (
                                  <div className="space-y-3">
                                    <textarea
                                      className="w-full bg-zinc-900/50 border border-white/5/50 rounded-lg p-3 text-xs focus:outline-none focus:border-azure-500/50 min-h-[200px]"
                                      value={editingTranscriptText}
                                      onChange={(e) => setEditingTranscriptText(e.target.value)}
                                    />
                                    <div className="flex items-center justify-end gap-2">
                                      <button 
                                        onClick={(e) => { e.preventDefault(); setEditingTranscriptId(null); }}
                                        className="px-3 py-1.5 text-xs font-medium bg-muted text-white/50 hover:bg-muted/80 rounded-md transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button 
                                        onClick={(e) => { e.preventDefault(); updateTranscriptMutation.mutate({ recordId: r.id, text: editingTranscriptText }); }}
                                        disabled={updateTranscriptMutation.isPending}
                                        className="px-3 py-1.5 text-xs font-medium bg-azure-600 hover:bg-azure-500 text-white rounded-md transition-colors flex items-center gap-2"
                                      >
                                        {updateTranscriptMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                        Save Changes
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex justify-end mb-2">
                                      <button
                                        onClick={(e) => { e.preventDefault(); setEditingTranscriptText(r.transcriptText); setEditingTranscriptId(r.id); }}
                                        className="text-[10px] font-medium text-azure-400 hover:text-azure-300 bg-azure-500/10 px-2 py-1 rounded transition-colors"
                                      >
                                        Edit Transcript
                                      </button>
                                    </div>
                                    {r.transcriptText}
                                  </div>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </ErrorBoundary>
          )}

        </div>
      </div>
    </div>
  );
}
