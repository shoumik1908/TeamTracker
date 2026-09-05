import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, CalendarDays, Download, FileText, FileUp, Layers3, Loader2, Plus, RefreshCw, Sparkles, SquareCheckBig, Trash2, Upload, Users, X } from 'lucide-react';
import { coeApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import LearningProjects from '@/components/coe/LearningProjects';

type Track = 'DATABRICKS' | 'FABRIC' | 'FDE';
type TicketStatus = 'BACKLOG' | 'IN_PROGRESS' | 'DONE';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH';

type Resource = {
  id: string; track: Track; title: string; description?: string | null; fileName: string;
  fileMimeType?: string | null; createdAt: string; uploadedBy: { id: string; name: string };
};
type Ticket = {
  id: string; ticketNumber: number; track: Track; title: string; description?: string | null;
  status: TicketStatus; priority: TicketPriority; createdById: string; updatedAt: string;
  createdBy: { id: string; name: string; teamMemberId?: string | null };
  member?: { id: string; name: string; designation?: string | null; profilePictureUrl?: string | null } | null;
};
type KnowledgeSession = {
  id: string; topic: string; description?: string | null; scheduledAt: string; durationMinutes: number;
  status: 'SCHEDULED' | 'ENDED' | 'CANCELLED'; organizerId: string; endedAt?: string | null; attendanceSummary?: string | null;
  transcriptFileName?: string | null; transcriptSummary?: string | null; updatedAt: string;
  organizer: { id: string; name: string; teamMemberId?: string | null };
  attendance: Array<{ id: string; memberId: string; attended: boolean; notes?: string | null; member: { id: string; name: string; designation?: string | null } }>;
};

const TRACKS: Array<{ id: Track; name: string; description: string; logo: string; className: string }> = [
  { id: 'DATABRICKS', name: 'Databricks', description: 'Lakehouse, data and AI', logo: '/coe-databricks.svg', className: 'border-red-200 bg-red-50 text-red-700' },
  { id: 'FABRIC', name: 'Microsoft Fabric', description: 'Unified analytics platform', logo: '/coe-fabric.svg', className: 'border-violet-200 bg-violet-50 text-violet-700' },
  { id: 'FDE', name: 'FDE', description: 'Forward Deployed Engineer', logo: '/coe-fde.svg', className: 'border-primary/25 bg-primary/5 text-primary' },
];

const STATUS_META: Record<TicketStatus, { label: string; className: string }> = {
  BACKLOG: { label: 'Backlog', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  IN_PROGRESS: { label: 'In progress', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  DONE: { label: 'Done', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};
const PRIORITY_META: Record<TicketPriority, string> = {
  LOW: 'text-slate-500', MEDIUM: 'text-blue-700', HIGH: 'text-rose-700',
};

function trackInfo(track: Track) { return TRACKS.find(item => item.id === track)!; }
function formatDate(value: string) { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-sm">
    <div className={cn('w-full overflow-hidden rounded-2xl border border-border bg-card shadow-2xl', wide ? 'max-w-2xl' : 'max-w-lg')}>
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      {children}
    </div>
  </div>;
}

export default function CoePage() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = hasPermission('manageTeam');
  const [track, setTrack] = useState<Track>('DATABRICKS');
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [activeView, setActiveView] = useState<'learning' | 'projects' | 'sessions'>('learning');
  const [error, setError] = useState('');

  const resourcesQuery = useQuery<{ resources: Resource[] }>({
    queryKey: ['coe-resources'], queryFn: () => coeApi.resources().then(r => r.data), staleTime: 30000,
  });
  const ticketsQuery = useQuery<{ tickets: Ticket[] }>({
    queryKey: ['coe-tickets'], queryFn: () => coeApi.tickets().then(r => r.data), staleTime: 15000,
  });
  const resources = resourcesQuery.data?.resources ?? [];
  const tickets = ticketsQuery.data?.tickets ?? [];
  const selectedResources = resources.filter(resource => resource.track === track);
  const visibleTickets = tickets.filter(ticket => isAdmin || ticket.createdById === user?.id || ticket.member?.id === user?.teamMemberId);
  const selectedTickets = visibleTickets.filter(ticket => ticket.track === track);
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['coe-resources'] }); queryClient.invalidateQueries({ queryKey: ['coe-tickets'] }); };

  const updateTicket = useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => coeApi.updateTicket(id, data), onSuccess: refresh, onError: (e: Error) => setError(e.message) });
  const deleteTicket = useMutation({ mutationFn: (id: string) => coeApi.deleteTicket(id), onSuccess: refresh, onError: (e: Error) => setError(e.message) });
  const deleteResource = useMutation({ mutationFn: (id: string) => coeApi.deleteResource(id), onSuccess: refresh, onError: (e: Error) => setError(e.message) });

  const counts = useMemo(() => Object.fromEntries(TRACKS.map(item => [item.id, visibleTickets.filter(ticket => ticket.track === item.id).length])) as Record<Track, number>, [visibleTickets]);
  const canEdit = (ticket: Ticket) => isAdmin || ticket.createdById === user?.id || ticket.member?.id === user?.teamMemberId;

  async function downloadResource(resource: Resource) {
    setError('');
    try {
      const { downloadUrl } = (await coeApi.getResourceDownload(resource.id)).data;
      window.open(downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to prepare this download'); }
  }

  return <div className="mx-auto max-w-[1500px] space-y-6 pb-8">
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary"><Layers3 className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.16em]">Centre of Excellence</span></div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Build expertise in the open.</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Learning tracks, shared resources and lightweight tickets for Databricks, Microsoft Fabric and FDE.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeView === 'learning' && <>{isAdmin && <button onClick={() => { setError(''); setShowResourceModal(true); }} className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"><Upload className="h-4 w-4" /> Upload learning track</button>}<button onClick={() => { setError(''); setShowTicketModal(true); }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"><Plus className="h-4 w-4" /> New learning ticket</button></>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 border-t border-border px-4 pt-3"><button onClick={() => setActiveView('learning')} className={cn('rounded-lg px-3 py-2 text-sm font-semibold', activeView === 'learning' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary')}>Learning board</button><button onClick={() => setActiveView('projects')} className={cn('rounded-lg px-3 py-2 text-sm font-semibold', activeView === 'projects' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary')}>Learning Projects</button><button onClick={() => setActiveView('sessions')} className={cn('rounded-lg px-3 py-2 text-sm font-semibold', activeView === 'sessions' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary')}>Knowledge Sharing Sessions</button></div>
      {activeView === 'learning' && <div className="grid border-t border-border md:grid-cols-3">
        {TRACKS.map(item => <button key={item.id} onClick={() => setTrack(item.id)} className={cn('flex items-center gap-3 border-b border-border p-4 text-left transition-colors last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0', track === item.id ? 'bg-primary/[0.04]' : 'hover:bg-secondary/60')}>
          <img src={item.logo} alt="" className="h-10 w-10 rounded-lg object-contain" />
          <span className="min-w-0 flex-1"><span className="block font-semibold text-foreground">{item.name}</span><span className="block truncate text-xs text-muted-foreground">{item.description}</span></span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">{counts[item.id]}</span>
        </button>)}
      </div>}
    </section>

    {error && <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><span>{error}</span><button onClick={() => setError('')}><X className="h-4 w-4" /></button></div>}

    {activeView === 'learning' ? <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1"><div><h2 className="font-semibold text-foreground">{trackInfo(track).name} learning board</h2><p className="text-sm text-muted-foreground">{isAdmin ? 'Everyone’s learning work, grouped like a Linear board.' : 'Your learning work, grouped like a Linear board.'}</p></div><span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', trackInfo(track).className)}>{selectedTickets.length} tickets</span></div>
        {ticketsQuery.isLoading ? <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading tickets…</div> :
          <div className="grid gap-4 lg:grid-cols-3">{(['BACKLOG', 'IN_PROGRESS', 'DONE'] as TicketStatus[]).map(status => {
            const columnTickets = selectedTickets.filter(ticket => ticket.status === status);
            return <div key={status} className="min-h-[270px] rounded-xl border border-border bg-secondary/35 p-3">
              <div className="mb-3 flex items-center justify-between px-1"><span className="text-sm font-semibold text-foreground">{STATUS_META[status].label}</span><span className="text-xs text-muted-foreground">{columnTickets.length}</span></div>
              <div className="space-y-3">{columnTickets.map(ticket => <article key={ticket.id} onClick={() => setDetailTicket(ticket)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setDetailTicket(ticket); }} role="button" tabIndex={0} className="cursor-pointer rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/35">
                <div className="mb-2 flex items-start justify-between gap-2"><span className="text-[11px] font-semibold tracking-wide text-muted-foreground">COE-{ticket.ticketNumber}</span>{canEdit(ticket) && <button onClick={event => { event.stopPropagation(); if (confirm('Delete this learning ticket?')) deleteTicket.mutate(ticket.id); }} className="text-muted-foreground hover:text-rose-600" aria-label="Delete ticket"><Trash2 className="h-3.5 w-3.5" /></button>}</div>
                <h3 className="line-clamp-2 break-all text-sm font-semibold leading-5 text-foreground" title={ticket.title}>{ticket.title}</h3>
                {ticket.description && <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{ticket.description}</p>}
                <div className="mt-3 flex items-center justify-between gap-2"><span className={cn('text-[11px] font-semibold', PRIORITY_META[ticket.priority])}>{ticket.priority}</span><span className="truncate text-xs text-muted-foreground">{ticket.member?.name || ticket.createdBy.name}</span></div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2"><span className="text-[11px] text-muted-foreground">Updated {formatDate(ticket.updatedAt)}</span>{canEdit(ticket) && <select aria-label="Ticket status" value={ticket.status} onClick={event => event.stopPropagation()} onChange={event => { event.stopPropagation(); updateTicket.mutate({ id: ticket.id, data: { status: event.target.value } }); }} className="rounded-md border border-border bg-card px-1.5 py-1 text-[11px] text-foreground outline-none"><option value="BACKLOG">Backlog</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select>}</div>
              </article>)}{columnTickets.length === 0 && <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">No tickets yet</div>}</div>
            </div>;
          })}</div>}
      </div>

      <aside className="h-fit rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /><h2 className="font-semibold text-foreground">Learning track</h2></div>
        <p className="mb-4 text-sm text-muted-foreground">Resources for {trackInfo(track).name}. {isAdmin ? 'Upload a PDF, spreadsheet, presentation, image or other learning material.' : 'Download material shared by your COE leads.'}</p>
        {resourcesQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <div className="space-y-3">{selectedResources.map(resource => <div key={resource.id} className="rounded-xl border border-border p-3">
          <div className="flex gap-2"><div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground" title={resource.title}>{resource.title}</p><p className="truncate text-xs text-muted-foreground" title={resource.fileName}>{resource.fileName}</p></div>{isAdmin && <button onClick={() => { if (confirm('Delete this learning resource?')) deleteResource.mutate(resource.id); }} className="text-muted-foreground hover:text-rose-600" aria-label="Delete resource"><Trash2 className="h-4 w-4" /></button>}</div>
          {resource.description && <p className="mt-2 text-xs leading-5 text-muted-foreground">{resource.description}</p>}
          <div className="mt-3 flex items-center justify-between"><span className="text-[11px] text-muted-foreground">{resource.uploadedBy.name} · {formatDate(resource.createdAt)}</span><button onClick={() => downloadResource(resource)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Download className="h-3.5 w-3.5" /> Download</button></div>
        </div>)}{selectedResources.length === 0 && <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">No learning resources have been shared yet.</div>}</div>}
      </aside>
    </section> : activeView === 'projects' ? <LearningProjects /> : <KnowledgeSharingSessions />}

    {showResourceModal && <ResourceModal defaultTrack={track} onClose={() => setShowResourceModal(false)} onSuccess={() => { setShowResourceModal(false); refresh(); }} onError={setError} />}
    {showTicketModal && <TicketModal defaultTrack={track} onClose={() => setShowTicketModal(false)} onSuccess={() => { setShowTicketModal(false); refresh(); }} onError={setError} />}
    {detailTicket && <TicketDetailModal ticket={detailTicket} canEdit={canEdit(detailTicket)} onClose={() => setDetailTicket(null)} onUpdate={data => { setDetailTicket({ ...detailTicket, ...data }); updateTicket.mutate({ id: detailTicket.id, data }); }} />}
  </div>;
}

function ResourceModal({ defaultTrack, onClose, onSuccess, onError }: { defaultTrack: Track; onClose: () => void; onSuccess: () => void; onError: (message: string) => void }) {
  const [track, setTrack] = useState<Track>(defaultTrack); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setLoading(true); onError(''); try { await coeApi.uploadResource(form); onSuccess(); } catch (e) { onError(e instanceof Error ? e.message : 'Unable to upload resource'); } finally { setLoading(false); } }
  return <Modal title="Upload learning resource" onClose={onClose} wide><form onSubmit={submit} className="p-6"><input type="hidden" name="track" value={track} /><div className="mb-6 flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/[0.04] p-4"><img src="/xebia-brand-logo.png" alt="Xebia" className="h-9 w-14 object-contain" /><div><p className="text-sm font-semibold text-foreground">Xebia learning workspace</p><p className="text-xs text-muted-foreground">Share a clear, reusable learning resource with the selected COE stream.</p></div></div><div className="grid gap-5 md:grid-cols-2"><Field label="Learning track"><TrackSelect value={track} onChange={setTrack} /></Field><Field label="File"><input required name="file" type="file" className="block w-full rounded-lg border border-border bg-card text-sm text-muted-foreground file:mr-3 file:border-0 file:bg-primary/10 file:px-3 file:py-2.5 file:text-sm file:font-semibold file:text-primary hover:file:bg-primary/15" /></Field><div className="md:col-span-2"><Field label="Title"><input required name="title" placeholder="e.g. Forward Deployed Engineering path" className="input h-12 w-full text-base" /></Field></div><div className="md:col-span-2"><Field label="Description (optional)"><textarea name="description" rows={7} placeholder="Explain what this resource covers, who it is for and how it can be used…" className="input min-h-40 w-full resize-y py-3 leading-6" /></Field></div></div><div className="mt-6 flex items-center justify-between border-t border-border pt-4"><p className="text-xs text-muted-foreground">PDF, Excel, PPTX, images and other formats are supported (up to 50 MB).</p><button disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Upload resource</button></div></form></Modal>;
}

function TicketModal({ defaultTrack, onClose, onSuccess, onError }: { defaultTrack: Track; onClose: () => void; onSuccess: () => void; onError: (message: string) => void }) {
  const [track, setTrack] = useState<Track>(defaultTrack); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setLoading(true); onError(''); try { await coeApi.createTicket({ track, title: form.get('title'), description: form.get('description'), priority: form.get('priority') }); onSuccess(); } catch (e) { onError(e instanceof Error ? e.message : 'Unable to create ticket'); } finally { setLoading(false); } }
  return <Modal title="Create learning ticket" onClose={onClose} wide><form onSubmit={submit} className="p-6"><div className="mb-6 flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/[0.04] p-4"><img src="/xebia-brand-logo.png" alt="Xebia" className="h-9 w-14 object-contain" /><div><p className="text-sm font-semibold text-foreground">Xebia learning workspace</p><p className="text-xs text-muted-foreground">Capture your learning goal, personal project or hands-on practice.</p></div></div><div className="grid gap-5 md:grid-cols-2"><Field label="COE stream"><TrackSelect value={track} onChange={setTrack} /></Field><Field label="Priority"><select name="priority" defaultValue="MEDIUM" className="input h-11 w-full"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></Field><div className="md:col-span-2"><Field label="What are you learning or building?"><input required name="title" placeholder="e.g. Build a medallion architecture demo" className="input h-12 w-full text-base" /></Field></div><div className="md:col-span-2"><Field label="Context, goals or useful links"><textarea name="description" rows={8} placeholder="Describe the learning path, personal project, expected outcome, key milestones or relevant links…" className="input min-h-44 w-full resize-y py-3 leading-6" /></Field></div></div><div className="mt-6 flex items-center justify-between border-t border-border pt-4"><p className="text-xs text-muted-foreground">Your ticket is visible to you and COE administrators.</p><button disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Create ticket</button></div></form></Modal>;
}

function TicketDetailModal({ ticket, canEdit, onClose, onUpdate }: { ticket: Ticket; canEdit: boolean; onClose: () => void; onUpdate: (data: Partial<Pick<Ticket, 'status' | 'priority'>>) => void }) {
  const stream = trackInfo(ticket.track);
  return <Modal title={`COE-${ticket.ticketNumber}`} onClose={onClose} wide><div className="p-6"><div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><img src={stream.logo} alt="" className="h-11 w-11 rounded-lg object-contain" /><div><span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold', stream.className)}>{stream.name}</span><h2 className="mt-2 break-words text-xl font-bold text-foreground">{ticket.title}</h2></div></div><span className={cn('text-sm font-semibold', PRIORITY_META[ticket.priority])}>{ticket.priority} priority</span></div><div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_190px]"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Context & goals</p><div className="min-h-40 whitespace-pre-wrap break-words rounded-xl border border-border bg-secondary/35 p-4 text-sm leading-6 text-foreground">{ticket.description || 'No additional context was added to this ticket.'}</div></div><aside className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4"><div><p className="text-xs text-muted-foreground">Owner</p><p className="mt-1 text-sm font-semibold text-foreground">{ticket.member?.name || ticket.createdBy.name}</p>{ticket.member?.designation && <p className="mt-0.5 text-xs text-muted-foreground">{ticket.member.designation}</p>}</div><div><p className="text-xs text-muted-foreground">Last updated</p><p className="mt-1 text-sm font-medium text-foreground">{formatDate(ticket.updatedAt)}</p></div><div><p className="mb-1.5 text-xs text-muted-foreground">Status</p>{canEdit ? <select value={ticket.status} onChange={event => onUpdate({ status: event.target.value as TicketStatus })} className="input w-full text-sm"><option value="BACKLOG">Backlog</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option></select> : <span className={cn('inline-flex rounded-full border px-2 py-1 text-xs font-semibold', STATUS_META[ticket.status].className)}>{STATUS_META[ticket.status].label}</span>}</div><div><p className="mb-1.5 text-xs text-muted-foreground">Priority</p>{canEdit ? <select value={ticket.priority} onChange={event => onUpdate({ priority: event.target.value as TicketPriority })} className="input w-full text-sm"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select> : <span className={cn('inline-flex text-xs font-semibold', PRIORITY_META[ticket.priority])}>{ticket.priority}</span>}</div></aside></div></div></Modal>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-foreground"><span className="mb-1.5 block">{label}</span>{children}</label>; }
function TrackSelect({ value, onChange }: { value: Track; onChange: (track: Track) => void }) { return <select value={value} onChange={event => onChange(event.target.value as Track)} className="input"><option value="DATABRICKS">Databricks</option><option value="FABRIC">Microsoft Fabric</option><option value="FDE">FDE</option></select>; }

function sessionDate(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
function toDateTimeLocal(value?: string) { const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }

function KnowledgeSharingSessions() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<KnowledgeSession | null>(null);
  const [error, setError] = useState('');
  const sessionsQuery = useQuery<{ sessions: KnowledgeSession[] }>({ queryKey: ['coe-sessions'], queryFn: () => coeApi.sessions().then(response => response.data), refetchInterval: 60_000 });
  const sessions = sessionsQuery.data?.sessions ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['coe-sessions'] });
  const canManage = (session: KnowledgeSession) => hasPermission('manageTeam') || session.organizerId === user?.id;

  return <section className="space-y-5">
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center"><div><div className="mb-2 flex items-center gap-2 text-primary"><Users className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.16em]">Open to everyone</span></div><h2 className="text-xl font-bold text-foreground">Knowledge Sharing Sessions</h2><p className="mt-1 text-sm text-muted-foreground">Schedule a topic, close it with attendance, and share a transcript with the whole team.</p></div><button onClick={() => { setError(''); setShowCreate(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Schedule session</button></div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
    {sessionsQuery.isLoading ? <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : sessions.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center"><CalendarDays className="mx-auto mb-3 h-7 w-7 text-primary" /><p className="font-semibold text-foreground">No sessions scheduled yet</p><p className="mt-1 text-sm text-muted-foreground">Start the next useful team conversation.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{sessions.map(session => <button key={session.id} onClick={() => setSelected(session)} className="rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"><div className="flex items-start justify-between gap-3"><span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', session.status === 'ENDED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-blue-700')}>{session.status === 'ENDED' ? 'Completed' : 'Scheduled'}</span><span className="text-xs text-muted-foreground">{session.durationMinutes} min</span></div><h3 className="mt-3 line-clamp-2 break-words text-base font-bold text-foreground">{session.topic}</h3><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{session.description || 'No session description added.'}</p><div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{sessionDate(session.scheduledAt)}</span><span>{session.organizer.name}</span></div></button>)}</div>}
    {showCreate && <ScheduleSessionModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); refresh(); toast.success('Session scheduled — everyone has been notified.'); }} onError={setError} />}
    {selected && <SessionDetailModal session={selected} canManage={canManage(selected)} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); refresh(); }} onError={setError} />}
  </section>;
}

