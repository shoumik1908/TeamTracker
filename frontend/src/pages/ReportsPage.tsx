import { useState } from 'react';
import { reportsApi } from '@/lib/api';
import { FileBarChart, Download, Loader2, FileText, Table, FileSpreadsheet } from 'lucide-react';
import { cn, downloadBlob } from '@/lib/utils';

const REPORT_TYPES = [
  { id: 'team', label: 'Team Report', icon: '👥', description: 'All team members with their certifications and project stats' },
  { id: 'certifications', label: 'Certifications Report', icon: '🎓', description: 'All certification assignments with progress and status' },
  { id: 'projects', label: 'Projects Report', icon: '🚀', description: 'All projects with team members and progress' },
  { id: 'deadlines', label: 'Deadlines Report', icon: '⏰', description: 'Pending deadlines categorized by urgency' },
] as const;

const FORMATS = [
  { id: 'pdf', label: 'PDF', icon: FileText, color: 'text-red-400 bg-red-950/20 border-red-900/50' },
  { id: 'excel', label: 'Excel', icon: FileSpreadsheet, color: 'text-green-400 bg-green-950/20 border-green-900/50' },
  { id: 'csv', label: 'CSV', icon: Table, color: 'text-blue-400 bg-blue-950/20 border-blue-900/50' },
] as const;

type ReportType = typeof REPORT_TYPES[number]['id'];
type FormatType = typeof FORMATS[number]['id'];

const FILENAMES: Record<ReportType, Record<FormatType, string>> = {
  team: { pdf: 'team-report.pdf', excel: 'team-report.xlsx', csv: 'team-report.csv' },
  certifications: { pdf: 'certifications-report.pdf', excel: 'certifications-report.xlsx', csv: 'certifications-report.csv' },
  projects: { pdf: 'projects-report.pdf', excel: 'projects-report.xlsx', csv: 'projects-report.csv' },
  deadlines: { pdf: 'deadlines-report.pdf', excel: 'deadlines-report.xlsx', csv: 'deadlines-report.csv' },
};

export default function ReportsPage() {
  const [selectedType, setSelectedType] = useState<ReportType>('team');
  const [selectedFormat, setSelectedFormat] = useState<FormatType>('pdf');
  const [loading, setLoading] = useState<string | null>(null);

  const handleExport = async (type: ReportType, format: FormatType) => {
    const key = `${type}-${format}`;
    setLoading(key);
    try {
      const apiFns: Record<ReportType, (f: string) => Promise<any>> = {
        team: reportsApi.team,
        certifications: reportsApi.certifications,
        projects: reportsApi.projects,
        deadlines: reportsApi.deadlines,
      };
      const response = await apiFns[type](format);
      downloadBlob(new Blob([response.data]), FILENAMES[type][format]);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Reports & Export</h2>
        <p className="page-subtitle">Generate and download reports in multiple formats</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Report Builder */}
        <div className="col-span-2 space-y-5">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-4">1. Select Report Type</h3>
            <div className="grid grid-cols-2 gap-3">
              {REPORT_TYPES.map(rt => (
                <button key={rt.id} onClick={() => setSelectedType(rt.id)}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                    selectedType === rt.id ? 'border-azure-500 bg-azure-900/20 shadow-sm' : 'border-border hover:border-azure-500/50 hover:bg-muted/30'
                  )}>
                  <span className="text-2xl flex-shrink-0">{rt.icon}</span>
                  <div>
                    <p className={cn('text-sm font-semibold', selectedType === rt.id ? 'text-azure-300' : 'text-foreground')}>{rt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{rt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-4">2. Select Format</h3>
            <div className="grid grid-cols-3 gap-3">
              {FORMATS.map(fmt => {
                const Icon = fmt.icon;
                return (
                  <button key={fmt.id} onClick={() => setSelectedFormat(fmt.id)}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl border transition-all',
                      selectedFormat === fmt.id ? 'border-azure-500 bg-azure-900/20' : 'border-border hover:border-azure-500/50 hover:bg-muted/30',
                    )}>
                    <div className={cn('w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0', fmt.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-sm">{fmt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => handleExport(selectedType, selectedFormat)}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 bg-azure-500 text-white rounded-xl hover:bg-azure-600 transition-colors shadow-lg shadow-azure-500/25 font-medium disabled:opacity-60"
          >
            {loading === `${selectedType}-${selectedFormat}`
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <Download className="w-5 h-5" />
            }
            Export {REPORT_TYPES.find(r => r.id === selectedType)?.label} as {selectedFormat.toUpperCase()}
          </button>
        </div>

        {/* Quick Export */}
        <div className="bg-card rounded-xl border border-border p-5 h-fit">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileBarChart className="w-4 h-4 text-azure-400" /> Quick Export
          </h3>
          <div className="space-y-4">
            {REPORT_TYPES.map(rt => (
              <div key={rt.id}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{rt.icon} {rt.label}</p>
                <div className="flex gap-2">
                  {FORMATS.map(fmt => {
                    const Icon = fmt.icon;
                    const key = `${rt.id}-${fmt.id}`;
                    return (
                      <button key={fmt.id} onClick={() => handleExport(rt.id, fmt.id)}
                        disabled={!!loading}
                        title={`Export ${rt.label} as ${fmt.label}`}
                        className={cn('flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded-lg border transition-colors',
                          fmt.color, 'hover:opacity-80 disabled:opacity-40')}>
                        {loading === key
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Icon className="w-3 h-3" />
                        }
                        {fmt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
