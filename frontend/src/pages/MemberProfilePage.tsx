import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { membersApi } from '@/lib/api';
import type { TeamMemberProfile } from '@/types';
import { ArrowLeft, Phone, Award, FolderKanban, TrendingUp } from 'lucide-react';
import { cn, formatDate, getInitials, formatStatus, getStatusColor, getProgressColor } from '@/lib/utils';

export default function MemberProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: member, isLoading } = useQuery<TeamMemberProfile>({
    queryKey: ['member', id],
    queryFn: () => membersApi.get(id!).then(r => r.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-48 bg-card rounded-2xl border border-border" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-card rounded-xl border border-border" />)}
        </div>
      </div>
    );
  }

  if (!member) return <div className="text-center py-20 text-muted-foreground">Member not found</div>;

  const { stats } = member;
  const completionRate = stats.totalCertifications > 0
    ? Math.round((stats.completedCertifications / stats.totalCertifications) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={() => navigate('/members')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Members
      </button>

      {/* Profile Header Card */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-azure-800 via-azure-700 to-primary" />
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <div className="w-20 h-20 rounded-2xl border-4 border-card bg-azure-900/40 flex items-center justify-center overflow-hidden shadow-xl flex-shrink-0">
              {member.profilePictureUrl
                ? <img src={member.profilePictureUrl} alt={member.name} className="w-full h-full object-cover" />
                : <span className="text-azure-300 text-2xl font-bold">{getInitials(member.name)}</span>
              }
            </div>
            <div className="pb-1">
              <h1 className="text-2xl font-bold">{member.name}</h1>
              <p className="text-muted-foreground">{member.designation}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
            {member.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4 text-azure-500" /><span>{member.phone}</span>
              </div>
            )}

            {member.manager && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground col-span-2 md:col-span-1">
                <span>👤 Reports to: <strong className="text-foreground">{member.manager.name}</strong></span>
              </div>
            )}
          </div>

          {member.skills.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {member.skills.map(skill => (
                <span key={skill} className="text-xs px-2.5 py-1 bg-azure-950/40 text-azure-300 border border-azure-800/40 rounded-full font-medium">{skill}</span>
              ))}
            </div>
          )}


        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Certs', value: stats.totalCertifications, icon: Award, color: 'text-indigo-400', bg: 'bg-indigo-950/40' },
          { label: 'Completed', value: stats.completedCertifications, icon: Award, color: 'text-green-400', bg: 'bg-green-950/40' },
          { label: 'Total Projects', value: stats.totalProjects, icon: FolderKanban, color: 'text-purple-400', bg: 'bg-purple-950/40' },
          { label: 'Active Projects', value: stats.activeProjects, icon: TrendingUp, color: 'text-azure-400', bg: 'bg-azure-950/40' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
              <Icon className={cn('w-5 h-5', color)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn('text-2xl font-bold', color)}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Overall Progress */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Overall Certification Progress</p>
          <span className="text-sm font-bold text-azure-400">{completionRate}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5">
          <div className={cn('h-2.5 rounded-full transition-all duration-700', getProgressColor(completionRate))}
            style={{ width: `${completionRate}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {stats.completedCertifications} of {stats.totalCertifications} certifications completed
          {stats.overdueCertifications > 0 && ` · ${stats.overdueCertifications} overdue`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Current Projects */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-sm mb-4">Current Projects</h3>
          {member.projectMembers.length === 0
            ? <p className="text-sm text-muted-foreground">Not assigned to any projects</p>
            : <div className="space-y-3">
                {member.projectMembers.map(pm => (
                  <div key={pm.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{pm.project.name}</p>
                        {pm.role && <p className="text-xs text-muted-foreground">{pm.role}</p>}
                      </div>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', getStatusColor(pm.project.status))}>
                        {formatStatus(pm.project.status)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span><span>{pm.project.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className={cn('h-1.5 rounded-full', getProgressColor(pm.project.progress))}
                          style={{ width: `${pm.project.progress}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Certifications */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-sm mb-4">Certifications</h3>
          {member.assignedCertifications.length === 0
            ? <p className="text-sm text-muted-foreground">No certifications assigned</p>
            : <div className="space-y-3">
                {member.assignedCertifications.map(ac => (
                  <div key={ac.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{ac.certification?.name}</p>
                        <p className="text-xs text-muted-foreground">{ac.certification?.provider}</p>
                      </div>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', getStatusColor(ac.status))}>
                        {formatStatus(ac.status)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Deadline: {formatDate(ac.deadline)}</span><span>{ac.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className={cn('h-1.5 rounded-full', getProgressColor(ac.progress))}
                          style={{ width: `${ac.progress}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  );
}
