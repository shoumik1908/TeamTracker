import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Trash2, 
  UploadCloud, 
  Activity, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { fetchLogs, ActivityLog } from '../lib/logsApi';
import { formatDistanceToNow } from 'date-fns';

const TABS = ['All', 'Certifications', 'CVs', 'PreSales'];

export default function LogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const observer = useRef<IntersectionObserver | null>(null);

  const loadLogs = async (pageNum: number, currentLogs: ActivityLog[], isNewSearch = false) => {
    try {
      if (isNewSearch) setLoading(true);
      const res = await fetchLogs(pageNum, 50, category, search);
      
      if (isNewSearch) {
        setLogs(res.data);
      } else {
        setLogs([...currentLogs, ...res.data]);
      }
      
      setHasMore(pageNum < res.pagination.totalPages);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadLogs(1, [], true);
  }, [category, search]);

  const lastLogElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => {
          const next = prevPage + 1;
          loadLogs(next, logs, false);
          return next;
        });
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, hasMore, logs]);

  const getIconForAction = (action: string, cat: string) => {
    if (action === 'DELETE') return <Trash2 className="w-5 h-5 text-red-500" />;
    if (action === 'UPLOAD') return <UploadCloud className="w-5 h-5 text-blue-500" />;
    if (cat === 'PreSales') return <Activity className="w-5 h-5 text-purple-500" />;
    return <FileText className="w-5 h-5 text-gray-400" />;
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-500" />
            Activity Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            Recent activity across the app. Entries automatically expire after 7 days.
          </p>
        </div>
        
        <div className="relative">
          <Search className="w-5 h-5 text-muted-foreground absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search activity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 bg-background border border-input rounded-lg text-foreground focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full md:w-64"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setCategory(tab)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${category === tab 
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Log Feed */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        {error ? (
          <div className="p-12 text-center text-red-500 flex flex-col items-center">
            <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
            <p>{error}</p>
          </div>
        ) : logs.length === 0 && !loading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
            <History className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium text-foreground">No activity found</p>
            <p className="text-sm">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log, index) => {
              const isLast = index === logs.length - 1;
              return (
                <div 
                  key={log.id} 
                  ref={isLast ? lastLogElementRef : null}
                  className="p-4 hover:bg-muted/50 transition-colors flex items-start gap-4"
                >
                  <div className="p-2 bg-muted rounded-full border border-border/50 mt-1">
                    {getIconForAction(log.action, log.category)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-medium">
                      {log.details}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        {log.category}
                      </span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</span>
                      {log.performedBy && (
                        <>
                          <span>•</span>
                          <span>by {log.performedBy}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {loading && (
              <div className="p-6 text-center text-muted-foreground">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent mx-auto"></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
