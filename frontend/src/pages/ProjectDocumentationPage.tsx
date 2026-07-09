import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentationApi } from '@/lib/api';
import {
  FileText, Link2, Notebook, Plus, Trash2, ExternalLink,
  Pencil, Calendar, TrendingUp, AlertCircle, Loader2,
  FileDown, ChevronRight, UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function ProjectDocumentationPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState<'files' | 'links' | 'notes'>('files');
  const [actingMemberId, setActingMemberId] = useState<string>('');
  
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

  // Default the acting member to the first assigned member once loaded
  useEffect(() => {
    if (project?.members?.length > 0 && !actingMemberId) {
      setActingMemberId(project.members[0].member.id);
    }
  }, [project, actingMemberId]);

  // Mutations
  const uploadFileMutation = useMutation({
    mutationFn: (formData: FormData) => documentationApi.uploadFile(projectId || '', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documentation', projectId] });
      setUploadError(null);
    },
    onError: (err: any) => {
      setUploadError(err.response?.data?.error || 'Failed to upload file.');
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

  // Handle File Upload Change
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append('file', file);
    fd.append('uploadedBy', actingMemberId);

    setUploadError(null);
    uploadFileMutation.mutate(fd);
    
    // Clear selection
    e.target.value = '';
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
      <div className="p-8 text-center bg-card rounded-2xl border border-border">
        <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-3" />
        <h2 className="text-lg font-bold text-foreground">Failed to load Project Details</h2>
        <p className="text-xs text-muted-foreground mt-1">Make sure the project exists or try reloading.</p>
        <Link to="/projects" className="mt-4 inline-block text-xs font-semibold bg-azure-500 text-white px-4 py-2 rounded-xl">
          Back to Projects
        </Link>
      </div>
    );
  }

  const projectManager = project?.manager;
  const projectMembersList = project?.members || [];

  // Combine manager and members list
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

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Link to="/projects" className="hover:text-foreground transition-colors">Projects</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-semibold">{project.name}</span>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground/60">Documentation</span>
      </div>

      {/* Project Banner Header */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border tracking-wider",
              project.status === 'COMPLETED' ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40" :
              project.status === 'IN_PROGRESS' ? "bg-azure-950/40 text-azure-400 border-azure-800/40" :
              "bg-zinc-800/80 text-muted-foreground border-border/50"
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
          <p className="text-xs text-muted-foreground max-w-xl">{project.description}</p>
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
                {new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                  <div className="bg-azure-500 h-full transition-all" style={{ width: `${project.progress}%` }}></div>
                </div>
                <span className="text-xs font-bold text-foreground">{project.progress}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Access control box / Selector */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-azure-500/10 flex items-center justify-center text-azure-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground">Project-Scoped Member Context</h3>
            <p className="text-[10px] text-muted-foreground">Modify operations are allowed only for team members assigned to this project.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap">Acting as:</span>
          <select
            value={actingMemberId}
            onChange={(e) => setActingMemberId(e.target.value)}
            className="bg-zinc-900 border border-border rounded-xl px-3.5 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/40 w-full md:w-56"
          >
            {assignedMembers.map((m: any) => (
              <option key={m.member.id} value={m.member.id}>
                {m.member.name} ({m.role || 'Member'})
              </option>
            ))}
            {assignedMembers.length === 0 && (
              <option value="">No members assigned</option>
            )}
          </select>
        </div>
      </div>

      {assignedMembers.length === 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-950/20 border border-amber-800/30 text-amber-400 rounded-2xl text-xs animate-fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-foreground">No Members Assigned to this Project</p>
            <p className="text-muted-foreground leading-relaxed">
              To upload documents, attach links, or edit notes, you need to assign at least one team member or a project manager. 
              You can configure assignments under the team settings on the <Link to="/projects" className="underline text-azure-400 hover:text-azure-300 font-bold transition-all">Projects Dashboard</Link>.
            </p>
          </div>
        </div>
      )}

      {/* Main content split */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* Navigation Sidebar Tabs */}
        <div className="bg-card border border-border rounded-2xl p-3 space-y-1.5">
          <button
            onClick={() => setActiveSection('files')}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeSection === 'files' ? "bg-azure-500/10 text-azure-400 border-l-2 border-azure-500 pl-3" : "text-muted-foreground hover:bg-zinc-800/40 hover:text-foreground"
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
              activeSection === 'links' ? "bg-azure-500/10 text-azure-400 border-l-2 border-azure-500 pl-3" : "text-muted-foreground hover:bg-zinc-800/40 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Link2 className="w-4 h-4" />
              <span>External Docs & Links</span>
            </div>
            <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded-full font-extrabold text-foreground">{links.length}</span>
          </button>

          <button
            onClick={() => setActiveSection('notes')}
            className={cn(
              "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeSection === 'notes' ? "bg-azure-500/10 text-azure-400 border-l-2 border-azure-500 pl-3" : "text-muted-foreground hover:bg-zinc-800/40 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Notebook className="w-4 h-4" />
              <span>Project SOP Notes</span>
            </div>
            <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded-full font-extrabold text-foreground">{notes.length}</span>
          </button>
        </div>

        {/* Section Contents */}
        <div className="lg:col-span-3 space-y-6">

          {/* 1. FILES SECTION */}
          {activeSection === 'files' && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
                <div>
                  <h2 className="text-md font-bold text-foreground">Project Files & Attachments</h2>
                  <p className="text-[10px] text-muted-foreground">Store requirements, diagrams, credentials, or specification files.</p>
                </div>
                
                <div>
                  <label className={cn(
                    "cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-azure-500 hover:bg-azure-600 text-white transition-all shadow-md shadow-azure-500/10",
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
                          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-border flex items-center justify-center text-azure-400 group-hover:scale-105 transition-transform">
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
                            <a
                              href={`${(import.meta as any).env.VITE_API_URL || 'http://localhost:3001/api'}/projects/${projectId}/documentation/files/${file.id}/view`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-zinc-800 text-muted-foreground hover:text-foreground rounded-lg transition-all"
                              title="Download/Open file"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </a>
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
                  <p className="text-[10px] text-muted-foreground">Link Figma mockups, Google Drive folders, Notion wikis, or project workspaces.</p>
                </div>
                
                <button
                  onClick={openAddLink}
                  disabled={!actingMemberId}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-azure-500 hover:bg-azure-600 text-white transition-all shadow-md shadow-azure-500/10 disabled:opacity-50"
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
                        className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1.5">URL *</label>
                      <input
                        type="url"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://figma.com/..."
                        className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30"
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
                      className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30"
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
                      className="px-4.5 py-1.5 text-[10px] font-bold bg-azure-500 hover:bg-azure-600 text-white rounded-lg flex items-center gap-1.5"
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
                              className="text-azure-400 hover:text-azure-300 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                          {lnk.description && (
                            <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{lnk.description}</p>
                          )}
                          <p className="text-[9px] text-azure-500/80 font-mono truncate">{lnk.url}</p>
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-azure-500 hover:bg-azure-600 text-white transition-all shadow-md shadow-azure-500/10 disabled:opacity-50"
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
                      className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1.5">Note Content (Markdown supported) *</label>
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Write documentation steps here..."
                      rows={8}
                      className="w-full px-3 py-2 text-xs border border-border rounded-xl bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-azure-500/30 font-mono"
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
                      className="px-4.5 py-1.5 text-[10px] font-bold bg-azure-500 hover:bg-azure-600 text-white rounded-lg flex items-center gap-1.5"
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

        </div>
      </div>
    </div>
  );
}