function ScheduleSessionModal({ onClose, onSuccess, onError }: { onClose: () => void; onSuccess: () => void; onError: (message: string) => void }) {
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setLoading(true); onError(''); try { await coeApi.createSession({ topic: form.get('topic'), description: form.get('description'), scheduledAt: new Date(String(form.get('scheduledAt'))).toISOString(), durationMinutes: Number(form.get('durationMinutes')) }); onSuccess(); } catch (e) { onError(e instanceof Error ? e.message : 'Could not schedule this session'); } finally { setLoading(false); } }
  return <Modal title="Schedule knowledge sharing" onClose={onClose} wide><form onSubmit={submit} className="p-6"><div className="mb-6 flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/[0.04] p-4"><img src="/xebia-brand-logo.png" alt="Xebia" className="h-9 w-14 object-contain" /><div><p className="text-sm font-semibold text-foreground">Knowledge grows when it is shared.</p><p className="text-xs text-muted-foreground">The whole team will receive a notification when you schedule this session.</p></div></div><div className="grid gap-5 md:grid-cols-2"><div className="md:col-span-2"><Field label="Session topic"><input required name="topic" className="input h-12 w-full text-base" placeholder="e.g. Delta Lake optimisation patterns" /></Field></div><Field label="Date & time"><input required name="scheduledAt" type="datetime-local" defaultValue={toDateTimeLocal()} className="input h-11 w-full" /></Field><Field label="Duration"><select name="durationMinutes" defaultValue="60" className="input h-11 w-full"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></Field><div className="md:col-span-2"><Field label="Description"><textarea name="description" rows={7} className="input min-h-40 w-full resize-y py-3 leading-6" placeholder="What will participants learn, discuss or take away from this session?" /></Field></div></div><div className="mt-6 flex justify-end border-t border-border pt-4"><button disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Schedule & notify</button></div></form></Modal>;
}

