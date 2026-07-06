import { useQuery } from '@tanstack/react-query';
import { searchApi } from '@/lib/api';
import { Clock, AlertTriangle, Calendar, ChevronRight } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import type { DeadlineTrackerData, AssignedCertification } from '@/types';

function DeadlineCard({ item, category }: { item: AssignedCertification; category: string }) {
  const colors: Record<string, string> = {
    overdue: 'border-l-red-500 bg-red-950/20',
    today: 'border-l-orange-500 bg-orange-950/20',
    'this-week': 'border-l-yellow-500 bg-yellow-950/20',
    upcoming: 'border-l-azure-500 bg-azure-950/20',
  };

  return (
    <div className={cn('flex items-center gap-4 p-4 rounded-xl border border-border border-l-4 bg-card hover-card', colors[category])}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{item.certification?.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{item.member?.name} · {item.certification?.provider}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={cn('text-xs font-bold', category === 'overdue' ? 'text-red-400' : category === 'today' ? 'text-orange-400' : 'text-muted-foreground')}>
          {formatDate(item.deadline)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{item.progress}% complete</p>
      </div>
      <div className="w-10 h-10 rounded-full border-2 border-current flex items-center justify-center flex-shrink-0"
        style={{ borderColor: category === 'overdue' ? '#f87171' : category === 'today' ? '#fb923c' : '#c084fc' }}>
        <span className="text-xs font-bold" style={{ color: category === 'overdue' ? '#f87171' : category === 'today' ? '#fb923c' : '#c084fc' }}>
          {item.progress}%
        </span>
      </div>
    </div>
  );
}

function Section({ title, items, category, icon: Icon, color, emptyMsg }: {
  title: string; items: AssignedCertification[]; category: string;
  icon: React.ComponentType<{ className?: string }>; color: string; emptyMsg: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className={cn('flex items-center justify-between px-5 py-3.5 border-b border-border', color)}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <h3 className="font-semibold text-sm">{title}</h3>
          <span className="w-5 h-5 rounded-full bg-black/35 flex items-center justify-center text-[10px] font-bold">{items.length}</span>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {items.length === 0
          ? <p className="text-sm text-muted-foreground text-center py-4">{emptyMsg}</p>
          : items.map(item => <DeadlineCard key={item.id} item={item} category={category} />)
        }
      </div>
    </div>
  );
}

export default function DeadlinesPage() {
  const { data, isLoading } = useQuery<DeadlineTrackerData>({
    queryKey: ['deadlines'],
    queryFn: () => searchApi.deadlines().then(r => r.data),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  const total = (data?.overdue.length || 0) + (data?.dueToday.length || 0) + (data?.dueThisWeek.length || 0) + (data?.upcoming.length || 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Deadline Tracker</h2>
        <p className="page-subtitle">{total} pending certifications tracked</p>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Overdue', count: data?.overdue.length || 0, color: 'text-red-400 bg-red-950/20 border-red-900/50' },
          { label: 'Due Today', count: data?.dueToday.length || 0, color: 'text-orange-400 bg-orange-950/20 border-orange-900/50' },
          { label: 'This Week', count: data?.dueThisWeek.length || 0, color: 'text-yellow-400 bg-yellow-950/20 border-yellow-900/50' },
          { label: 'Upcoming', count: data?.upcoming.length || 0, color: 'text-azure-400 bg-azure-950/20 border-azure-900/50' },
        ].map(({ label, count, color }) => (
          <div key={label} className={cn('flex items-center justify-between p-4 rounded-xl border font-medium', color)}>
            <span className="text-sm">{label}</span>
            <span className="text-2xl font-bold">{count}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Section title="Overdue" items={data?.overdue || []} category="overdue"
          icon={AlertTriangle} color="bg-red-50 text-red-700" emptyMsg="No overdue certifications 🎉" />
        <Section title="Due Today" items={data?.dueToday || []} category="today"
          icon={Clock} color="bg-orange-50 text-orange-700" emptyMsg="Nothing due today" />
        <Section title="Due This Week" items={data?.dueThisWeek || []} category="this-week"
          icon={Calendar} color="bg-yellow-50 text-yellow-700" emptyMsg="Nothing due this week" />
        <Section title="Upcoming (next 30 days)" items={data?.upcoming || []} category="upcoming"
          icon={ChevronRight} color="bg-azure-50 text-azure-700" emptyMsg="No upcoming deadlines" />
      </div>
    </div>
  );
}
