import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { filesApi, FileItem } from '@/lib/filesApi';
import { 
  FolderOpen, Search, Download, ExternalLink, FileText, 
  Award, FileType, ChevronDown, ChevronRight, Loader2, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function FilesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Certificates' | 'CVs' | 'PreSales'>('All');
  
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'By Team Member': true,
    'By Client / Opportunity': true
  });
  
  const [expandedEntities, setExpandedEntities] = useState<Record<string, boolean>>({});

  const { data: filesData, isLoading, error } = useQuery({
    queryKey: ['files'],
    queryFn: filesApi.getFiles,
  });

  const queryClient = useQueryClient();

  const sasMutation = useMutation({
    mutationFn: (vars: { blobUrl: string; container: string }) => filesApi.getSasUrl(vars.blobUrl, vars.container)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => filesApi.deleteFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || 'Failed to delete file.');
    }
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const toggleEntity = (entityId: string) => {
    setExpandedEntities(prev => ({ ...prev, [entityId]: !prev[entityId] }));
  };

  const handleAction = (file: FileItem, action: 'view' | 'download') => {
    sasMutation.mutate({ blobUrl: file.blobUrl, container: file.container }, {
      onSuccess: (res) => {
        if (action === 'view') {
          window.open(res.data.sasUrl, '_blank');
        } else {
          const a = document.createElement('a');
          a.href = res.data.sasUrl;
          a.download = file.fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      },
      onError: (err: any) => {
        alert(err?.response?.data?.error || 'Failed to access file.');
      }
    });
  };

  const getFileIcon = (category: string) => {
    switch (category) {
      case 'Certificate': return <Award className="w-4 h-4 text-emerald-400" />;
      case 'CV': return <FileType className="w-4 h-4 text-azure-400" />;
      case 'GTM Document': return <FileText className="w-4 h-4 text-purple-400" />;
      default: return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const isSearching = searchTerm.trim().length > 0;

  // Filtered Flat List for Search View
  const filteredFlatFiles = useMemo(() => {
    if (!filesData?.data.flat) return [];
    
    return filesData.data.flat.filter(file => {
      // Tab filter
      if (activeTab === 'Certificates' && file.category !== 'Certificate') return false;
      if (activeTab === 'CVs' && file.category !== 'CV') return false;
      if (activeTab === 'PreSales' && file.category !== 'GTM Document') return false;

      // Search filter
      const search = searchTerm.toLowerCase();
      if (
        search &&
        !file.fileName.toLowerCase().includes(search) &&
        !file.entityName.toLowerCase().includes(search) &&
        !file.category.toLowerCase().includes(search)
      ) {
        return false;
      }

      return true;
    });
  }, [filesData, searchTerm, activeTab]);

  // Dynamically compute the grouped structure from the already-filtered flat files
  const filteredGrouped = useMemo(() => {
    const grouped = {
      'By Team Member': {} as Record<string, any[]>,
      'By Client / Opportunity': {} as Record<string, any[]>
    };
    
    filteredFlatFiles.forEach(file => {
      const group = file.entityGroup as 'By Team Member' | 'By Client / Opportunity';
      if (!grouped[group]) return;
      if (!grouped[group][file.entityName]) {
        grouped[group][file.entityName] = [];
      }
      grouped[group][file.entityName].push(file);
    });
    
    return grouped;
  }, [filteredFlatFiles]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
      {/* Header */}
      <header className="flex-shrink-0 px-8 py-6 border-b border-border bg-card/50 backdrop-blur-sm z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-azure-500/10 rounded-xl border border-azure-500/20">
              <FolderOpen className="w-5 h-5 text-azure-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Files</h1>
              <p className="text-sm text-muted-foreground">All documents across certifications, CVs, and GTM records in one place.</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Controls */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            {/* Tabs */}
            <div className="flex p-1 bg-muted/20 border border-border rounded-xl">
              {['All', 'Certificates', 'CVs', 'PreSales'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={cn(
                    "px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200",
                    activeTab === tab 
                      ? "bg-card border-border shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search by file name, person, or client..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-muted/10 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-azure-500/50 transition-all placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-azure-500" />
            </div>
          ) : error ? (
            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              Failed to load files. Please try again.
            </div>
          ) : isSearching ? (
            /* FLAT SEARCH VIEW */
            <div className="bg-card border border-border rounded-xl overflow-hidden animate-fade-in shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">File Name</th>
                      <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Category</th>
                      <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Associated With</th>
                      <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Upload Date</th>
                      <th className="px-5 py-3 text-xs font-semibold text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredFlatFiles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">
                          No files found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredFlatFiles.map(file => (
                        <tr key={file.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-5 py-3 text-sm font-medium text-foreground flex items-center gap-2">
                            {getFileIcon(file.category)}
                            {file.fileName}
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">{file.category}</td>
                          <td className="px-5 py-3 text-xs text-foreground/80">{file.entityName}</td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">{format(new Date(file.uploadDate), 'MMM d, yyyy')}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => handleAction(file, 'view')}
                                className="p-1.5 text-muted-foreground hover:text-azure-400 hover:bg-azure-500/10 rounded-lg transition-colors"
                                title="View in new tab"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleAction(file, 'download')}
                                className="p-1.5 text-muted-foreground hover:text-azure-400 hover:bg-azure-500/10 rounded-lg transition-colors"
                                title="Download file"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(file.id)}
                                disabled={deleteMutation.isPending}
                                className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40"
                                title="Delete file"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* FOLDER HIERARCHY VIEW */
            <div className="space-y-6 animate-fade-in">
              {['By Team Member', 'By Client / Opportunity'].map((groupName) => {
                const groupData = filteredGrouped[groupName as 'By Team Member' | 'By Client / Opportunity'];
                if (!groupData || Object.keys(groupData).length === 0) return null;
                
                const isGroupExpanded = expandedGroups[groupName];

                return (
                  <div key={groupName} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                    {/* Top level group header */}
                    <button 
                      onClick={() => toggleGroup(groupName)}
                      className="w-full flex items-center justify-between px-6 py-4 bg-muted/10 hover:bg-muted/20 transition-colors border-b border-border"
                    >
                      <div className="flex items-center gap-2">
                        {isGroupExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                        <h2 className="text-sm font-bold text-foreground">{groupName}</h2>
                        <span className="px-2 py-0.5 rounded-full bg-border text-[10px] font-semibold text-muted-foreground">
                          {Object.keys(groupData).length} folders
                        </span>
                      </div>
                    </button>

                    {/* Entities list */}
                    {isGroupExpanded && (
                      <div className="divide-y divide-border">
                        {Object.entries(groupData).map(([entityName, entityFiles]) => {
                          const entityId = `${groupName}-${entityName}`;
                          const isEntityExpanded = expandedEntities[entityId];

                          return (
                            <div key={entityId} className="bg-card">
                              {/* Entity Header (Folder) */}
                              <button 
                                onClick={() => toggleEntity(entityId)}
                                className="w-full flex items-center justify-between px-8 py-3 hover:bg-muted/5 transition-colors group"
                              >
                                <div className="flex items-center gap-2.5">
                                  {isEntityExpanded ? (
                                    <FolderOpen className="w-4 h-4 text-azure-400" />
                                  ) : (
                                    <FolderOpen className="w-4 h-4 text-muted-foreground group-hover:text-azure-400 transition-colors" />
                                  )}
                                  <span className="text-sm font-semibold text-foreground/90">{entityName}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">{entityFiles.length} files</span>
                              </button>

                              {/* Files inside Entity */}
                              {isEntityExpanded && (
                                <div className="bg-muted/5 border-t border-border px-8 py-2">
                                  <ul className="divide-y divide-border/50">
                                    {entityFiles.map((file) => (
                                      <li key={file.id} className="py-2.5 flex items-center justify-between group/file">
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center">
                                            {getFileIcon(file.category)}
                                          </div>
                                          <div>
                                            <p className="text-sm font-medium text-foreground">{file.fileName}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                {file.category}
                                              </span>
                                              <span className="w-1 h-1 rounded-full bg-border"></span>
                                              <span className="text-[10px] text-muted-foreground">
                                                {format(new Date(file.uploadDate), 'MMM d, yyyy')}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity">
                                          <button 
                                            onClick={() => handleAction(file, 'view')}
                                            className="px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/50 border border-transparent hover:border-border rounded-lg transition-all"
                                          >
                                            View
                                          </button>
                                          <button 
                                            onClick={() => handleAction(file, 'download')}
                                            className="px-3 py-1.5 text-xs font-semibold bg-azure-500 hover:bg-azure-600 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                            Download
                                          </button>
                                          <button 
                                            onClick={() => handleDelete(file.id)}
                                            disabled={deleteMutation.isPending}
                                            className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-40"
                                            title="Delete file"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