function SessionDetailModal({ session, canManage, onClose, onChanged, onError }: { session: KnowledgeSession; canManage: boolean; onClose: () => void; onChanged: () => void; onError: (message: string) => void }) {
  const [showEnd, setShowEnd] = useState(false); const [showReschedule, setShowReschedule] = useState(false); const [file, setFile] = useState<File | null>(null); const [loading, setLoading] = useState(false);
  async function uploadTranscript() { if (!file) return; setLoading(true); onError(''); try { const form = new FormData(); form.append('file', file); const result = await coeApi.uploadSessionTranscript(session.id, form); toast.success(result.data.textExtracted ? 'Transcript uploaded and ready to summarise.' : 'Transcript uploaded. Use a text, PDF or DOCX file for AI summarisation.'); onChanged(); } catch (e) { onError(e instanceof Error ? e.message : 'Could not upload transcript'); } finally { setLoading(false); } }
  async function downloadTranscript() { try { const result = await coeApi.getSessionTranscriptDownload(session.id); window.open(result.data.downloadUrl, '_blank', 'noopener,noreferrer'); } catch (e) { onError(e instanceof Error ? e.message : 'Could not download transcript'); } }
  async function summarize() { setLoading(true); onError(''); try { await coeApi.summarizeSessionTranscript(session.id); toast.success('AI summary created.'); onChanged(); } catch (e) { onError(e instanceof Error ? e.message : 'Could not summarise transcript'); } finally { setLoading(false); } }
  return <Modal title="Knowledge-sharing session" onClose={onClose} wide><div className="p-6"><div className="mb-5 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between"><div><span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', session.status === 'ENDED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-blue-700')}>{session.status === 'ENDED' ? 'Completed' : 'Scheduled'}</span><h2 className="mt-2 text-xl font-bold text-foreground">{session.topic}</h2><p className="mt-1 text-sm text-muted-foreground">Organised by {session.organizer.name}</p></div>{canManage && <div className="flex flex-wrap gap-2">{session.status === 'SCHEDULED' && <><button onClick={() => setShowReschedule(true)} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"><RefreshCw className="h-3.5 w-3.5" /> Reschedule</button><button onClick={() => setShowEnd(true)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><SquareCheckBig className="h-3.5 w-3.5" /> End session</button></>}</div>}</div><div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_210px]"><div className="space-y-5"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">About this session</p><div className="min-h-28 whitespace-pre-wrap break-words rounded-xl border border-border bg-secondary/30 p-4 text-sm leading-6 text-foreground">{session.description || 'No description added.'}</div></div><div><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Transcript</p>{session.transcriptFileName && <button onClick={downloadTranscript} className="text-xs font-semibold text-primary hover:underline">Download transcript</button>}</div>{session.transcriptFileName ? <div className="rounded-xl border border-border bg-secondary/30 p-4"><p className="font-medium text-foreground">{session.transcriptFileName}</p>{session.transcriptSummary ? <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{session.transcriptSummary}</div> : <div className="mt-3"><p className="mb-2 text-sm text-muted-foreground">No summary yet. Generate one only when you are ready.</p><button disabled={loading} onClick={summarize} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary"><Sparkles className="h-3.5 w-3.5" /> AI summarise</button></div>}</div> : <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No transcript uploaded yet.</div>}{canManage && <div className="mt-3 flex items-center gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"><FileUp className="h-3.5 w-3.5" /> {file?.name || 'Choose transcript'}<input type="file" className="hidden" onChange={event => setFile(event.target.files?.[0] || null)} /></label>{file && <button disabled={loading} onClick={uploadTranscript} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Upload</button>}</div>}</div></div><aside className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4"><div><p className="text-xs text-muted-foreground">When</p><p className="mt-1 text-sm font-semibold text-foreground">{sessionDate(session.scheduledAt)}</p><p className="mt-1 text-xs text-muted-foreground">{session.durationMinutes} minutes</p></div><div><p className="text-xs text-muted-foreground">Attendance</p><p className="mt-1 text-sm font-semibold text-foreground">{session.attendance.filter(item => item.attended).length} / {session.attendance.length} present</p></div>{session.attendanceSummary && <div><p className="text-xs text-muted-foreground">Attendance Summary</p><p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{session.attendanceSummary}</p></div>}</aside></div></div>{showEnd && <EndSessionModal session={session} onClose={() => setShowEnd(false)} onSuccess={() => { setShowEnd(false); onChanged(); }} onError={onError} />}{showReschedule && <RescheduleSessionModal session={session} onClose={() => setShowReschedule(false)} onSuccess={() => { setShowReschedule(false); onChanged(); }} onError={onError} />}</Modal>;
}

