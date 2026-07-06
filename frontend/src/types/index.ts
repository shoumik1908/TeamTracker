// All TypeScript interfaces matching Prisma schema

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CertificationStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'EXPIRED';
export type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED';
export type NotificationType =
  | 'CERTIFICATION_ASSIGNED'
  | 'DEADLINE_APPROACHING'
  | 'CERTIFICATE_UPLOADED'
  | 'CERTIFICATION_COMPLETED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_ASSIGNED';

export interface TeamMember {
  id: string;
  name: string;
  phone?: string;

  designation?: string;
  joiningDate: string;
  skills: string[];
  profilePictureUrl?: string;
  managerId?: string;
  manager?: Pick<TeamMember, 'id' | 'name' | 'profilePictureUrl' | 'designation'>;
  projectMembers?: { project: { name: string } }[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    assignedCertifications: number;
    projectMembers: number;
  };
}

export interface TeamMemberProfile extends TeamMember {
  assignedCertifications: AssignedCertification[];
  projectMembers: ProjectMemberWithProject[];
  stats: {
    totalCertifications: number;
    completedCertifications: number;
    inProgressCertifications: number;
    overdueCertifications: number;
    totalProjects: number;
    activeProjects: number;
    overallProgress: number;
  };
}

export interface Certification {
  id: string;
  name: string;
  provider: string;
  description?: string;
  duration?: string;

  learningLink?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { assignedCertifications: number };
  _completedCount?: number;
}

export interface AssignedCertification {
  id: string;
  memberId: string;
  certificationId: string;
  assignedDate: string;
  deadline: string;
  priority: Priority;
  notes?: string;
  progress: number;
  status: CertificationStatus;
  completionDate?: string;
  expiryDate?: string;
  certificateUrl?: string;
  credentialId?: string;
  uploadDate?: string;
  member?: Pick<TeamMember, 'id' | 'name' | 'profilePictureUrl' | 'designation'>;
  certification?: Certification;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  client?: string;
  startDate: string;
  endDate?: string;
  priority: Priority;
  status: ProjectStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  members?: ProjectMemberEntry[];
  managerId?: string;
  manager?: Pick<TeamMember, 'id' | 'name' | 'profilePictureUrl' | 'designation'>;
  _count?: { members: number };
}

export interface ProjectMemberEntry {
  id: string;
  projectId: string;
  memberId: string;
  role?: string;
  joinedAt: string;
  member: Pick<TeamMember, 'id' | 'name' | 'profilePictureUrl' | 'designation'>;
}

export interface ProjectMemberWithProject {
  id: string;
  projectId: string;
  memberId: string;
  role?: string;
  joinedAt: string;
  project: Project;
}

export interface Notification {
  id: string;
  memberId?: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  member?: Pick<TeamMember, 'name' | 'profilePictureUrl'>;
}

export interface DashboardStats {
  totalMembers: number;
  activeProjects: number;
  completedProjects: number;
  totalCertifications: number;
  completedCertifications: number;
  pendingCertifications: number;
  overdueCertifications: number;
  upcomingDeadlines: number;
}

export interface CertificationStatusData {
  status: CertificationStatus;
  count: number;
}

export interface ProjectProgressData {
  name: string;
  progress: number;
  status: ProjectStatus;
}

export interface MonthlyCompletionData {
  month: string;
  count: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SearchResults {
  members: Pick<TeamMember, 'id' | 'name' | 'designation' | 'profilePictureUrl'>[];
  certifications: Pick<Certification, 'id' | 'name' | 'provider'>[];
  projects: Pick<Project, 'id' | 'name' | 'status' | 'progress' | 'client'>[];
}

export interface DeadlineTrackerData {
  overdue: AssignedCertification[];
  dueToday: AssignedCertification[];
  dueThisWeek: AssignedCertification[];
  upcoming: AssignedCertification[];
}
