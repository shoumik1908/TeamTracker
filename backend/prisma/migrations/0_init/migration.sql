-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CoeTrack" AS ENUM ('DATABRICKS', 'FABRIC', 'FDE');

-- CreateEnum
CREATE TYPE "CoeTicketStatus" AS ENUM ('BACKLOG', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "CoeTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "CoeSessionStatus" AS ENUM ('SCHEDULED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CERTIFICATION_ASSIGNED', 'DEADLINE_APPROACHING', 'CERTIFICATE_UPLOADED', 'CERTIFICATION_COMPLETED', 'PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_ASSIGNED', 'PROJECT_AUTO_ASSIGNED', 'CERTIFICATE_EDIT_REQUESTED', 'NEW_MEMBER_REGISTERED', 'TASK_ASSIGNED', 'TASK_DUE_SOON', 'COE_SESSION_SCHEDULED', 'COE_SESSION_REMINDER_DAY', 'COE_SESSION_REMINDER_30_MIN', 'COE_SESSION_ABSENCE_REPORTED');

-- CreateEnum
CREATE TYPE "EditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "designation" TEXT,
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "skills" TEXT[],
    "profilePictureUrl" TEXT,
    "allocationPercentage" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "skillsExtracted" JSONB,
    "skillsGrouped" JSONB,
    "projectsExtracted" JSONB,
    "yearsOfExperience" INTEGER,
    "cvSummary" TEXT,
    "atsScore" INTEGER,
    "atsScoreBreakdown" JSONB,
    "atsSuggestions" JSONB,
    "cvBlobUrl" TEXT,
    "cvOriginalFilename" TEXT,
    "cvUploadedAt" TIMESTAMP(3),
    "managerId" TEXT,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "description" TEXT,
    "duration" TEXT,
    "learningLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assigned_certifications" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "certificationId" TEXT NOT NULL,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3) NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" "CertificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completionDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "certificateUrl" TEXT,
    "credentialId" TEXT,
    "originalFilename" TEXT,
    "uploadDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assigned_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "client" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "visibleUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "managerId" TEXT,
    "teamsChannelId" TEXT,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "opportunityId" TEXT,
    "memberId" TEXT NOT NULL,
    "role" TEXT,
    "enrollmentType" TEXT DEFAULT 'assigned',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_updates" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "opportunityId" TEXT,
    "memberId" TEXT NOT NULL,
    "updateText" TEXT NOT NULL,
    "updateType" TEXT NOT NULL,
    "progressValue" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "targetRole" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "taskNumber" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignedById" TEXT NOT NULL,
    "onBehalfOfId" TEXT,
    "projectId" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_feedbacks" (
    "id" TEXT NOT NULL,
    "feedbackText" TEXT NOT NULL,
    "rating" INTEGER,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,

    CONSTRAINT "task_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams_meetings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "teamsMeetingId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "organizer" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "recordingUrl" TEXT,
    "transcriptText" TEXT,
    "aiSummary" TEXT,
    "channelName" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_records" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "opportunityId" TEXT,
    "meetingTitle" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3),
    "recordingType" TEXT,
    "recordingUrl" TEXT,
    "transcriptUrl" TEXT,
    "transcriptText" TEXT,
    "transcriptSource" TEXT,
    "aiMinutes" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_action_items" (
    "id" TEXT NOT NULL,
    "meetingRecordId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "originalOwnerText" TEXT NOT NULL,
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT,
    "confidence" TEXT,
    "sourceExcerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_decisions" (
    "id" TEXT NOT NULL,
    "meetingRecordId" TEXT NOT NULL,
    "decisionText" TEXT NOT NULL,
    "context" TEXT,
    "decidedById" TEXT,
    "confidence" TEXT,
    "sourceExcerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "key_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockers_risks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "opportunityId" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "firstRaisedMeetingId" TEXT NOT NULL,
    "resolvedInMeetingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blockers_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendees" (
    "id" TEXT NOT NULL,
    "meetingRecordId" TEXT NOT NULL,
    "memberId" TEXT,
    "rawName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presales_opportunities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "description" TEXT,
    "account" TEXT NOT NULL,
    "stages" TEXT[],
    "currentStageIndex" INTEGER NOT NULL DEFAULT 0,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "executiveSummary" TEXT,
    "scopeOfWork" TEXT,
    "architecture" TEXT,
    "implementationApproach" TEXT,
    "deliveryApproach" TEXT,
    "assumptions" TEXT,
    "outOfScope" TEXT,
    "timelines" TEXT,
    "commercials" TEXT,
    "others" TEXT,
    "sourceDocuments" JSONB,
    "descriptionGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presales_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtm_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "stages" TEXT[],
    "currentStageIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gtm_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtm_partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "renewal_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gtm_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtm_partner_requirements" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "certification_name" TEXT NOT NULL,
    "minimum_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gtm_partner_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtm_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "launch_id" TEXT,
    "partner_id" TEXT,
    "status" TEXT NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gtm_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtm_collaterals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "launch_id" TEXT,
    "partner_id" TEXT,

    CONSTRAINT "gtm_collaterals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_change_logs" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "previousStage" TEXT NOT NULL,
    "newStage" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reasoning" TEXT,
    "blobUrl" TEXT,
    "originalFilename" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_files" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "opportunityId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_links" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "opportunityId" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "addedBy" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_notes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "opportunityId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_edit_requests" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "proposedChanges" JSONB NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "EditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "certificate_edit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL DEFAULT 'System',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "teamMemberId" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_project_milestones" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_project_milestone_updates" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_project_milestone_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_project_assets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_project_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coe_learning_resources" (
    "id" TEXT NOT NULL,
    "track" "CoeTrack" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileMimeType" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coe_learning_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coe_tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" SERIAL NOT NULL,
    "track" "CoeTrack" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CoeTicketStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "priority" "CoeTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdById" TEXT NOT NULL,
    "memberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coe_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coe_knowledge_sessions" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" "CoeSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "organizerId" TEXT NOT NULL,
    "endedAt" TIMESTAMP(3),
    "attendanceSummary" TEXT,
    "meetingNotesFileName" TEXT,
    "meetingNotesFileUrl" TEXT,
    "meetingNotesMimeType" TEXT,
    "transcriptFileName" TEXT,
    "transcriptFileUrl" TEXT,
    "transcriptMimeType" TEXT,
    "transcriptText" TEXT,
    "transcriptSummary" TEXT,
    "dayReminderSentAt" TIMESTAMP(3),
    "thirtyMinuteReminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coe_knowledge_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coe_session_meeting_notes" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coe_session_meeting_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coe_session_attendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coe_session_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_profiles" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "atsScore" INTEGER,
    "atsBreakdown" JSONB,
    "atsSuggestions" JSONB,
    "summary" TEXT,
    "skills" JSONB,
    "skillsGrouped" JSONB,
    "projects" JSONB,
    "primaryRole" TEXT,
    "yearsOfExperience" INTEGER,
    "certifications" JSONB,
    "rawExtractedText" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_resumes" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "jobDescription" TEXT,
    "tailoredContent" JSONB NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_resumes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_members_email_key" ON "team_members"("email");

-- CreateIndex
CREATE INDEX "assigned_certifications_memberId_status_idx" ON "assigned_certifications"("memberId", "status");

-- CreateIndex
CREATE INDEX "assigned_certifications_deadline_idx" ON "assigned_certifications"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX "assigned_certifications_memberId_certificationId_key" ON "assigned_certifications"("memberId", "certificationId");

-- CreateIndex
CREATE INDEX "projects_status_endDate_idx" ON "projects"("status", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_memberId_key" ON "project_members"("projectId", "memberId");

-- CreateIndex
CREATE INDEX "notifications_memberId_createdAt_idx" ON "notifications"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_dueDate_idx" ON "tasks"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignments_taskId_memberId_key" ON "task_assignments"("taskId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "task_feedbacks_taskId_assigneeId_key" ON "task_feedbacks"("taskId", "assigneeId");

-- CreateIndex
CREATE INDEX "meeting_records_projectId_meetingDate_idx" ON "meeting_records"("projectId", "meetingDate");

-- CreateIndex
CREATE INDEX "meeting_records_opportunityId_idx" ON "meeting_records"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_teamMemberId_key" ON "users"("teamMemberId");

-- CreateIndex
CREATE INDEX "learning_projects_createdById_updatedAt_idx" ON "learning_projects"("createdById", "updatedAt");

-- CreateIndex
CREATE INDEX "learning_project_members_memberId_idx" ON "learning_project_members"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_project_members_projectId_memberId_key" ON "learning_project_members"("projectId", "memberId");

-- CreateIndex
CREATE INDEX "learning_project_milestones_projectId_createdAt_idx" ON "learning_project_milestones"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "learning_project_milestone_updates_milestoneId_createdAt_idx" ON "learning_project_milestone_updates"("milestoneId", "createdAt");

-- CreateIndex
CREATE INDEX "learning_project_assets_projectId_createdAt_idx" ON "learning_project_assets"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "coe_learning_resources_track_createdAt_idx" ON "coe_learning_resources"("track", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "coe_tickets_ticketNumber_key" ON "coe_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "coe_tickets_track_status_idx" ON "coe_tickets"("track", "status");

-- CreateIndex
CREATE INDEX "coe_tickets_memberId_idx" ON "coe_tickets"("memberId");

-- CreateIndex
CREATE INDEX "coe_knowledge_sessions_status_scheduledAt_idx" ON "coe_knowledge_sessions"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "coe_session_meeting_notes_sessionId_createdAt_idx" ON "coe_session_meeting_notes"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "coe_session_attendance_memberId_idx" ON "coe_session_attendance"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "coe_session_attendance_sessionId_memberId_key" ON "coe_session_attendance"("sessionId", "memberId");

-- CreateIndex
CREATE INDEX "resume_profiles_memberId_idx" ON "resume_profiles"("memberId");

-- CreateIndex
CREATE INDEX "generated_resumes_memberId_idx" ON "generated_resumes"("memberId");

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_certifications" ADD CONSTRAINT "assigned_certifications_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_certifications" ADD CONSTRAINT "assigned_certifications_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "certifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "presales_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "presales_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_onBehalfOfId_fkey" FOREIGN KEY ("onBehalfOfId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_feedbacks" ADD CONSTRAINT "task_feedbacks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_feedbacks" ADD CONSTRAINT "task_feedbacks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams_meetings" ADD CONSTRAINT "teams_meetings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_records" ADD CONSTRAINT "meeting_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_records" ADD CONSTRAINT "meeting_records_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "presales_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_action_items" ADD CONSTRAINT "meeting_action_items_meetingRecordId_fkey" FOREIGN KEY ("meetingRecordId") REFERENCES "meeting_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_action_items" ADD CONSTRAINT "meeting_action_items_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_decisions" ADD CONSTRAINT "key_decisions_meetingRecordId_fkey" FOREIGN KEY ("meetingRecordId") REFERENCES "meeting_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_decisions" ADD CONSTRAINT "key_decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockers_risks" ADD CONSTRAINT "blockers_risks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockers_risks" ADD CONSTRAINT "blockers_risks_firstRaisedMeetingId_fkey" FOREIGN KEY ("firstRaisedMeetingId") REFERENCES "meeting_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockers_risks" ADD CONSTRAINT "blockers_risks_resolvedInMeetingId_fkey" FOREIGN KEY ("resolvedInMeetingId") REFERENCES "meeting_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_meetingRecordId_fkey" FOREIGN KEY ("meetingRecordId") REFERENCES "meeting_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_partner_requirements" ADD CONSTRAINT "gtm_partner_requirements_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "gtm_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_campaigns" ADD CONSTRAINT "gtm_campaigns_launch_id_fkey" FOREIGN KEY ("launch_id") REFERENCES "gtm_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_campaigns" ADD CONSTRAINT "gtm_campaigns_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "gtm_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_collaterals" ADD CONSTRAINT "gtm_collaterals_launch_id_fkey" FOREIGN KEY ("launch_id") REFERENCES "gtm_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_collaterals" ADD CONSTRAINT "gtm_collaterals_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "gtm_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "presales_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_links" ADD CONSTRAINT "project_links_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_links" ADD CONSTRAINT "project_links_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "presales_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_notes" ADD CONSTRAINT "project_notes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_notes" ADD CONSTRAINT "project_notes_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "presales_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_edit_requests" ADD CONSTRAINT "certificate_edit_requests_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assigned_certifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_projects" ADD CONSTRAINT "learning_projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_project_members" ADD CONSTRAINT "learning_project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_project_members" ADD CONSTRAINT "learning_project_members_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_project_milestones" ADD CONSTRAINT "learning_project_milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_project_milestone_updates" ADD CONSTRAINT "learning_project_milestone_updates_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "learning_project_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_project_milestone_updates" ADD CONSTRAINT "learning_project_milestone_updates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_project_assets" ADD CONSTRAINT "learning_project_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_project_assets" ADD CONSTRAINT "learning_project_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coe_learning_resources" ADD CONSTRAINT "coe_learning_resources_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coe_tickets" ADD CONSTRAINT "coe_tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coe_tickets" ADD CONSTRAINT "coe_tickets_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coe_knowledge_sessions" ADD CONSTRAINT "coe_knowledge_sessions_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coe_session_meeting_notes" ADD CONSTRAINT "coe_session_meeting_notes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "coe_knowledge_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coe_session_meeting_notes" ADD CONSTRAINT "coe_session_meeting_notes_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coe_session_attendance" ADD CONSTRAINT "coe_session_attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "coe_knowledge_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coe_session_attendance" ADD CONSTRAINT "coe_session_attendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_profiles" ADD CONSTRAINT "resume_profiles_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_resumes" ADD CONSTRAINT "generated_resumes_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

