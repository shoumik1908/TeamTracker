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
  email?: string;
  phone?: string;

  designation?: string;
  joiningDate: string;
  skills: string[];
  profilePictureUrl?: string;
  managerId?: string;
  manager?: Pick<TeamMember, 'id' | 'name' | 'profilePictureUrl' | 'designation'>;
  projectMembers?: { project: { name: string } }[];
  allocationStatus?: 'ALLOCATED' | 'BENCHED';
  currentProjectName?: string | null;
  activeProjectsCount?: number;
  activeProjectNames?: string[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    assignedCertifications: number;
    projectMembers: number;
  };
  // CV fields — populated after CV upload
  skillsExtracted?: string[] | null;
  yearsOfExperience?: number | null;
  cvSummary?: string | null;
  atsScore?: number | null;
  atsScoreBreakdown?: {
    contact_information: number;
    ats_formatting: number;
    skills_match: number;
    work_experience: number;
    education: number;
    projects: number;
    certifications: number;
    keywords: number;
    sectionCompleteness?: number;
    formattingHealth?: number;
    keywordStrength?: number;
    contentQuality?: number;
  } | null;
  atsSuggestions?: {
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
  } | null;
  cvBlobUrl?: string | null;
  cvOriginalFilename?: string | null;
  cvUploadedAt?: string | null;
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
  expiryDate?: string | null;
  certificateUrl?: string | null;
  credentialId?: string | null;
  originalFilename?: string | null;
  uploadDate?: string | null;
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
  pendingTasks: number;
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

export interface TeamsMeeting {
  id: string;
  projectId?: string;
  teamsMeetingId: string;
  subject: string;
  organizer: string;
  startTime: string;
  endTime: string;
  recordingUrl?: string;
  transcriptText?: string;
  aiSummary?: string;
  channelName?: string;
  fetchedAt: string;
}

export interface TeamsMeeting {
  id: string;
  projectId?: string;
  teamsMeetingId: string;
  subject: string;
  organizer: string;
  startTime: string;
  endTime: string;
  recordingUrl?: string;
  transcriptText?: string;
  aiSummary?: string;
  channelName?: string;
  fetchedAt: string;
}

export interface PreSalesOpportunity {
  id: string;
  name: string;
  clientName: string;
  account: 'PNB' | 'TNM';
  stages: string[];
  currentStageIndex: number;
  progressPercent: number;
  sourceDocuments?: { fileName: string; blobUrl: string; uploadedAt: string }[];
}

export type GtmCategory = 'NEW_MARKET_ENTRY' | 'EXISTING_CLIENT_EXPANSION';

export interface GtmPlan {
  id: string;
  name: string;
  clientName: string;
  category: GtmCategory;
  stages: string[];
  currentStageIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface GtmPartner {
  id: string;
  name: string;
  tier: string;
  renewalDate: string;
  createdAt: string;
  updatedAt: string;
  requirements?: GtmPartnerRequirement[];
}

export interface GtmPartnerRequirement {
  id: string;
  partnerId: string;
  certificationName: string;
  minimumCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GtmCampaign {
  id: string;
  name: string;
  launchId?: string | null;
  partnerId?: string | null;
  status: 'Planned' | 'Active' | 'Completed';
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  launch?: GtmPlan | null;
  partner?: GtmPartner | null;
}

export interface GtmCollateral {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  launchId?: string | null;
  partnerId?: string | null;
  launch?: GtmPlan | null;
  partner?: GtmPartner | null;
}

export interface GtmAuditResult {
  id: string;
  partnerId: string;
  partnerName: string;
  certificationName: string;
  minimumCount: number;
  currentCount: number;
  status: 'Met' | 'At Risk' | 'Not Met';
}