function EndSessionModal({ session, onClose, onSuccess, onError }: { session: KnowledgeSession; onClose: () => void; onSuccess: () => void; onError: (message: string) => void }) {
  const [attendance, setAttendance] = useState<Record<string, boolean>>(() => Object.fromEntries(session.attendance.map(item => [item.memberId, item.attended]))); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setLoading(true); onError(''); try { await coeApi.endSession(session.id, { attendanceSummary: form.get('attendanceSummary'), attendance: session.attendance.map(item => ({ memberId: item.memberId, attended: attendance[item.memberId] })) }); toast.success('Session completed. Admins have been notified of absences.'); onSuccess(); } catch (e) { onError(e instanceof Error ? e.message : 'Could not end session'); } finally { setLoading(false); } }
  return <Modal title="End session & record attendance" onClose={onClose} wide><form onSubmit={submit} className="p-6"><p className="mb-4 text-sm text-muted-foreground">Mark everyone who attended. Absent team members will be reported to administrators.</p><div className="mb-2 flex justify-end"><button type="button" onClick={() => setAttendance(Object.fromEntries(session.attendance.map(item => [item.memberId, true])))} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary">Select all</button></div><div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-border p-3 sm:grid-cols-2">{session.attendance.map(item => <label key={item.memberId} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary"><input type="checkbox" checked={Boolean(attendance[item.memberId])} onChange={event => setAttendance({ ...attendance, [item.memberId]: event.target.checked })} className="h-4 w-4 accent-primary" /><span><span className="block text-sm font-medium text-foreground">{item.member.name}</span><span className="text-xs text-muted-foreground">{item.member.designation || 'Team member'}</span></span></label>)}</div><div className="mt-4"><Field label="Attendance summary"><textarea name="attendanceSummary" rows={5} className="input w-full resize-y py-3" placeholder="Key discussion points, outcomes and follow-ups…" /></Field></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground">Cancel</button><button disabled={loading} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">{loading ? 'Ending…' : 'End session'}</button></div></form></Modal>;
}

function RescheduleSessionModal({ session, onClose, onSuccess, onError }: { session: KnowledgeSession; onClose: () => void; onSuccess: () => void; onError: (message: string) => void }) {
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setLoading(true); onError(''); try { await coeApi.rescheduleSession(session.id, { scheduledAt: new Date(String(form.get('scheduledAt'))).toISOString(), durationMinutes: Number(form.get('durationMinutes')) }); toast.success('Session rescheduled — everyone has been notified.'); onSuccess(); } catch (e) { onError(e instanceof Error ? e.message : 'Could not reschedule session'); } finally { setLoading(false); } }
  return <Modal title="Reschedule session" onClose={onClose}><form onSubmit={submit} className="space-y-4 p-6"><Field label="New date & time"><input required name="scheduledAt" type="datetime-local" defaultValue={toDateTimeLocal(session.scheduledAt)} className="input h-11 w-full" /></Field><Field label="Duration"><select name="durationMinutes" defaultValue={session.durationMinutes} className="input h-11 w-full"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></Field><div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Cancel</button><button disabled={loading} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">{loading ? 'Saving…' : 'Reschedule & notify'}</button></div></form></Modal>;
}
