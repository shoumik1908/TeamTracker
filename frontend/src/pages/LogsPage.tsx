import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  History, 
  Search, 
  Trash2, 
  UploadCloud, 
  Activity, 
  FileText,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { fetchLogs, ActivityLog } from '../lib/logsApi';
import { formatDistanceToNow } from 'date-fns';

const TABS = ['All', 'TeamMember', 'Project', 'Certification', 'Notification', 'Task', 'User', 'PreSalesOpportunity'];

export default function LogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  
  // TT-145: the page value was discarded because the only reader was inside the setPage
  // updater. Now that the fetch happens outside the updater, the value is needed.
  const [page, setPage] = useState(1);
  
  const [hasMore, setHasMore] = useState(true);
  
  const observer = useRef<IntersectionObserver | null>(null);
  // Set synchronously, unlike the `loading` state below, which loadLogs only raises for a
  // fresh search. Without it the sentinel stays in view while a page is in flight and the
  // observer fires again and again: one scroll requested pages 2 through 9, six of them
  // past the end, and their responses came back interleaved. Appends are order-dependent,
  // so that ordering was luck rather than design.
  const inFlight = useRef(false);

  const loadLogs = async (pageNum: number, isNewSearch = false) => {
    inFlight.current = true;
    try {
      if (isNewSearch) setLoading(true);
      const res = await fetchLogs(pageNum, 50, category, debouncedSearch);

      // TT-143: error was set on failure and never cleared anywhere, and the render shows
      // the error panel instead of the feed whenever it is truthy. One timed-out request
      // — easy to provoke while typing — hid the activity log until the page was
      // remounted, even though every request after it succeeded.
      setError('');

      if (isNewSearch) {
        setLogs(res.data);
      } else {
        // The appended page has to be computed from the list as it is when the update is
        // applied, not as it was when the observer callback was created. The sentinel can
        // stay in view long enough to fire twice before React re-renders — which is the
        // normal case at the end of a short list — and the second call then appended its
        // page onto the pre-previous array, dropping the page in between. The symptom was
        // a contiguous block of fifty rows silently missing from the middle of the feed.
        setLogs(prev => [...prev, ...res.data]);
      }
      
      setHasMore(pageNum < res.pagination.totalPages);
    } catch (err: any) {
      setError(err.message);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  // TT-144: the effect below depended on `search`, which is updated on every keystroke, so
  // typing a ten-character query fired ten full log queries at a page size of fifty, with
  // nothing cancelling the earlier ones — the list could settle on results that did not
  // match what was in the box.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadLogs(1, true);
  }, [category, debouncedSearch]);

  const lastLogElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      // inFlight must gate the page advance as well as the fetch: guarding only the fetch
      // let `page` run ahead of what had actually been loaded, and the pages in between
      // were never requested at all.
      if (entries[0].isIntersecting && hasMore && !inFlight.current) {
        // TT-145: this used to call loadLogs inside the setPage updater. React may invoke
        // an updater more than once — it does so routinely under StrictMode — so the same
        // page could be fetched and appended twice, giving duplicated rows and duplicate
        // React keys. The updater is pure now and the fetch happens beside it.
        const next = page + 1;
        setPage(next);
        loadLogs(next, false);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, hasMore, page]);

  const getIconForAction = (action: string, _cat: string) => {
    if (action === 'DELETE' || action === 'DELETEMANY') return <Trash2 className="w-5 h-5 text-red-500" />;
    if (action === 'CREATE' || action === 'CREATEMANY') return <UploadCloud className="w-5 h-5 text-green-500" />;
    if (action === 'UPDATE' || action === 'UPDATEMANY' || action === 'UPSERT') return <Activity className="w-5 h-5 text-blue-500" />;
    if (action === 'UPLOAD') return <UploadCloud className="w-5 h-5 text-blue-500" />;
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
          <p className="text-white/50 mt-1">
            Recent activity across the app. Entries automatically expire after 7 days.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-5 h-5 text-white/50 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search activity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full md:w-64 outline-none placeholder:text-white/40"
            />
          </div>
          <button 
            onClick={() => { setPage(1); setHasMore(true); loadLogs(1, true); }}
            className="p-2 bg-black/30 border border-white/10 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/5">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setCategory(tab)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${category === tab 
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-white/50 hover:text-foreground hover:border-white/5'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Log Feed */}
      <div className="bg-[#1c1926]/80 backdrop-blur-md rounded-xl shadow-sm border border-white/5 overflow-hidden">
        {error ? (
          <div className="p-12 text-center text-red-500 flex flex-col items-center">
            <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
            <p>{error}</p>
          </div>
        ) : logs.length === 0 && !loading ? (
          <div className="p-12 text-center text-white/50 flex flex-col items-center">
            <History className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium text-foreground">No activity found</p>
            <p className="text-sm">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {logs.map((log, index) => {
              const isLast = index === logs.length - 1;
              return (
                <div 
                  key={log.id} 
                  ref={isLast ? lastLogElementRef : null}
                  className="p-4 hover:bg-white/5 transition-colors flex items-start gap-4"
                >
                  <div className="p-2 bg-white/5 rounded-full border border-white/5 mt-1">
                    {getIconForAction(log.action, log.category)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">
                      {log.details}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
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
              <div className="p-6 text-center text-white/50">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-500 border-t-transparent mx-auto"></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
